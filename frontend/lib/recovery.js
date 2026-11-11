export const recoveryPath = '/recuperar-senha';
export const recoveryHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
};

export function recoveryReply(status) {
  return Response.json({ ok: status === 200 }, { status, headers: recoveryHeaders });
}
