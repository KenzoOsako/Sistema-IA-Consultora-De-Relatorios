"""Bound untrusted chat input before parsing or invoking external services."""
from fastapi import HTTPException
from starlette.responses import JSONResponse

MAX_BODY_BYTES = 262144
MAX_MESSAGES = 40
MAX_MESSAGE_BYTES = 32768
MAX_HISTORY_BYTES = 131072


def validate_messages(messages):
    if not messages:
        raise HTTPException(400, "Nenhuma mensagem recebida")
    if len(messages) > MAX_MESSAGES:
        raise HTTPException(413, "Limite de histórico atingido. Inicie uma nova conversa.")
    total = 0
    for message in messages:
        content = message.get("content")
        if (not isinstance(content, str) or not content.strip()
                or ("role" in message and message["role"] not in ("user", "assistant"))):
            raise HTTPException(400, "Formato de mensagem inválido")
        try:
            size = len(content.encode("utf-8"))
        except UnicodeEncodeError:
            raise HTTPException(400, "Formato de mensagem inválido") from None
        total += size
        if size > MAX_MESSAGE_BYTES or total > MAX_HISTORY_BYTES:
            raise HTTPException(413, "Mensagem ou histórico muito longo. Reduza o texto ou inicie uma nova conversa.")


class ChatBodyLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (scope["type"] != "http" or scope["method"] != "POST"
                or scope["path"].rstrip("/") != "/api/chat"):
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            event = await receive()
            if event["type"] == "http.disconnect":
                return
            chunk = event.get("body", b"")
            if len(body) + len(chunk) > MAX_BODY_BYTES:
                response = JSONResponse({"detail": "Corpo da requisição muito grande"}, status_code=413)
                return await response(scope, receive, send)
            body.extend(chunk)
            if not event.get("more_body", False):
                break
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, bounded_receive, send)
