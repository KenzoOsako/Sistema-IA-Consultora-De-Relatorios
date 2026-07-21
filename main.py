"""
main.py
=======
Script principal e loop de chat interativo do Chatbot Corporativo
Delta Empreendimentos.

Fluxo de execução:
  1. Configura logging (arquivo + console)
  2. Exibe banner e valida pré-requisitos do .env
  3. Inicializa SheetsConnector e LLMEngine (autentica no Google Cloud)
  4. Carrega planilhas → processa → constrói contexto para o Gemini
  5. Entra no loop while True de chat interativo
  6. A cada pergunta: injeta contexto + pergunta → chama Gemini → exibe resposta

Execute com:
    python main.py
"""

import os
import sys
import time

from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.markdown import Markdown
from rich.rule import Rule
from rich.text import Text
from rich.table import Table
from loguru import logger

# ── Módulos internos ──────────────────────────────────────────────────────────
from sheets_connector import SheetsConnector, SheetStatus
from context_builder import build_context
from llm_engine import LLMEngine


# ─── Configuração de Logging ──────────────────────────────────────────────────
Path("logs").mkdir(exist_ok=True)

logger.remove()  # Remove handler padrão do stderr

# Log detalhado em arquivo (debug completo para auditoria)
logger.add(
    "logs/chatbot.log",
    rotation="10 MB",
    retention="30 days",
    level="DEBUG",
    encoding="utf-8",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}",
)

# Log de erros críticos separado
logger.add(
    "logs/errors.log",
    rotation="5 MB",
    retention="60 days",
    level="ERROR",
    encoding="utf-8",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}\n{exception}",
)


# ─── Console Rich ─────────────────────────────────────────────────────────────
console = Console(highlight=True)


# ─── Constantes de UI ─────────────────────────────────────────────────────────
APP_NAME    = "Delta Empreendimentos"
APP_VERSION = "1.0.0"

BANNER = f"""[bold blue]
 ██████╗ ███████╗██╗  ████████╗ █████╗
 ██╔══██╗██╔════╝██║  ╚══██╔══╝██╔══██╗
 ██║  ██║█████╗  ██║     ██║   ███████║
 ██║  ██║██╔══╝  ██║     ██║   ██╔══██║
 ██████╔╝███████╗███████╗██║   ██║  ██║
 ╚═════╝ ╚══════╝╚══════╝╚═╝   ╚═╝  ╚═╝[/bold blue]

[dim] {APP_NAME} — Consultor de Dados Auxiliar  v{APP_VERSION}[/dim]"""

HELP_TEXT = """
[bold cyan]COMANDOS DISPONÍVEIS[/bold cyan]

  [bold yellow]atualizar[/bold yellow]   Recarrega os dados das planilhas do Google Sheets
  [bold yellow]status[/bold yellow]      Exibe o status atual das bases de dados
  [bold yellow]reset[/bold yellow]       Inicia nova sessão (limpa o histórico de conversa)
  [bold yellow]ajuda[/bold yellow]       Exibe este menu de ajuda
  [bold yellow]sair[/bold yellow]        Encerra o sistema

[bold cyan]DICAS DE USO[/bold cyan]

  • Perguntas em linguagem natural são aceitas
  • O histórico da conversa é mantido dentro da mesma sessão
  • Use [yellow]reset[/yellow] antes de mudar completamente de assunto
  • Use [yellow]atualizar[/yellow] se os dados das planilhas foram alterados recentemente
"""

# Separador visual entre turnos de conversa
TURN_SEPARATOR = Rule(style="dim blue")


# ─── Funções Auxiliares ───────────────────────────────────────────────────────

def _check_env_prerequisites() -> list[str]:
    """
    Verifica se as variáveis de ambiente mínimas estão definidas.
    Retorna lista de problemas encontrados (vazia = tudo ok).

    Credenciais necessárias:
      - GEMINI_API_KEY         → AI Studio (LLM gratuito)
      - GOOGLE_SERVICE_ACCOUNT_FILE → Service Account apenas para o Sheets
    """
    issues: list[str] = []

    # ── API Key do AI Studio (obrigatória para o LLM) ─────────────────────────
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key.startswith("AIzaSy-XXX"):
        issues.append(
            "  • [yellow]GEMINI_API_KEY[/yellow] não definida — "
            "Obtenha gratuitamente em [link=https://aistudio.google.com/app/apikey]"
            "aistudio.google.com/app/apikey[/link]"
        )

    # ── Variáveis do Google Sheets (obrigatórias para os dados) ───────────────
    sheets_vars = {
        "GOOGLE_SERVICE_ACCOUNT_FILE": "Caminho para o JSON da Service Account (Sheets)",
        "SPREADSHEET_ID_FINANCEIRO":   "ID da planilha financeira",
        "SPREADSHEET_ID_RH":           "ID da planilha de RH",
    }
    for var, desc in sheets_vars.items():
        val = os.getenv(var, "").strip()
        if not val or val.startswith("SEU_"):
            issues.append(f"  • [yellow]{var}[/yellow] não definido — {desc}")

    # ── Verifica existência física do arquivo de credenciais ──────────────────
    sa_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "credentials/service_account.json")
    if os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE") and not Path(sa_file).exists():
        issues.append(
            f"  • Arquivo não encontrado: [yellow]{sa_file}[/yellow] "
            "(Service Account para Google Sheets)"
        )

    return issues


