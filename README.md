# Delta — Assistente de relatórios

Protótipo de consulta a planilhas de negócio por uma interface conversacional.
Combina Next.js, uma API FastAPI, Google Sheets e Gemini pelo Google AI Studio.
A Service Account é usada pelo Sheets; o LLM usa uma API key própria.

## Estado e limites

Projeto experimental, sem homologação para dados corporativos reais. O frontend
verifica o usuário no Supabase e a API Python valida novamente o bearer token.
Papéis `viewer` e `admin` vêm de `app_metadata` administrado no projeto;
`user_metadata` não concede acesso. Sem configuração ou autorização válida,
a consulta privada é recusada antes de carregar planilhas ou chamar o LLM.

A tela financeira usa apenas dados sintéticos identificados como simulação.
O link público de Power BI anteriormente incluído no cliente foi removido.
O responsável pelo relatório deve revisar/revogar sua publicação externa se
contiver dados sigilosos: retirar o link do código não restringe cópias antigas.
Um relatório real precisa de autorização própria no provedor; o login Delta
não protege um URL público de incorporação.

Resultados do modelo podem estar incorretos. Não há garantia de ausência de
alucinações, de atualização das planilhas ou de disponibilidade dos provedores.
O chat recusa corpos acima de 256 KiB durante a leitura, antes do parse, nas
entradas Next.js e FastAPI, mesmo sem `Content-Length` confiável. Aceita até
40 mensagens, 32 KiB de conteúdo UTF-8 por mensagem e 128 KiB de conteúdo no
histórico; não trunca silenciosamente. Entradas inválidas são recusadas antes
da inicialização de Sheets/Gemini. A interface oferece “Nova conversa” para
reiniciar o histórico local. Rate limiting, quotas por usuário, tempo de leitura
na borda e limites do contexto vindo das planilhas ainda exigem configuração
operacional antes de expor o serviço. A validação atual é sintética.

## Arquitetura

| Caminho | Responsabilidade |
| --- | --- |
| `frontend/app/` | Páginas, login/logout e proxy de chat no servidor Next.js |
| `frontend/lib/` | Cliente Supabase por requisição e política de acesso/origem |
| `api.py`, `auth.py` | API FastAPI, validação do token e autorização |
| `credentials_manager.py` | Credenciais da Service Account para Sheets |
| `sheets_connector.py`, `context_builder.py` | Leitura/cache das planilhas e contexto textual |
| `llm_engine.py` | Integração Gemini pelo SDK google-genai |
| `main.py` | Interface de terminal e inicialização dos componentes |
| `tests/`, `frontend/tests/` | Regressões isoladas e fluxo HTTP sintético |

## Configuração e execução local

Requisitos: Python 3.12, Node.js 24 e npm. Para funcionamento com provedores,
são necessários projeto Supabase próprio, acesso autorizado ao Sheets e API
Gemini. As verificações automatizadas não precisam desses serviços reais.

1. Configure o Supabase, desative cadastro público/login anônimo e provisione
   os usuários permitidos. Defina `app_metadata.delta_role` como `viewer`
   (consulta) ou `admin` (consulta e atualização das bases).
2. Copie `.env.example` para `.env` na raiz e `frontend/.env.example` para
   `frontend/.env.local`, somente se esses arquivos ainda não existirem.
   Use o mesmo `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` nos dois processos.
   Nunca use `service_role` nem coloque segredos em variáveis `NEXT_PUBLIC_`.
3. No backend, configure `GEMINI_API_KEY`, a Service Account e os IDs das
   planilhas autorizadas, conforme o exemplo. Não versione arquivos locais de
   credenciais. Conceda somente os acessos necessários às planilhas.
4. No frontend, configure `DELTA_API_URL` como origem da API Python, sem
   caminho, e `DELTA_APP_ORIGIN` como a origem pública exata do Next.js.
   Localmente: `http://localhost:8000` e `http://localhost:3000`.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn api:app --host 127.0.0.1 --port 8000
```

Em outro terminal:

```bash
cd frontend
npm ci --ignore-scripts
npm run dev
```

Abra `http://localhost:3000`. O endpoint `/api/refresh` exige papel `admin`.
O comando `python main.py` é uma interface local separada; só deve ser executado
por operador autorizado em máquina confiável, com as mesmas cautelas de dados.

## Testes e CI

Em ambiente Python isolado:

```bash
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -v
```

No frontend:

```bash
npm ci --ignore-scripts
npm test
npm run lint
npm run build
node tests/auth-flow.mjs
```

A [CI](.github/workflows/ci.yml) executa essas verificações com dependências
isoladas de teste no backend. O fluxo HTTP inicia Next.js com Auth e API
sintéticos em loopback: verifica acesso anônimo, papel negado, login, cookie
HttpOnly, dashboard, simulação financeira, chat e logout. Não chama Sheets,
Gemini nem Supabase hospedado. Lint possui dois avisos conhecidos de imagens.

## Antes de publicar

Configurar os ambientes reais e validar login, renovação, revogação e papéis
com contas fictícias em staging. O logout local não invalida imediatamente
access tokens já emitidos; sua validade depende da política do provedor.
Avaliar expiração, quotas, logs, permissões das planilhas e incorporação de
relatórios. Não reutilizar projeto ou dados de outro cliente.

O merge do código pode acionar projetos Vercel vinculados. Não publicar sem
confirmar destinos, variáveis e aprovação operacional. Não há licença de
reutilização explicitada; confirme os direitos de código, marca e dados antes
de redistribuir ou produzir um case público com informações da empresa.
