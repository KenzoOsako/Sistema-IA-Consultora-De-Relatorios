import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Nenhuma mensagem recebida' }, { status: 400 });
    }

    // URL do backend Python (FastAPI) — usa variável de ambiente em produção
    // Em desenvolvimento local: http://127.0.0.1:8000
    // Em produção (Vercel): URL do projeto backend hospedado
    const pythonBackendUrl = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/chat`
      : 'http://127.0.0.1:8000/api/chat';

    const response = await fetch(pythonBackendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Python backend error: ${response.status} - ${errorData}`);
      return NextResponse.json(
        { error: 'Falha no processamento pelo motor de IA' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // O backend Python retorna { role: "assistant", content: "..." }
    return NextResponse.json(data);

  } catch (error) {
    console.error('Falha de conexão com o backend Python:', error);
    return NextResponse.json(
      { error: 'Falha de comunicação interna com o servidor de IA.' }, 
      { status: 500 }
    );
  }
}

