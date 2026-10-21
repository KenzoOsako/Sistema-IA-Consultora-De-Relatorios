# Sistema Delta Empreendimentos — Chatbot Corporativo

## Autenticação e estado atual

O acesso privado usa **Supabase Auth**. O login simulado foi removido. Cada
página privada verifica o usuário no servidor; o proxy de chat encaminha o
token do próprio usuário e a API Python o verifica novamente no Supabase.

Antes de executar:

1. Configure um projeto Supabase e desative cadastro público e login anônimo.
   Não use um projeto de outro cliente para este aplicativo.
2. Um administrador deve provisionar os usuários autorizados e definir, em
   **app_metadata**, `delta_role: "viewer"` (consulta) ou `delta_role: "admin"`
   (consulta e atualização das bases). `user_metadata` não concede acesso.
3. Copie `.env.example` para `.env` na raiz e `frontend/.env.example` para
   `frontend/.env.local`. Preencha o mesmo `SUPABASE_URL` e
   `SUPABASE_PUBLISHABLE_KEY` em ambos. Nunca use `service_role` ou chave secreta.
   `DELTA_API_URL` é a origem da API Python, sem caminho.
   `DELTA_APP_ORIGIN` é a origem pública exata do Next.js, como
   `http://localhost:3000` localmente e o domínio HTTPS na produção.
4. Instale as dependências Python e execute `uvicorn api:app --host 127.0.0.1 --port 8000`.
   Em `frontend/`, use `npm ci` e `npm run dev`.

Sem configuração, sem sessão ou sem papel permitido, o aplicativo nega acesso.
A autenticação não cria tabelas de negócio nem migra os dados das planilhas.
Para habilitar em produção ainda é necessário configurar o projeto e homologar
login, renovação de sessão, logout e revogação com usuários de teste. Nenhuma
credencial real faz parte do repositório. O logout encerra a sessão neste cliente;
um access token já emitido pode permanecer válido até expirar. Use expiração
curta e política de revogação compatível com a sensibilidade dos dados.

### Verificações locais

```bash
python -m unittest discover -s tests -v
cd frontend
npm test
npm run lint
npm run build
```

Os testes de autorização usam um provedor simulado e dados sintéticos, sem
chamar planilhas, Gemini ou um projeto Supabase real. A documentação legada
abaixo descreve o protótipo original; para o código atual, o motor LLM usa
Google AI Studio (`google-genai`), e a Service Account é exclusiva do Sheets.

**Assistente de Inteligência Corporativa** baseado em Gemini (Vertex AI) para análise de dados em Google Planilhas.

---

## Arquitetura do Sistema

```
main.py                  ← Ponto de entrada / Interface de terminal
├── credentials_manager.py ← 🔑 Service Account única (Sheets + Vertex AI)
├── sheets_connector.py    ← Conexão Google Sheets (gspread + cache + retry)
├── context_builder.py     ← Transforma DataFrames em contexto textual para o LLM
└── llm_engine.py          ← Motor Gemini: System Instructions, ChatSession, API
```

### Princípio Central: Uma Service Account, Dois Serviços

```
credentials/service_account.json
         │
         ├──→ gspread.authorize()     → Google Sheets API
         │
         └──→ vertexai.init()         → Vertex AI (Gemini)
```

O `credentials_manager.py` carrega as credenciais **uma única vez** com todos os escopos necessários para ambos os serviços. Zero duplicação, zero chave extra.

### Por que esta arquitetura e não LangChain/LlamaIndex?

| Critério | gspread direto ✅ | LangChain/LlamaIndex |
|---|---|---|
| Controle anti-alucinação | **Total** | Parcial (caixa-preta) |
| Dependências | **Mínimas** | Pesadas (~300+ MB) |
| Latência | **Baixa** | Média-Alta |
| Adequado para ≤ 50k linhas | ✅ Sim | ✅ Sim |
| Adequado para > 200k linhas | ⚠️ Requer paginação | ✅ Sim (RAG) |

---

## Pré-requisitos

- Python 3.11+
- Projeto no Google Cloud com faturamento ativo
- Vertex AI API habilitada no projeto
- Google Sheets API e Drive API habilitadas no projeto

---

## Setup — Passo a Passo

### 1. Instale as dependências

```bash
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # Linux/macOS

pip install -r requirements.txt
```

### 2. Configure a Service Account no Google Cloud

