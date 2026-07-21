"""
sheets_connector.py
===================
Módulo responsável por conectar ao Google Sheets via Service Account,
extrair dados das planilhas e retorná-los como DataFrames tipados.

Pipeline de extração:
  gspread (API Google) → lista de dicts → pd.DataFrame → inferência de tipos

Tratamento de erros:
  Cada falha possível tem uma exceção específica e uma mensagem de diagnóstico
  clara. O sistema NUNCA silencia erros — ele reporta a causa exata.
"""

import os
import time
import gspread
import pandas as pd

from dataclasses import dataclass, field
from enum import Enum, auto
from loguru import logger
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from credentials_manager import get_credentials

load_dotenv()


# ─── Tipos de Erro Específicos ─────────────────────────────────────────────

class SheetError(Exception):
    """Erro base para falhas relacionadas ao Google Sheets."""


class SheetOfflineError(SheetError):
    """Falha de rede ou API indisponível."""


class SheetNotFoundError(SheetError):
    """Planilha ou aba não encontrada (ID errado, sem permissão)."""


class SheetEmptyError(SheetError):
    """Planilha encontrada, mas sem dados (vazia ou sem cabeçalho)."""


class SheetConfigError(SheetError):
    """Variáveis de ambiente necessárias não configuradas."""


# ─── Resultado Estruturado da Extração ────────────────────────────────────

class SheetStatus(Enum):
    OK = auto()        # Dados carregados com sucesso
    EMPTY = auto()     # Planilha vazia ou sem cabeçalho
    OFFLINE = auto()   # Falha de rede / API
    NOT_FOUND = auto() # Planilha/aba não encontrada
    CONFIG = auto()    # Configuração ausente no .env


@dataclass
class SheetResult:
    """
    Encapsula o resultado de uma extração de planilha.

    Permite que o context_builder tome decisões inteligentes baseadas
    no status, em vez de receber uma exceção não tratada.
    """
    base: str                          # 'financeiro' ou 'rh'
    status: SheetStatus                # Status da extração
    df: pd.DataFrame = field(default_factory=pd.DataFrame)
    error_message: str = ""            # Mensagem human-readable do erro
    rows: int = 0
    columns: int = 0
    column_names: list[str] = field(default_factory=list)
    loaded_at: float = 0.0             # Timestamp Unix da carga

    @property
    def is_ok(self) -> bool:
        return self.status == SheetStatus.OK

    def __post_init__(self):
        if self.is_ok and not self.df.empty:
            self.rows = len(self.df)
            self.columns = len(self.df.columns)
            self.column_names = self.df.columns.tolist()
            self.loaded_at = time.time()


# ─── Conector Principal ────────────────────────────────────────────────────

