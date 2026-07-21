import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from loguru import logger

# Importar as funções de inicialização do main.py
from main import initialize_components, load_data

# Variáveis globais para armazenar os componentes
connector = None
llm = None
context_str = ""

def ensure_initialized():
    global connector, llm, context_str
    if connector is None or llm is None:
        logger.info("Inicializando componentes de forma preguiçosa (lazy) para serverless...")
        connector, llm = initialize_components()
        context_str = load_data(connector, force_refresh=False)
        logger.info("Componentes carregados com sucesso.")

app = FastAPI(title="Delta Empreendimentos API")

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
    ensure_initialized()
    if not request.messages:
        raise HTTPException(status_code=400, detail="Nenhuma mensagem recebida")
    
    # Extrair a última mensagem do usuário
    last_message = request.messages[-1].get("content", "")
    
    if not last_message:
        raise HTTPException(status_code=400, detail="A última mensagem não possui conteúdo válido")
        
    try:
        logger.info(f"Recebendo pergunta via API: {last_message[:50]}...")
        
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

@app.post("/api/refresh")
async def refresh_data():
    ensure_initialized()
    global context_str
    try:
        context_str = load_data(connector, force_refresh=True)
        llm.reset_conversation()
        return {"status": "ok", "message": "Dados atualizados com sucesso e sessão resetada."}
    except Exception as e:
        logger.error(f"Erro ao recarregar planilhas: {e}")
        raise HTTPException(status_code=500, detail="Erro ao recarregar dados")

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delta Empreendimentos | Assistente IA</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --bg-color: #0f172a;
            --chat-bg: #1e293b;
            --text-color: #f8fafc;
            --message-user: #3b82f6;
            --message-bot: #334155;
            --border-color: #475569;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
        }
        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            height: 100vh;
            justify-content: center;
            align-items: center;
        }
        .chat-container {
            width: 100%;
            max-width: 900px;
            height: 90vh;
            background-color: var(--chat-bg);
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid var(--border-color);
        }
        .chat-header {
            padding: 20px;
            background-color: rgba(30, 41, 59, 0.95);
            border-bottom: 1px solid var(--border-color);
            text-align: center;
            backdrop-filter: blur(10px);
            z-index: 10;
        }
        .chat-header h1 {
            font-size: 1.25rem;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .chat-header p {
            font-size: 0.85rem;
            color: #94a3b8;
            margin-top: 4px;
        }
        .chat-messages {
            flex-grow: 1;
            padding: 24px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .message {
            max-width: 80%;
            padding: 14px 18px;
            border-radius: 12px;
            line-height: 1.5;
            font-size: 0.95rem;
            animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message.user {
            align-self: flex-end;
            background-color: var(--message-user);
            color: white;
            border-bottom-right-radius: 4px;
        }
        .message.bot {
            align-self: flex-start;
            background-color: var(--message-bot);
            border-bottom-left-radius: 4px;
        }
        
        /* Markdown Styles */
        .message.bot table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 0.85rem;
        }
        .message.bot th, .message.bot td {
            border: 1px solid var(--border-color);
            padding: 8px 12px;
            text-align: left;
        }
        .message.bot th {
            background-color: rgba(255, 255, 255, 0.05);
        }
        .message.bot strong {
            color: #60a5fa;
        }
        .message.bot ul, .message.bot ol {
            margin-left: 20px;
            margin-top: 8px;
        }
        
        .chat-input-area {
            padding: 20px;
            background-color: var(--chat-bg);
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 12px;
        }
        input[type="text"] {
            flex-grow: 1;
            padding: 14px 20px;
            border-radius: 24px;
            border: 1px solid var(--border-color);
            background-color: #0f172a;
            color: white;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.2s;
        }
        input[type="text"]:focus {
            border-color: var(--primary);
        }
        button {
            padding: 0 24px;
            background-color: var(--primary);
            color: white;
            border: none;
            border-radius: 24px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
        }
        button:hover {
            background-color: var(--primary-hover);
        }
        button:active {
            transform: scale(0.98);
        }
        button:disabled {
            background-color: var(--border-color);
            cursor: not-allowed;
            transform: none;
        }
        
        /* Loading indicator */
        .typing-indicator {
            display: none;
            align-self: flex-start;
            background-color: var(--message-bot);
            padding: 14px 18px;
            border-radius: 12px;
            border-bottom-left-radius: 4px;
            margin-bottom: 16px;
        }
        .dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            background-color: #94a3b8;
            border-radius: 50%;
            margin-right: 4px;
            animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }
        
        @media (max-width: 768px) {
            .chat-container {
                height: 100vh;
                border-radius: 0;
                border: none;
            }
        }
    </style>
</head>
<body>

<div class="chat-container">
    <div class="chat-header">
        <h1>Delta Empreendimentos</h1>
        <p>Consultoria Executiva por IA</p>
    </div>
    
    <div class="chat-messages" id="messages-container">
        <div class="message bot">
            Olá! Sou a inteligência artificial executiva da Delta Empreendimentos. Consigo analisar rapidamente o nosso fluxo de caixa e a nossa base de funcionários. Como posso ajudar nas decisões de hoje?
        </div>
    </div>
    
    <div class="typing-indicator" id="typing-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
    </div>

    <div class="chat-input-area">
        <input type="text" id="user-input" placeholder="Pergunte sobre receitas, despesas, funcionários..." autocomplete="off">
        <button id="send-button" onclick="sendMessage()">Enviar</button>
    </div>
</div>

<script>
    // Configura o Marked.js para converter quebras de linha nativamente
    marked.setOptions({ breaks: true });

    // Armazena o histórico da conversa para o backend stateless
    let conversationHistory = [];

    const messagesContainer = document.getElementById('messages-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');

    // Permite enviar com a tecla Enter
    userInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });

    function addMessageToUI(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        
        if (sender === 'bot') {
            msgDiv.innerHTML = marked.parse(text);
        } else {
            msgDiv.textContent = text;
        }
        
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        // Adiciona à UI
        addMessageToUI(text, 'user');
        userInput.value = '';
        
        // Bloqueia input enquanto processa
        userInput.disabled = true;
        sendButton.disabled = true;
        typingIndicator.style.display = 'block';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Adiciona ao histórico interno
        conversationHistory.push({ role: "user", content: text });

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: conversationHistory })
            });

            if (!response.ok) {
                throw new Error("Erro na comunicação com a API");
            }

            const data = await response.json();
            const botReply = data.content;
            
            // Adiciona resposta à UI e ao histórico
            addMessageToUI(botReply, 'bot');
            conversationHistory.push({ role: "assistant", content: botReply });
            
        } catch (error) {
            console.error(error);
            addMessageToUI("⚠️ Ocorreu um erro ao consultar os dados. Tente novamente em alguns segundos.", 'bot');
            // Remove a mensagem do usuário do histórico em caso de erro fatal para evitar corromper o contexto
            conversationHistory.pop();
        } finally {
            // Restaura input
            userInput.disabled = false;
            sendButton.disabled = false;
            typingIndicator.style.display = 'none';
            userInput.focus();
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
</script>

</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
async def root():
    return HTML_TEMPLATE

@app.get("/api/chat")
async def chat_get_fallback():
    return {"status": "ok", "message": "Endpoint de chat ativo. Para interagir, envie uma requisição POST."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=False)
