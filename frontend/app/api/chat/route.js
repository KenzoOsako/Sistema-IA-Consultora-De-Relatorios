import { NextResponse } from 'next/server';
import { authorizedUser } from '@/lib/auth';
import { sameOrigin } from '@/lib/auth-policy.mjs';
import { ChatInputError, readChatBody, validateMessages } from '@/lib/chat-limits.mjs';

export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 });
  try {
    const authorization = await authorizedUser();
    if (authorization.status !== 200) {
      return NextResponse.json({ error: 'Acesso não autorizado ou indisponível.' }, { status: authorization.status });
    }
    // O usuário foi verificado acima; a API Python verificará o token novamente.
    const { data: sessionData, error: sessionError } = await authorization.client.auth.getSession();
    if (sessionError || !sessionData?.session?.access_token) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    }
    const body = await readChatBody(request);
    const messages = validateMessages(body?.messages);

    // URL do backend Python (FastAPI) — usa variável de ambiente em produção
    const base = process.env.DELTA_API_URL;
    if (!base) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
    const parsed = new URL(base);
    const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((!local && parsed.protocol !== 'https:') || parsed.username || parsed.password
      || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
    }
    const pythonBackendUrl = new URL('/api/chat', parsed).href;

    const response = await fetch(pythonBackendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      redirect: 'error',
      cache: 'no-store',
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Falha no processamento pelo motor de IA' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // O backend Python retorna { role: "assistant", content: "..." }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    if (error instanceof ChatInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Falha de comunicação interna com o servidor de IA.' }, 
      { status: 500 }
    );
  }
}