class SheetsConnector:
    """
    Gerencia conexão com Google Sheets, cache com TTL e extração tipada.

    Uso básico:
        connector = SheetsConnector()
        results = connector.get_all_results()
        print(results["financeiro"].status)   # SheetStatus.OK
        print(results["rh"].df.head())
    """

    def __init__(self):
        self._client: gspread.Client | None = None
        self._cache: dict[str, dict] = {}
        self.cache_ttl = int(os.getenv("CACHE_TTL_SECONDS", 300))

        self.config = {
            "financeiro": {
                "spreadsheet_id": os.getenv("SPREADSHEET_ID_FINANCEIRO", "").strip(),
                "sheet_name": os.getenv("SHEET_NAME_FINANCEIRO", "Fluxo de Caixa Mensal"),
                "label": "Base Financeira",
            },
            "rh": {
                "spreadsheet_id": os.getenv("SPREADSHEET_ID_RH", "").strip(),
                "sheet_name": os.getenv("SHEET_NAME_RH", "Base_de_Funcionarios_Empresa_V2"),
                "label": "Base de RH",
            },
        }

    # ── Autenticação ────────────────────────────────────────────────────────

    def _get_client(self) -> gspread.Client:
        if self._client is not None:
            return self._client

        try:
            creds = get_credentials()
            self._client = gspread.authorize(creds)
            logger.info("✅ Autenticado no Google Sheets via Service Account compartilhada.")
            return self._client
        except FileNotFoundError as exc:
            raise SheetConfigError(str(exc)) from exc
        except Exception as exc:
            raise SheetOfflineError(
                f"Falha ao autenticar no Google Sheets: {exc}"
            ) from exc

    # ── Inferência de Tipos ─────────────────────────────────────────────────

    @staticmethod
    def _infer_types(df: pd.DataFrame) -> pd.DataFrame:
        """
        Converte colunas para seus tipos mais adequados após a leitura.

        O gspread retorna tudo como string. Esta função detecta e converte:
        - Números inteiros e decimais
        - Datas no formato DD/MM/AAAA, AAAA-MM-DD e variações comuns
        - Percentuais (ex: "12,5%" → 0.125 como float)
        - Moeda BRL (ex: "R$ 1.500,00" → 1500.0 como float)

        Colunas que não se encaixam em nenhum tipo permanecem como string.
        """
        for col in df.columns:
            original = df[col].copy()

            # ── Tenta moeda/percentual BRL primeiro ──────────────────────
            cleaned = (
                df[col]
                .astype(str)
                .str.replace(r"R\$\s*", "", regex=True)
                .str.replace(r"\.", "", regex=True)   # milhar
                .str.replace(",", ".", regex=False)    # decimal
                .str.replace("%", "", regex=False)
                .str.strip()
            )
            try:
                converted = pd.to_numeric(cleaned, errors="raise")
                # Se era percentual, divide por 100
                if df[col].astype(str).str.contains("%").any():
                    converted = converted / 100
                df[col] = converted
                continue
            except (ValueError, AttributeError):
                pass

            # ── Tenta numérico puro ───────────────────────────────────────
            try:
                df[col] = pd.to_numeric(df[col], errors="raise")
                continue
            except (ValueError, TypeError):
                pass

            # ── Tenta data ────────────────────────────────────────────────
            date_formats = [
                "%d/%m/%Y", "%d/%m/%y",
                "%Y-%m-%d", "%Y/%m/%d",
                "%d-%m-%Y",
            ]
            for fmt in date_formats:
                try:
                    converted = pd.to_datetime(df[col], format=fmt, errors="raise")
                    df[col] = converted
                    break
                except (ValueError, TypeError):
                    continue

        return df

    # ── Limpeza do DataFrame ────────────────────────────────────────────────

    @staticmethod
    def _clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """
        Limpa o DataFrame bruto do gspread antes da inferência de tipos:
        - Remove linhas completamente vazias
        - Remove colunas completamente vazias
        - Strip em nomes de colunas e valores string
        - Remove duplicatas exatas
        """
        # Strip nos nomes das colunas
        df.columns = [str(c).strip() for c in df.columns]

        # Remove colunas cujo nome é vazio (colunas sem cabeçalho)
        df = df.loc[:, df.columns != ""]

        # Strip em valores string
        str_cols = df.select_dtypes(include="object").columns
        df[str_cols] = df[str_cols].apply(lambda c: c.astype(str).str.strip())

        # Substitui strings vazias por NaN para limpeza consistente
        df = df.replace("", pd.NA)

        # Remove linhas e colunas 100% nulas
        df = df.dropna(how="all").dropna(axis=1, how="all")

        # Remove duplicatas exatas
        before = len(df)
        df = df.drop_duplicates()
        removed = before - len(df)
        if removed > 0:
            logger.debug(f"🧹 {removed} linha(s) duplicada(s) removida(s).")

        df = df.reset_index(drop=True)
        return df

    # ── Busca com Retry (apenas erros de rede) ──────────────────────────────

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(SheetOfflineError),
        reraise=True,
    )
    def _fetch_raw(self, spreadsheet_id: str, sheet_name: str) -> pd.DataFrame:
        """
        Busca os registros brutos da planilha e retorna como DataFrame limpo e tipado.

        Traduz cada tipo de falha da API do Google em uma exceção específica,
        permitindo tratamento preciso no nível superior.
        """
        client = self._get_client()

        # ── Abre a planilha ──────────────────────────────────────────────
        try:
            spreadsheet = client.open_by_key(spreadsheet_id)
        except gspread.exceptions.APIError as exc:
            status_code = getattr(exc.response, "status_code", None)
            if status_code in (403, 401):
                raise SheetNotFoundError(
                    f"Sem permissão para acessar a planilha ID '{spreadsheet_id}'. "
                    "Verifique se a Service Account foi adicionada como leitora."
                ) from exc
            if status_code == 404:
                raise SheetNotFoundError(
                    f"Planilha com ID '{spreadsheet_id}' não encontrada. "
                    "Confirme o SPREADSHEET_ID no .env."
                ) from exc
            raise SheetOfflineError(
                f"Erro de API do Google Sheets (HTTP {status_code}): {exc}"
            ) from exc
        except gspread.exceptions.GSpreadException as exc:
            raise SheetOfflineError(f"Falha de conexão com Google Sheets: {exc}") from exc

        # ── Abre a aba ───────────────────────────────────────────────────
        try:
            worksheet = spreadsheet.worksheet(sheet_name)
        except gspread.exceptions.WorksheetNotFound:
            available = [ws.title for ws in spreadsheet.worksheets()]
            raise SheetNotFoundError(
                f"Aba '{sheet_name}' não encontrada na planilha. "
                f"Abas disponíveis: {available}"
            )

        # ── Lê os registros ──────────────────────────────────────────────
        try:
            records = worksheet.get_all_records(
                value_render_option="FORMATTED_VALUE",
                default_blank="",
            )
        except gspread.exceptions.APIError as exc:
            raise SheetOfflineError(f"Erro ao ler registros da planilha: {exc}") from exc

        if not records:
            raise SheetEmptyError(
                f"A aba '{sheet_name}' está vazia ou não possui cabeçalho válido na primeira linha."
            )

        # ── Processa ─────────────────────────────────────────────────────
        df = pd.DataFrame(records)
        df = self._clean_dataframe(df)

        if df.empty:
            raise SheetEmptyError(
                f"A aba '{sheet_name}' possui cabeçalho mas nenhuma linha de dados válida."
            )

        df = self._infer_types(df)
        return df

    # ── Cache ───────────────────────────────────────────────────────────────

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._cache:
            return False
        return (time.time() - self._cache[key]["ts"]) < self.cache_ttl

    def _cache_remaining(self, key: str) -> int:
        """Retorna segundos restantes de validade do cache."""
        if key not in self._cache:
            return 0
        elapsed = time.time() - self._cache[key]["ts"]
        return max(0, int(self.cache_ttl - elapsed))

    # ── Interface Pública ───────────────────────────────────────────────────

    def get_result(self, base: str, force_refresh: bool = False) -> SheetResult:
        """
        Extrai e retorna os dados de uma base como SheetResult estruturado.

        Nunca lança exceção — erros são encapsulados no SheetResult.status,
        permitindo que o sistema continue e informe o usuário adequadamente.

        Args:
            base: 'financeiro' ou 'rh'
            force_refresh: Se True, ignora o cache.

        Returns:
            SheetResult com status, DataFrame e metadados.
        """
        if base not in self.config:
            return SheetResult(
                base=base,
                status=SheetStatus.CONFIG,
                error_message=f"Base '{base}' inválida. Opções: {list(self.config.keys())}",
            )

        cfg = self.config[base]

        if not cfg["spreadsheet_id"]:
            return SheetResult(
                base=base,
                status=SheetStatus.CONFIG,
                error_message=(
                    f"SPREADSHEET_ID para '{base}' não configurado no .env. "
                    f"Defina SPREADSHEET_ID_{'FINANCEIRO' if base == 'financeiro' else 'RH'}."
                ),
            )

        cache_key = f"{base}_{cfg['spreadsheet_id']}"

        if not force_refresh and self._is_cache_valid(cache_key):
            cached = self._cache[cache_key]
            remaining = self._cache_remaining(cache_key)
            logger.debug(
                f"🗃️  Cache hit para '{base}' "
                f"(expira em {remaining}s)."
            )
            return SheetResult(base=base, status=SheetStatus.OK, df=cached["df"])

        logger.info(f"🔄 Buscando dados frescos da planilha '{base}'...")

        try:
            df = self._fetch_raw(cfg["spreadsheet_id"], cfg["sheet_name"])
            self._cache[cache_key] = {"df": df, "ts": time.time()}

            result = SheetResult(base=base, status=SheetStatus.OK, df=df)
            logger.info(
                f"✅ '{cfg['label']}' carregada: "
                f"{result.rows} linhas × {result.columns} colunas | "
                f"Colunas: {result.column_names}"
            )
            return result

        except SheetEmptyError as exc:
            logger.warning(f"⚠️  Planilha '{base}' vazia: {exc}")
            return SheetResult(base=base, status=SheetStatus.EMPTY, error_message=str(exc))

        except SheetNotFoundError as exc:
            logger.error(f"❌ Planilha '{base}' não encontrada: {exc}")
            return SheetResult(base=base, status=SheetStatus.NOT_FOUND, error_message=str(exc))

        except (SheetOfflineError, SheetConfigError) as exc:
            logger.error(f"❌ Falha ao acessar '{base}': {exc}")
            return SheetResult(base=base, status=SheetStatus.OFFLINE, error_message=str(exc))

        except Exception as exc:
            logger.exception(f"❌ Erro inesperado ao carregar '{base}'.")
            return SheetResult(
                base=base,
                status=SheetStatus.OFFLINE,
                error_message=f"Erro inesperado: {exc}",
            )

    def get_all_results(self, force_refresh: bool = False) -> dict[str, SheetResult]:
        """Extrai todas as bases e retorna um dict de SheetResults."""
        return {
            "financeiro": self.get_result("financeiro", force_refresh),
            "rh": self.get_result("rh", force_refresh),
        }

    def list_worksheets(self, base: str) -> list[str]:
        """
        Lista as abas disponíveis em uma planilha.
        Útil para diagnóstico quando o sheet_name estiver errado.
        """
        cfg = self.config.get(base, {})
        spreadsheet_id = cfg.get("spreadsheet_id", "")
        if not spreadsheet_id:
            return []
        try:
            client = self._get_client()
            spreadsheet = client.open_by_key(spreadsheet_id)
            return [ws.title for ws in spreadsheet.worksheets()]
        except Exception as exc:
            logger.warning(f"Não foi possível listar abas de '{base}': {exc}")
            return []

    def invalidate_cache(self):
        """Limpa o cache para forçar recarregamento na próxima chamada."""
        self._cache.clear()
        logger.info("🗑️  Cache invalidado.")