> **Uma única Service Account serve para Google Sheets E Vertex AI.**

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione (ou crie) seu projeto GCP
3. Ative as APIs necessárias em **APIs & Services → Enable APIs**:
   - ✅ **Vertex AI API**
   - ✅ **Google Sheets API**
   - ✅ **Google Drive API**
4. Em **IAM & Admin → Service Accounts**, clique em **Create Service Account**
5. Dê um nome (ex: `delta-chatbot`) e avance
6. Na etapa de permissões, atribua os papéis:
   - `Vertex AI User` — para chamar o Gemini
   - *(O acesso às planilhas é dado via compartilhamento direto, não IAM)*
7. Clique em **Done**, acesse a Service Account criada e vá em **Keys → Add Key → JSON**
8. Salve o arquivo baixado em `credentials/service_account.json`

**Compartilhe as planilhas com a Service Account:**
- Abra cada planilha no Google Sheets
- Clique em **Compartilhar**
- Adicione o e-mail da Service Account (ex: `delta-chatbot@seu-projeto.iam.gserviceaccount.com`)
- Permissão: **Leitor**

### 3. Configure as variáveis de ambiente

```bash
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/macOS
```

Edite o `.env` com seus valores reais:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=credentials/service_account.json
GCP_PROJECT_ID=seu-projeto-gcp-aqui
GCP_LOCATION=us-central1
SPREADSHEET_ID_FINANCEIRO=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
SPREADSHEET_ID_RH=1abc...xyz
LLM_MODEL=gemini-1.5-flash
```

> **Como encontrar o Spreadsheet ID?**
> URL: `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`**`/edit`

### 4. Execute o chatbot

```bash
python main.py
```

---

## Como o System Prompt é configurado no Vertex AI

No SDK Vertex AI, as **System Instructions** são passadas diretamente ao construtor do `GenerativeModel`:

```python
from vertexai.generative_models import GenerativeModel, GenerationConfig

model = GenerativeModel(
    model_name="gemini-1.5-flash",
    system_instruction="Você é um consultor analítico...",  # ← System Prompt
    generation_config=GenerationConfig(temperature=0.1),
)

chat = model.start_chat()
response = chat.send_message("Qual foi o faturamento do último trimestre?")
```

Isso é diferente de colocar o System Prompt dentro da mensagem do usuário — o parâmetro `system_instruction` é tratado pelo modelo de forma privilegiada e persiste em toda a sessão de chat.

---

## Modelos Gemini Disponíveis

| Modelo | Velocidade | Custo | Recomendado para |
|---|---|---|---|
| `gemini-1.5-flash` | ⚡ Alta | 💰 Baixo | Produção diária |
| `gemini-1.5-flash-002` | ⚡ Alta | 💰 Baixo | Produção (mais recente) |
| `gemini-1.5-pro` | 🐢 Média | 💰💰 Médio | Análises complexas |
| `gemini-1.5-pro-002` | 🐢 Média | 💰💰 Médio | Análises complexas (mais recente) |

Configure em `LLM_MODEL` no `.env`.

---

## Comandos no Chat

| Comando | Descrição |
|---|---|
| `atualizar` | Recarrega dados das planilhas (invalida cache) |
| `reset` | Nova sessão (limpa histórico de conversa) |
| `ajuda` | Lista todos os comandos |
| `sair` | Encerra o sistema |

---

## Exemplos de Perguntas

**Financeiro:**
- *"Qual foi o faturamento total do último trimestre?"*
- *"Quais são os 3 maiores centros de custo?"*

**RH:**
- *"Quantos funcionários ativos há por departamento?"*
- *"Qual é a média salarial por cargo?"*

**Cruzado:**
- *"Qual é o custo de folha como percentual do faturamento?"*

---

## Estrutura de Arquivos

```
SistemaDeltaEmpreendimentos/
├── main.py                    # Ponto de entrada
├── credentials_manager.py     # 🔑 Credenciais compartilhadas (Sheets + Vertex AI)
├── sheets_connector.py        # Conector Google Sheets
├── context_builder.py         # Construtor de contexto para o LLM
├── llm_engine.py              # Motor Gemini (Vertex AI)
├── requirements.txt
├── .env.example               # Template de configuração
├── .env                       # ⚠️ NÃO versionar
├── credentials/
│   └── service_account.json   # ⚠️ NÃO versionar
└── logs/
    └── chatbot.log
```

---

## Segurança

> ⚠️ **NUNCA** versione `.env` e `credentials/service_account.json` no Git.

Ambos estão no `.gitignore`. Verifique antes de qualquer `git push`.
