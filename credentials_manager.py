"""
credentials_manager.py
======================
Módulo central de credenciais para o Google Sheets (Service Account).

Com a migração para o Google AI Studio (google-genai), o LLM passou a usar
uma simples API Key — sem Service Account, sem escopos de cloud-platform.
Este módulo gerencia exclusivamente as credenciais do Google Sheets.

Escopos necessários (apenas Sheets):
  - spreadsheets.readonly → leitura de dados
  - drive.readonly        → acesso a metadados de arquivo
"""

import os
from functools import lru_cache

from google.oauth2.service_account import Credentials
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

# Escopos exclusivos para Google Sheets — cloud-platform removido
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


@lru_cache(maxsize=1)
def get_credentials() -> Credentials:
    """
    Carrega e retorna as credenciais da Service Account para o Google Sheets.

    Decorado com @lru_cache: o arquivo JSON é lido uma única vez durante
    toda a execução da aplicação.

    Returns:
        google.oauth2.service_account.Credentials com escopos de Sheets.

    Raises:
        FileNotFoundError: Arquivo JSON não encontrado no caminho configurado.
        ValueError: Variável GOOGLE_SERVICE_ACCOUNT_FILE não definida.
    """
    credentials_path = os.getenv(
        "GOOGLE_SERVICE_ACCOUNT_FILE",
        "credentials.json",   # padrão: arquivo na raiz do projeto
    )

    if not credentials_path:
        raise ValueError(
            "Variável GOOGLE_SERVICE_ACCOUNT_FILE não definida no .env"
        )

    credentials_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if credentials_json:
        import json
        try:
            creds_info = json.loads(credentials_json)
            creds = Credentials.from_service_account_info(
                creds_info,
                scopes=GOOGLE_SCOPES,
            )
            logger.info("🔑 Credenciais do Sheets carregadas via variável de ambiente GOOGLE_SERVICE_ACCOUNT_JSON.")
            return creds
        except Exception as e:
            raise ValueError(f"Erro ao carregar credenciais do JSON da variável de ambiente: {e}")

    if not os.path.exists(credentials_path):
        raise FileNotFoundError(
            f"Arquivo de credenciais não encontrado: '{credentials_path}'\n"
            "Consulte o README — Seção 'Setup da Service Account'."
        )

    creds = Credentials.from_service_account_file(
        credentials_path,
        scopes=GOOGLE_SCOPES,
    )

    logger.info(
        f"🔑 Credenciais do Sheets carregadas: '{credentials_path}' | "
        f"Service Account: {creds.service_account_email}"
    )
    return creds
