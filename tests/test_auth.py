import os
import sys
import types
import unittest
import subprocess
import tempfile
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

import api


class EnvironmentConfigurationTests(unittest.TestCase):
    def test_local_dotenv_is_loaded_before_authentication(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            shutil.copyfile(Path(__file__).resolve().parents[1] / 'auth.py', root / 'auth.py')
            (root / '.env').write_text('SUPABASE_URL=https://auth.example.test\nSUPABASE_PUBLISHABLE_KEY=synthetic-key\n')
            env = {k: v for k, v in os.environ.items() if k not in ('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY')}
            result = subprocess.run([sys.executable, '-c',
                "import auth; assert auth.auth_configuration() == ('https://auth.example.test', 'synthetic-key')"],
                cwd=root, env=env, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr.decode())


class AuthorizationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.env = patch.dict(os.environ, {'SUPABASE_URL': 'https://auth.example.test', 'SUPABASE_PUBLISHABLE_KEY': 'synthetic-publishable-key'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url='http://test')
        self.addAsyncCleanup(self.client.aclose)
        self.initialize = patch.object(api, 'ensure_initialized')
        self.initializer = self.initialize.start()
        self.addCleanup(self.initialize.stop)
        self.llm = patch.object(api, 'llm', MagicMock(generate_stateless=MagicMock(return_value='synthetic answer')))
        self.llm.start()
        self.addCleanup(self.llm.stop)

    def provider(self, role='viewer', status=200, user_metadata=None, anonymous=False):
        response = httpx.Response(status, json={
            'id': 'synthetic-user', 'is_anonymous': anonymous,
            'app_metadata': {'delta_role': role}, 'user_metadata': user_metadata or {},
        })
        client = MagicMock()
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)
        client.get = AsyncMock(return_value=response)
        return client

    async def test_anonymous_post_is_denied_before_data_or_llm(self):
        for path in ['/api/chat', '/api/refresh']:
            response = await self.client.post(path, json={'messages': [{'content': 'synthetic'}]})
            self.assertEqual(response.status_code, 401)
        self.initializer.assert_not_called()

    async def test_invalid_token_is_denied(self):
        provider = self.provider(status=401)
        with patch('auth.httpx.AsyncClient', return_value=provider):
            response = await self.client.post('/api/chat', headers={'Authorization': 'Bearer invalid'}, json={'messages': [{'content': 'synthetic'}]})
        self.assertEqual(response.status_code, 401)
        self.initializer.assert_not_called()

    async def test_user_editable_metadata_does_not_grant_access(self):
        provider = self.provider(role=None, user_metadata={'delta_role': 'admin'})
        with patch('auth.httpx.AsyncClient', return_value=provider):
            response = await self.client.post('/api/chat', headers={'Authorization': 'Bearer synthetic'}, json={'messages': [{'content': 'synthetic'}]})
        self.assertEqual(response.status_code, 403)
        self.initializer.assert_not_called()

    async def test_anonymous_supabase_user_is_denied_even_with_role(self):
        provider = self.provider(anonymous=True)
        with patch('auth.httpx.AsyncClient', return_value=provider):
            response = await self.client.post('/api/chat', headers={'Authorization': 'Bearer synthetic'}, json={'messages': [{'content': 'synthetic'}]})
        self.assertEqual(response.status_code, 403)

    async def test_authorized_user_can_chat_but_not_refresh(self):
        provider = self.provider()
        with patch('auth.httpx.AsyncClient', return_value=provider):
            response = await self.client.post('/api/chat', headers={'Authorization': 'Bearer synthetic'}, json={'messages': [{'content': 'synthetic'}]})
            refresh = await self.client.post('/api/refresh', headers={'Authorization': 'Bearer synthetic'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['content'], 'synthetic answer')
        self.assertEqual(refresh.status_code, 403)
        self.assertEqual(provider.get.call_args.kwargs['headers']['Authorization'], 'Bearer synthetic')

    async def test_admin_can_refresh(self):
        provider = self.provider(role='admin')
        fake_main = types.ModuleType('main')
        fake_main.load_data = MagicMock(return_value='synthetic context')
        with patch.dict(sys.modules, {'main': fake_main}):
            with patch('auth.httpx.AsyncClient', return_value=provider):
                response = await self.client.post('/api/refresh', headers={'Authorization': 'Bearer synthetic'})
        self.assertEqual(response.status_code, 200)
        fake_main.load_data.assert_called_once()

    async def test_missing_configuration_fails_closed(self):
        with patch.dict(os.environ, {'SUPABASE_URL': ''}):
            response = await self.client.post('/api/chat', headers={'Authorization': 'Bearer synthetic'}, json={'messages': [{'content': 'synthetic'}]})
        self.assertEqual(response.status_code, 503)
        self.initializer.assert_not_called()

    async def test_provider_unavailable_does_not_initialize(self):
        provider = self.provider(status=503)
        with patch('auth.httpx.AsyncClient', return_value=provider):
            response = await self.client.post('/api/chat', headers={'Authorization': 'Bearer synthetic'}, json={'messages': [{'content': 'synthetic'}]})
        self.assertEqual(response.status_code, 503)
        self.initializer.assert_not_called()
