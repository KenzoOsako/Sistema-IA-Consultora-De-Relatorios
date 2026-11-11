'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './LoginForm.module.css';

export default function RecoveryForm({ update = false, invalid = false }) {
  const endpoint = update ? '/recuperar-senha/atualizar' : '/recuperar-senha/solicitar';
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = values.get('email');
    const password = values.get('password');

    if (update && password !== values.get('confirmation')) {
      setError('As senhas não coincidem.');
      return;
    }

    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update ? { password } : { email }),
      });
      if (response.ok) {
        form.reset();
        setDone(true);
      } else if (response.status === 401) {
        setError('O link expirou. Volte e solicite um novo link.');
      } else if (update && [400, 422].includes(response.status)) {
        setError('Escolha outra senha. Use uma senha forte com até 72 bytes.');
      } else {
        setError('Não foi possível concluir. Tente novamente.');
      }
    } catch {
      setError('Não foi possível concluir. Tente novamente.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>{update ? 'Definir nova senha' : 'Recuperar senha'}</h1>
        {!update && !done && (
          <p className={styles.subtitle}>Abra o link do e-mail neste mesmo navegador.</p>
        )}
      </header>
      {error && <p role="alert" className={styles.errorAlert}>{error}</p>}
      {invalid && !done && !error && (
        <p role="alert" className={styles.errorAlert}>Link inválido ou expirado. Solicite um novo link.</p>
      )}
      {done ? (
        <p role="status" className={styles.subtitle}>
          {update
            ? 'Senha atualizada. Volte ao login para entrar com a nova senha.'
            : 'Se o endereço puder receber o link, ele chegará por e-mail. Confira também o spam.'}
        </p>
      ) : (
        <form className={styles.form} method="post" action={endpoint} onSubmit={submit}>
          {update ? (
            <>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Nova senha</span>
                <input name="password" type="password" className={styles.input}
                  autoComplete="new-password" maxLength={72} required />
              </label>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Confirme a nova senha</span>
                <input name="confirmation" type="password" className={styles.input}
                  autoComplete="new-password" maxLength={72} required />
              </label>
            </>
          ) : (
            <label className={styles.fieldGroup}>
              <span className={styles.label}>E-mail</span>
              <input name="email" type="email" className={styles.input}
                autoComplete="email" maxLength={254} required />
            </label>
          )}
          <button className={styles.submitBtn} disabled={pending}>
            {pending ? 'Aguarde…' : update ? 'Salvar nova senha' : 'Enviar link'}
          </button>
        </form>
      )}
      <div className={styles.securityNote}>
        <Link href={update && !done ? '/recuperar-senha' : '/'}>
          {update && !done ? 'Solicitar novo link' : 'Voltar ao login'}
        </Link>
      </div>
    </section>
  );
}