def display_banner() -> None:
    """Exibe o banner de abertura do sistema."""
    console.print()
    console.print(Panel(BANNER, border_style="blue", padding=(0, 4)))
    console.print()


def display_status_table(connector: SheetsConnector) -> None:
    """
    Exibe uma tabela Rich com o status atual de cada base de dados.
    Chamado pelo comando 'status' ou após um 'atualizar'.
    """
    # Acessa o cache sem forçar refresh
    results = {
        base: connector.get_result(base, force_refresh=False)
        for base in ("financeiro", "rh")
    }

    table = Table(
        title="Status das Bases de Dados",
        border_style="blue",
        show_lines=True,
        title_style="bold blue",
    )
    table.add_column("Base", style="bold", min_width=14)
    table.add_column("Status", min_width=12)
    table.add_column("Registros", justify="right")
    table.add_column("Colunas", justify="right")
    table.add_column("Detalhes")

    status_styles = {
        SheetStatus.OK:        ("✅ OK",       "green"),
        SheetStatus.EMPTY:     ("⚠️  VAZIA",   "yellow"),
        SheetStatus.NOT_FOUND: ("❌ NÃO ENCONTRADA", "red"),
        SheetStatus.OFFLINE:   ("🔴 OFFLINE",  "red"),
        SheetStatus.CONFIG:    ("⚙️  CONFIG",  "yellow"),
    }

    for base_name, result in results.items():
        label, color = status_styles.get(result.status, ("❓ DESCONHECIDO", "dim"))
        rows_str = f"{result.rows:,}" if result.is_ok else "—"
        cols_str = str(result.columns) if result.is_ok else "—"
        detail   = (
            ", ".join(result.column_names[:5]) + ("..." if result.columns > 5 else "")
            if result.is_ok
            else result.error_message[:60] + ("..." if len(result.error_message) > 60 else "")
        )
        table.add_row(
            base_name.upper(),
            f"[{color}]{label}[/{color}]",
            rows_str,
            cols_str,
            f"[dim]{detail}[/dim]",
        )

    console.print()
    console.print(table)
    console.print()


def load_data(connector: SheetsConnector, force_refresh: bool = False) -> str:
    """
    Etapa 3 do fluxo principal: carrega planilhas → processa → constrói contexto.

    - Usa get_all_results() que NUNCA lança exceção — erros ficam no SheetResult.
    - Exibe feedback visual detalhado por base (linhas × colunas ou código de erro).
    - O sistema NUNCA é encerrado por falha parcial; continua com as bases ok.

    Returns:
        String de contexto Markdown pronta para injeção no prompt do Gemini.
    """
    console.print()
    with console.status(
        "[bold green]Conectando ao Google Sheets e carregando planilhas...[/bold green]",
        spinner="dots",
    ):
        results = connector.get_all_results(force_refresh=force_refresh)

    # ── Exibe resultado de cada base ──────────────────────────────────────────
    for base_name, result in results.items():
        if result.is_ok:
            cols_preview = ", ".join(result.column_names[:4])
            if result.columns > 4:
                cols_preview += f" (+{result.columns - 4} mais)"
            console.print(
                f"  [bold green]✅ {base_name.upper()}[/bold green] "
                f"[dim]→[/dim] {result.rows:,} registros × {result.columns} colunas "
                f"[dim]({cols_preview})[/dim]"
            )
        else:
            icon = {
                "EMPTY":     "⚠️ ",
                "NOT_FOUND": "❌",
                "OFFLINE":   "🔴",
                "CONFIG":    "⚙️ ",
            }.get(result.status.name, "❓")
            msg = result.error_message
            console.print(
                f"  [bold yellow]{icon} {base_name.upper()}[/bold yellow] "
                f"[dim]→ {result.status.name}:[/dim] "
                f"[yellow]{msg[:100]}{'...' if len(msg) > 100 else ''}[/yellow]"
            )

    # ── Constrói contexto para o Gemini ──────────────────────────────────────
    console.print()
    with console.status(
        "[bold green]Processando e otimizando dados para o modelo...[/bold green]",
        spinner="dots",
    ):
        try:
            context = build_context(
                result_financeiro=results["financeiro"],
                result_rh=results["rh"],
            )
        except Exception as exc:
            console.print(f"[bold red]❌ Erro crítico ao construir contexto:[/bold red] {exc}")
            logger.exception("Falha em build_context().")
            sys.exit(1)

    # Resumo de disponibilidade
    ok_count   = sum(1 for r in results.values() if r.is_ok)
    total_rows = sum(r.rows for r in results.values() if r.is_ok)
    console.print(
        f"  [bold green]📦 Contexto pronto:[/bold green] "
        f"{ok_count}/2 bases disponíveis · "
        f"{total_rows:,} registros totais · "
        f"{len(context):,} caracteres"
    )
    console.print()
    return context


