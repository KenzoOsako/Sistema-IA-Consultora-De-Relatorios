"""
llm_engine.py
=============
Motor LLM usando o Google AI Studio via SDK oficial google-genai.

Autenticação: API Key simples (GEMINI_API_KEY no .env).
Zero configuração de Google Cloud, IAM ou Service Account para o LLM.

Referências:
  SDK:    https://ai.google.dev/gemini-api/docs/quickstart?lang=python
  Modelos: https://ai.google.dev/gemini-api/docs/models/gemini
"""

import os

from loguru import logger
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

from google import genai
from google.genai import types

load_dotenv()


# ─── System Instructions (inseridas via GenerateContentConfig) ────────────────
#
# Na SDK google-genai, as system instructions são passadas dentro de
# GenerateContentConfig(system_instruction=...), que por sua vez é fornecido
# ao parâmetro `config=` de client.chats.create().
#
# Elas são processadas pelo modelo de forma privilegiada — separadas do
# histórico de mensagens — e persistem em todos os turnos da ChatSession.
#
SYSTEM_INSTRUCTIONS = """Você atua como o Assistente de Inteligência Artificial da Delta, integrado a um painel executivo.
Seu objetivo principal é fornecer dados financeiros e de recursos humanos de forma instantânea para a alta gestão.

REGRAS ESTRITAS DE COMPORTAMENTO:

1. Zero Exposição de Sistema (CRÍTICO): NUNCA mencione que você está "consultando", "acessando", "lendo", ou "buscando" dados. NUNCA cite nomes de arquivos, bancos de dados, scripts, tabelas, IDs de servidores ou processos internos (ex: não diga "Base_de_Funcionarios_V2"). Aja como se a informação fizesse parte da sua memória imediata.
2. Linguagem Executiva e Clean: Seja extremamente objetivo. Responda diretamente à pergunta na primeira frase, sem introduções longas, saudações repetitivas ou enrolação. Use um tom polido, neutro e corporativo.
3. Formatação de Dados: Utilize negrito para destacar números, valores monetários, porcentagens e métricas chave. Formate valores monetários no padrão brasileiro (ex: R$ 1.500.000,00).
4. Proatividade Limitada: Após fornecer a resposta exata, você tem permissão para adicionar, no máximo, uma frase curta sugerindo um próximo passo lógico (ex: "Posso detalhar esses custos por filial, se desejar.").

EXEMPLO DE INTERAÇÃO:
Usuário: Quantos funcionários temos até o momento?
Resposta Correta: Temos atualmente 120 colaboradores ativos. Posso filtrar esse número por departamento ou cargo, se desejar.
Resposta Incorreta: Acessando a tabela... Encontrei 120 funcionários.
"""


# ─── Configurações de Segurança ────────────────────────────────────────────────
# Para uso corporativo interno, bloqueamos apenas conteúdo claramente perigoso.
# Mais informações: https://ai.google.dev/gemini-api/docs/safety-settings
SAFETY_SETTINGS = [
    types.SafetySetting(
        category="HARM_CATEGORY_HARASSMENT",
        threshold="BLOCK_MEDIUM_AND_ABOVE",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_HATE_SPEECH",
        threshold="BLOCK_MEDIUM_AND_ABOVE",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold="BLOCK_MEDIUM_AND_ABOVE",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold="BLOCK_MEDIUM_AND_ABOVE",
    ),
]


