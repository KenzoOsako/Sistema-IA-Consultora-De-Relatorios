"""Autenticação de cada requisição na API, inclusive acesso sem o frontend."""
import os
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


bearer = HTTPBearer(auto_error=False)
load_dotenv(Path(__file__).with_name('.env'))


def auth_configuration():
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_PUBLISHABLE_KEY', '')
    parsed = urlsplit(url)
    local = parsed.scheme == 'http' and parsed.hostname in {'localhost', '127.0.0.1', '::1'}
    if (not key or not parsed.hostname or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment
            or (parsed.scheme != 'https' and not local)):
        raise HTTPException(status_code=503, detail='Autenticação indisponível.')
    return url, key


async def require_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=401, detail='Autenticação necessária.', headers={'WWW-Authenticate': 'Bearer'})
    url, key = auth_configuration()
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
            response = await client.get(
                url + '/auth/v1/user',
                headers={'apikey': key, 'Authorization': 'Bearer ' + credentials.credentials},
            )
        if response.status_code in (401, 403):
            raise HTTPException(status_code=401, detail='Sessão inválida.', headers={'WWW-Authenticate': 'Bearer'})
        if response.status_code != 200:
            raise HTTPException(status_code=503, detail='Autenticação indisponível.')
        user = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(status_code=503, detail='Autenticação indisponível.') from None
    # app_metadata é administrado no Supabase; user_metadata NÃO autoriza acesso.
    metadata = user.get('app_metadata') if isinstance(user, dict) else None
    role = metadata.get('delta_role') if isinstance(metadata, dict) else None
    if (not isinstance(user, dict) or not user.get('id')
            or user.get('is_anonymous') is True or role not in ('viewer', 'admin')):
        raise HTTPException(status_code=403, detail='Acesso não autorizado.')
    return user


async def require_admin(user=Depends(require_user)):
    if user['app_metadata']['delta_role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso administrativo necessário.')
    return user