# ─── Inicialização dos Componentes ────────────────────────────────────────────

def initialize_components() -> tuple[SheetsConnector, LLMEngine]:
    """
    Autentica no Google Cloud e instancia os componentes do sistema.

    Etapas:
      1. SheetsConnector: prepara config (autenticação lazy, ocorre no primeiro fetch)
      2. LLMEngine: chama vertexai.init() com a Service Account — autentica de imediato

    Qualquer falha aqui é fatal e encerra o sistema com diagnóstico claro.
    """
    console.print("[dim]Inicializando componentes...[/dim]")

    # ── SheetsConnector ────────────────────────────────────────────────────────
    try:
        connector = SheetsConnector()
        console.print("  [dim]✓ SheetsConnector instanciado[/dim]")
    except Exception as exc:
        console.print(f"[bold red]❌ Falha ao criar SheetsConnector:[/bold red] {exc}")
        sys.exit(1)

    # ── LLMEngine (autentica no Vertex AI aqui) ────────────────────────────────
    with console.status(
        "[dim]Autenticando no Vertex AI (Gemini)...[/dim]",
        spinner="dots",
    ):
        try:
            llm = LLMEngine()
            console.print(
                f"  [dim]✓ LLMEngine pronto — modelo:[/dim] "
                f"[bold]{llm.model_name}[/bold]"
            )
        except ValueError as exc:
            console.print(f"[bold red]❌ Erro de configuração do LLM:[/bold red] {exc}")
            console.print(
                "[yellow]Verifique GCP_PROJECT_ID, GCP_LOCATION e "
                "GOOGLE_SERVICE_ACCOUNT_FILE no .env[/yellow]"
            )
            sys.exit(1)
        except Exception as exc:
            console.print(f"[bold red]❌ Falha ao inicializar Vertex AI:[/bold red] {exc}")
            logger.exception("Falha em LLMEngine.__init__().")
            sys.exit(1)

    console.print()
    return connector, llm


# ─── Loop Principal de Chat ───────────────────────────────────────────────────

