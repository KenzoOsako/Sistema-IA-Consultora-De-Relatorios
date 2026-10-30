export const MAX_BODY_BYTES = 262144;
export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_BYTES = 32768;
export const MAX_HISTORY_BYTES = 131072;
const encoder = new TextEncoder();

export class ChatInputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ChatInputError('Nenhuma mensagem recebida.');
  }
  if (messages.length > MAX_MESSAGES) {
    throw new ChatInputError('Limite de histórico atingido. Inicie uma nova conversa.', 413);
  }
  let total = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message)
      || typeof message.content !== 'string' || !message.content.trim()
      || (message.role !== undefined && !['user', 'assistant'].includes(message.role))) {
      throw new ChatInputError('Formato de mensagem inválido.');
    }
    const bytes = encoder.encode(message.content).byteLength;
    total += bytes;
    if (bytes > MAX_MESSAGE_BYTES || total > MAX_HISTORY_BYTES) {
      throw new ChatInputError('Mensagem ou histórico muito longo. Reduza o texto ou inicie uma nova conversa.', 413);
    }
  }
  return messages;
}

export async function readChatBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ChatInputError('Corpo JSON inválido.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ChatInputError('Corpo da requisição muito grande.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); }
  catch { throw new ChatInputError('Corpo JSON inválido.'); }
}
