import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from loguru import logger

# Importar as funções de inicialização do main.py
from main import initialize_components, load_data

# Variáveis globais para armazenar os componentes
connector = None
llm = None
context_str = ""

@asynccontextmanager
async def lifespan(app: FastAPI):
    global connector, llm, context_str
    logger.info("Iniciando servidor FastAPI e inicializando componentes do Delta...")
    try:
        connector, llm = initialize_components()
        context_str = load_data(connector, force_refresh=False)
        logger.info("Componentes carregados com sucesso. API pronta para receber requisições.")
    except Exception as e:
        logger.error(f"Erro na inicialização: {e}")
        sys.exit(1)
    
    yield
    
    logger.info("Encerrando servidor...")

app = FastAPI(title="Delta Empreendimentos API", lifespan=lifespan)

# Configurar CORS (permitir que o frontend Next.js acesse)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especificar a origem (ex: http://localhost:3000)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    messages: list[dict]

class ChatResponse(BaseModel):
    role: str
    content: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="Nenhuma mensagem recebida")
    
    # Extrair a última mensagem do usuário
    last_message = request.messages[-1].get("content", "")
    
    if not last_message:
        raise HTTPException(status_code=400, detail="A última mensagem não possui conteúdo válido")
        
    try:
        logger.info(f"Recebendo pergunta via API: {last_message[:50]}...")
        
        # Como o frontend gerencia o próprio histórico de mensagens visuais,
        # Nós usamos llm.ask(question, context), que mantém o histórico real no google-genai
        # Obs: Se quisermos manter o contexto limpo para requests de usuários diferentes, 
        # precisaríamos criar sessões. Por ora, usaremos o histórico da engine padrão.
        
        answer = llm.ask(question=last_message, context=context_str)
        
        return ChatResponse(
            role="assistant",
            content=answer
        )
        
    except Exception as e:
        logger.error(f"Falha ao gerar resposta do LLM: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao processar a resposta do LLM")

@app.post("/api/refresh")
async def refresh_data():
    global context_str
    try:
        context_str = load_data(connector, force_refresh=True)
        llm.reset_conversation()
        return {"status": "ok", "message": "Dados atualizados com sucesso e sessão resetada."}
    except Exception as e:
        logger.error(f"Erro ao recarregar planilhas: {e}")
        raise HTTPException(status_code=500, detail="Erro ao recarregar dados")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=False)
