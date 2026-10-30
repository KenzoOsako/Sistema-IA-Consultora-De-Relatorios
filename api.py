import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from loguru import logger

# Importar as funções de inicialização do main.py
from auth import require_user, require_admin
from chat_limits import ChatBodyLimitMiddleware, validate_messages

# Variáveis globais para armazenar os componentes
connector = None
llm = None
context_str = ""

def ensure_initialized():
    from main import initialize_components, load_data
    global connector, llm, context_str
    if connector is None or llm is None:
        logger.info("Inicializando componentes de forma preguiçosa (lazy) para serverless...")
        connector, llm = initialize_components()
        context_str = load_data(connector, force_refresh=False)
        logger.info("Componentes carregados com sucesso.")

app = FastAPI(title="Delta Empreendimentos API")

# Configurar CORS (permitir que o frontend Next.js acesse)
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://delta-frontend-navy.vercel.app",  # Frontend em produção
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ChatBodyLimitMiddleware)

class ChatRequest(BaseModel):
    messages: list[dict]

class ChatResponse(BaseModel):
    role: str
    content: str

@app.post("/api/chat", response_model=ChatResponse, dependencies=[Depends(require_user)])
async def chat_endpoint(request: ChatRequest):
    validate_messages(request.messages)
    ensure_initialized()
    if not request.messages:
        raise HTTPException(status_code=400, detail="Nenhuma mensagem recebida")
    
    # Extrair a última mensagem do usuário
    last_message = request.messages[-1].get("content", "")
    
    if not last_message:
        raise HTTPException(status_code=400, detail="A última mensagem não possui conteúdo válido")
        
    try:
        logger.info("Recebendo pergunta de usuário autorizado via API.")
        
        # Usamos o método stateless que injeta o histórico inteiro da conversa 
        # a cada chamada. Isso previne que o Vercel "esqueça" o histórico do chat
        # devido à natureza efêmera de funções serverless.
        answer = llm.generate_stateless(messages=request.messages, context=context_str)
        
        return ChatResponse(
            role="assistant",
            content=answer
        )
        
    except Exception as e:
        logger.error(f"Falha ao gerar resposta do LLM: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao processar a resposta do LLM")

@app.post("/api/refresh", dependencies=[Depends(require_admin)])
async def refresh_data():
    from main import load_data
    ensure_initialized()
    global context_str
    try:
        context_str = load_data(connector, force_refresh=True)
        llm.reset_conversation()
        return {"status": "ok", "message": "Dados atualizados com sucesso e sessão resetada."}
    except Exception as e:
        logger.error(f"Erro ao recarregar planilhas: {e}")
        raise HTTPException(status_code=500, detail="Erro ao recarregar dados")

@app.get("/")
async def root():
    return {"status": "ok", "service": "Delta Empreendimentos API", "version": "1.0", "docs": "/docs"}


@app.get("/api/chat")
async def chat_get_fallback():
    return {"status": "ok", "message": "Endpoint de chat ativo. Para interagir, envie uma requisição POST."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=False)