class LLMEngine:
    """
    Gerencia a sessão de chat com o Gemini via Google AI Studio (google-genai).

    Fluxo de inicialização:
      1. Lê GEMINI_API_KEY do .env
      2. Instancia genai.Client(api_key=...)
      3. Cria ChatSession com system_instruction e GenerateContentConfig
      4. Mantém histórico multi-turno automaticamente via chat.send_message()

    A interface pública (ask / reset_conversation / turn_count) é idêntica
    à versão Vertex AI — main.py não precisa de nenhuma alteração.
    """

    def __init__(self):
        self.model_name  = os.getenv("LLM_MODEL", "gemini-1.5-pro")
        self.temperature = float(os.getenv("LLM_TEMPERATURE", 0.2))
        self.max_tokens  = int(os.getenv("LLM_MAX_TOKENS", 8192))

        # ── Inicializa o cliente com API Key ──────────────────────────────────
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key or api_key.startswith("AIzaSy-XXX"):
            raise ValueError(
                "GEMINI_API_KEY não configurada ou inválida no .env.\n"
                "Obtenha sua chave gratuita em: https://aistudio.google.com/app/apikey"
            )

        # genai.Client é o ponto de entrada único do SDK google-genai.
        # Para AI Studio: apenas api_key=.
        # Para Vertex AI (futuro): Client(vertexai=True, project=..., location=...)
        self._client = genai.Client(api_key=api_key)

        # ── Monta a configuração do modelo ────────────────────────────────────
        # GenerateContentConfig centraliza: system_instruction, temperature,
        # max_output_tokens e safety_settings em um único objeto tipado.
        self._config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTIONS,   # ← System Prompt oficial
            temperature=self.temperature,             # 0.2 = analítico/factual
            max_output_tokens=self.max_tokens,
            safety_settings=SAFETY_SETTINGS,
        )

        # ── Abre a ChatSession ────────────────────────────────────────────────
        # client.chats.create() retorna uma Chat object que mantém o histórico
        # de mensagens internamente. Cada send_message() adiciona o par
        # (user, model) ao histórico automaticamente.
        self._chat = self._client.chats.create(
            model=self.model_name,
            config=self._config,
        )
        self._turn_count: int = 0

        logger.info(
            f"🤖 AI Studio LLM Engine iniciado. "
            f"Modelo: {self.model_name} | Temp: {self.temperature}"
        )

    # ── Montagem da Mensagem do Usuário ────────────────────────────────────────

    def _build_user_message(self, question: str, context: str) -> str:
        """
        Monta a mensagem do usuário com o contexto das planilhas embutido.

        O contexto é reinjetado a cada turno para garantir que o modelo
        sempre opere sobre dados atualizados, especialmente após um refresh.
        """
        return (
            "## DADOS ATUALIZADOS DAS PLANILHAS CORPORATIVAS\n\n"
            f"{context}\n\n"
            "---\n\n"
            "## PERGUNTA DO USUÁRIO\n\n"
            f"{question}"
        )

    # ── Chamada ao Modelo (com retry em falhas de rede) ────────────────────────

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        reraise=True,
    )
    def ask(self, question: str, context: str) -> str:
        """
        Envia uma pergunta ao Gemini com o contexto das planilhas injetado.

        Usa chat.send_message() para manter histórico multi-turno.
        O SDK gerencia o histórico internamente na instância de Chat.

        Args:
            question: Pergunta do usuário em linguagem natural.
            context:  Contexto Markdown gerado pelo context_builder.

        Returns:
            Resposta textual do Gemini (string).
        """
        user_message = self._build_user_message(question, context)

        logger.debug(
            f"📤 Enviando ao Gemini: {len(user_message):,} chars | "
            f"Turno #{self._turn_count + 1}"
        )

        # send_message() é síncrono, mantém histórico automaticamente
        response = self._chat.send_message(user_message)

        answer = response.text
        self._turn_count += 1

        # Log de uso de tokens (quando disponível nos metadados)
        usage = getattr(response, "usage_metadata", None)
        if usage:
            logger.debug(
                f"📥 Resposta: {len(answer):,} chars | "
                f"Tokens: {getattr(usage, 'prompt_token_count', '?')} in / "
                f"{getattr(usage, 'candidates_token_count', '?')} out"
            )
        else:
            logger.debug(f"📥 Resposta: {len(answer):,} chars")

        return answer

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        reraise=True,
    )
    def generate_stateless(self, messages: list[dict], context: str) -> str:
        """
        Envia uma requisição stateless ao modelo, reconstruindo o histórico
        a partir do array de mensagens fornecido pelo frontend. Ideal para Vercel.
        """
        if not messages:
            return ""

        # O histórico do SDK requer formatação específica. 
        # Como o context sempre é injetado, colocamos ele apenas na ÚLTIMA mensagem do usuário
        # para economizar tokens e garantir que a IA foque nos dados mais recentes.
        
        contents = []
        for i, msg in enumerate(messages):
            role = "user" if msg.get("role") in ["user", "user"] else "model"
            content_text = msg.get("content", "")
            
            # Se for a última mensagem e for do user, anexar o contexto das planilhas
            if i == len(messages) - 1 and role == "user":
                content_text = self._build_user_message(content_text, context)
            
            contents.append({"role": role, "parts": [{"text": content_text}]})

        logger.debug(f"📤 Enviando ao Gemini (Stateless): {len(contents)} mensagens no histórico.")

        response = self._client.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=self._config
        )

        return response.text

    # ── Gerenciamento de Sessão ────────────────────────────────────────────────

    def reset_conversation(self) -> None:
        """
        Reinicia a sessão de chat limpando o histórico de conversa.

        Uma nova ChatSession é criada reutilizando o mesmo Client e Config —
        não há re-autenticação nem nova chamada de rede neste momento.
        """
        self._chat = self._client.chats.create(
            model=self.model_name,
            config=self._config,
        )
        self._turn_count = 0
        logger.info("🔄 Histórico de conversa resetado. Nova ChatSession criada.")

    @property
    def turn_count(self) -> int:
        """Número de turnos completos (pergunta + resposta) na sessão atual."""
        return self._turn_count

    @property
    def model_label(self) -> str:
        """Rótulo legível do modelo para exibição no terminal."""
        return self.model_name