def chat_loop(connector: SheetsConnector, llm: LLMEngine, context: str) -> None:
    """
    Loop while True de chat interativo.

    A cada iteração:
      1. Lê a entrada do usuário via Prompt.ask()
      2. Roteia para comando especial ou consulta ao Gemini
      3. Para consultas: injeta contexto + pergunta → chama llm.ask() → exibe resposta

    O loop só é encerrado por 'sair', Ctrl+C ou EOF.
    """
    console.print(
        "[bold]Pronto. Faça sua pergunta ou digite [yellow]ajuda[/yellow] "
        "para ver os comandos disponíveis.[/bold]"
    )
    console.print(TURN_SEPARATOR)

    session_start = datetime.now()
    logger.info(f"Sessão de chat iniciada em {session_start.isoformat()}")

    while True:

        # ── Leitura da entrada ─────────────────────────────────────────────────
        try:
            user_input = Prompt.ask(
                f"\n[bold cyan]Você[/bold cyan]",
                console=console,
            ).strip()
        except (KeyboardInterrupt, EOFError):
            console.print(
                "\n\n[bold yellow]Sessão encerrada pelo usuário.[/bold yellow]"
            )
            _print_session_summary(llm, session_start)
            break

        if not user_input:
            continue

        input_lower = user_input.lower().strip()

        # ══════════════════════════════════════════════════════════════════════
        # COMANDOS ESPECIAIS
        # ══════════════════════════════════════════════════════════════════════

        # ── sair ───────────────────────────────────────────────────────────────
        if input_lower == "sair":
            console.print(
                "\n[bold yellow]Encerrando o sistema. Até logo.[/bold yellow]"
            )
            _print_session_summary(llm, session_start)
            break

        # ── ajuda ──────────────────────────────────────────────────────────────
        elif input_lower == "ajuda":
            console.print(Panel(HELP_TEXT, border_style="cyan", title="Ajuda"))
            continue

        # ── status ─────────────────────────────────────────────────────────────
        elif input_lower == "status":
            display_status_table(connector)
            continue

        # ── reset ──────────────────────────────────────────────────────────────
        elif input_lower == "reset":
            llm.reset_conversation()
            console.print(
                "[bold green]✅ Nova sessão iniciada. "
                "Histórico de conversa limpo.[/bold green]"
            )
            console.print(TURN_SEPARATOR)
            continue

        # ── atualizar ──────────────────────────────────────────────────────────
        elif input_lower == "atualizar":
            console.print("[bold green]🔄 Recarregando dados das planilhas...[/bold green]")
            context = load_data(connector, force_refresh=True)
            llm.reset_conversation()
            logger.info("Dados atualizados e sessão de chat reiniciada.")
            console.print(
                "[bold green]✅ Dados atualizados. Nova sessão iniciada.[/bold green]"
            )
            console.print(TURN_SEPARATOR)
            continue

        # ══════════════════════════════════════════════════════════════════════
        # CONSULTA AO GEMINI
        # ══════════════════════════════════════════════════════════════════════

        logger.info(f"[Turno #{llm.turn_count + 1}] Pergunta: {user_input[:120]}")
        t_start = time.perf_counter()

        try:
            with console.status(
                "[bold green]Analisando dados e gerando resposta...[/bold green]",
                spinner="dots",
            ):
                answer = llm.ask(question=user_input, context=context)

            elapsed = time.perf_counter() - t_start
            logger.info(
                f"[Turno #{llm.turn_count}] Resposta gerada em {elapsed:.2f}s "
                f"({len(answer)} chars)"
            )

            # ── Renderiza resposta ─────────────────────────────────────────────
            console.print()
            console.print(
                Panel(
                    Markdown(answer),
                    title=(
                        f"[bold blue]Consultor Delta[/bold blue]  "
                        f"[dim]Turno #{llm.turn_count} · {elapsed:.1f}s[/dim]"
                    ),
                    border_style="blue",
                    padding=(1, 2),
                )
            )
            console.print(TURN_SEPARATOR)

        except Exception as exc:
            elapsed = time.perf_counter() - t_start
            logger.exception(f"Erro na chamada ao Gemini após {elapsed:.2f}s.")
            console.print()
            console.print(
                Panel(
                    f"[bold red]Não foi possível processar sua pergunta.[/bold red]\n\n"
                    f"[dim]Erro: {exc}[/dim]\n\n"
                    "[yellow]Sugestões:[/yellow]\n"
                    "  • Digite [yellow]atualizar[/yellow] para recarregar os dados\n"
                    "  • Digite [yellow]reset[/yellow] para iniciar nova sessão\n"
                    "  • Verifique sua conexão com a internet",
                    title="[bold red]Erro[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )
            console.print(TURN_SEPARATOR)


def _print_session_summary(llm: LLMEngine, session_start: datetime) -> None:
    """Exibe um resumo da sessão ao encerrar."""
    duration = datetime.now() - session_start
    minutes  = int(duration.total_seconds() // 60)
    seconds  = int(duration.total_seconds() % 60)

    console.print()
    console.print(
        Panel(
            f"[dim]Duração da sessão:[/dim] {minutes}m {seconds}s\n"
            f"[dim]Total de perguntas respondidas:[/dim] {llm.turn_count}\n"
            f"[dim]Log salvo em:[/dim] logs/chatbot.log",
            title="[dim]Resumo da Sessão[/dim]",
            border_style="dim",
            padding=(0, 2),
        )
    )
    console.print()


# ─── Ponto de Entrada ─────────────────────────────────────────────────────────

def main() -> None:
    """
    Orquestra o fluxo completo de inicialização e execução do chatbot.

    Sequência:
      1. Banner
      2. Validação de pré-requisitos (.env)
      3. Inicialização dos componentes (SheetsConnector + LLMEngine/Vertex AI)
      4. Carga e processamento das planilhas
      5. Loop de chat interativo
    """
    # ── 1. Banner ──────────────────────────────────────────────────────────────
    display_banner()

    # ── 2. Validação de pré-requisitos ─────────────────────────────────────────
    issues = _check_env_prerequisites()
    if issues:
        console.print(
            Panel(
                "[bold red]Configuração incompleta.[/bold red] "
                "Corrija os itens abaixo no arquivo [yellow].env[/yellow] "
                "antes de continuar:\n\n" + "\n".join(issues),
                title="[bold red]❌ Pré-requisitos não atendidos[/bold red]",
                border_style="red",
                padding=(1, 2),
            )
        )
        console.print(
            "[dim]Consulte o [bold]README.md[/bold] para instruções de configuração.[/dim]\n"
        )
        sys.exit(1)

    # ── 3. Inicialização ────────────────────────────────────────────────────────
    connector, llm = initialize_components()

    # ── 4. Carga das planilhas ──────────────────────────────────────────────────
    context = load_data(connector, force_refresh=False)

    # ── 5. Loop de chat ─────────────────────────────────────────────────────────
    chat_loop(connector, llm, context)


if __name__ == "__main__":
    main()
