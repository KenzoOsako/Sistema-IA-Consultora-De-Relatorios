import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BODY_BYTES, MAX_MESSAGES, MAX_MESSAGE_BYTES, MAX_HISTORY_BYTES,
  validateMessages, readChatBody,
} from '../lib/chat-limits.mjs';

const message = content => ({ role: 'user', content });
const fails = (messages, status) => assert.throws(() => validateMessages(messages), e => e.status === status);

test('message and history UTF-8 byte boundaries, without truncation', () => {
  assert.equal(validateMessages([message('é'.repeat(MAX_MESSAGE_BYTES / 2))]).length, 1);
  fails([message('é'.repeat(MAX_MESSAGE_BYTES / 2) + 'a')], 413);
  const history = Array.from({ length: MAX_HISTORY_BYTES / MAX_MESSAGE_BYTES }, () => message('a'.repeat(MAX_MESSAGE_BYTES)));
  assert.equal(validateMessages(history), history);
  fails([...history, message('x')], 413);
  assert.equal(validateMessages(Array.from({ length: MAX_MESSAGES }, () => message('x'))).length, MAX_MESSAGES);
  fails(Array.from({ length: MAX_MESSAGES + 1 }, () => message('x')), 413);
});

test('malformed messages rejected; legitimate assistant/user history preserved', () => {
  for (const messages of [null, [], [{}], [message(42)], [message(' ')], [{ role: 'system', content: 'x' }], [['x']]]) fails(messages, 400);
  const messages = [{ id: 1, role: 'assistant', content: 'Olá' }, { role: 'user', content: 'Uma pergunta' }];
  assert.equal(validateMessages(messages), messages);
  assert.equal(validateMessages([{ content: 'Legacy direct API question' }]).length, 1);
});

function streamed(body, header) {
  const bytes = new TextEncoder().encode(body);
  let offset = 0;
  const stream = new ReadableStream({ pull(controller) {
    if (offset === bytes.length) return controller.close();
    controller.enqueue(bytes.slice(offset, offset + 4096)); offset = Math.min(offset + 4096, bytes.length);
  } });
  return new Request('https://delta.test/api/chat', { method: 'POST', body: stream, duplex: 'half',
    headers: header ? { 'Content-Length': header } : {} });
}

test('stream bounded before parse, irrespective of absent or lying Content-Length', async () => {
  const atLimit = '"' + 'x'.repeat(MAX_BODY_BYTES - 2) + '"';
  assert.equal((await readChatBody(streamed(atLimit))).length, MAX_BODY_BYTES - 2);
  for (const header of [undefined, '1']) {
    await assert.rejects(readChatBody(streamed(atLimit + ' ', header)), e => e.status === 413);
  }
  for (const body of ['', '{broken']) await assert.rejects(readChatBody(streamed(body)), e => e.status === 400);
});
