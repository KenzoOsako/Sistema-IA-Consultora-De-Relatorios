'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './Contact.module.css';

const INTERESTS = [
  'Lançamentos',
  'Imóveis em Obras',
  'Imóveis Prontos',
  'Parcerias/Investimento',
];

export default function Contact() {
  const [form, setForm]       = useState({ name: '', email: '', phone: '', interest: '', message: '' });
  const [status, setStatus]   = useState('idle'); // idle | sending | success | error
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.reveal').forEach((el, i) => {
            setTimeout(() => el.classList.add('visible'), i * 100);
          });
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    /* Replace with actual API call */
    await new Promise((r) => setTimeout(r, 1500));
    setStatus('success');
    setForm({ name: '', email: '', phone: '', interest: '', message: '' });
  };

  return (
    <section
      id="contato"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="contato-title"
    >
      <div className={styles.container}>

        {/* ── Info Column ── */}
        <div className={`${styles.infoCol} reveal`}>
          <span className="eyebrow">Contato</span>
          <h2 id="contato-title" className={styles.title}>
            Vamos construir <br />
            <em className="accent">juntos</em> o seu próximo lar
          </h2>
          <div className={styles.divider} aria-hidden="true" />
          <p className={styles.body}>
            Nossa equipe de especialistas está pronta para entender seu perfil
            e apresentar as melhores opções do nosso portfólio. Entre em contato
            e dê o primeiro passo.
          </p>

          {/* Contact details */}
          <ul className={styles.contactList} aria-label="Informações de contato">
            {[
              { icon: '✉', label: 'E-mail', value: 'contato@deltaempreendimentos.com.br' },
              { icon: '✆', label: 'Telefone', value: '+55 (11) 9 9999-0000' },
              { icon: '◎', label: 'Endereço', value: 'São Paulo, SP — Brasil' },
            ].map(({ icon, label, value }) => (
              <li key={label} className={styles.contactItem}>
                <span className={styles.contactIcon} aria-hidden="true">{icon}</span>
                <div>
                  <span className={styles.contactLabel}>{label}</span>
                  <span className={styles.contactValue}>{value}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Social links */}
          <div className={styles.socials}>
            <a
              href="https://www.instagram.com/deltaempreendimentos_/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="Instagram da Delta Empreendimentos"
            >
              Instagram
            </a>
            <a
              href="https://deltaempreendimentos.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="Site oficial da Delta Empreendimentos"
            >
              Website
            </a>
          </div>
        </div>

        {/* ── Form Column ── */}
        <div className={`${styles.formCol} reveal`} style={{ transitionDelay: '0.15s' }}>
          {status === 'success' ? (
            <div className={styles.successMsg} role="alert">
              <span className={styles.successIcon} aria-hidden="true">✓</span>
              <h3>Mensagem enviada!</h3>
              <p>Nossa equipe entrará em contato em até 24 horas.</p>
              <button className={styles.submitBtn} onClick={() => setStatus('idle')}>
                Enviar Nova Mensagem
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className={styles.form}
              aria-label="Formulário de contato"
              noValidate
            >
              <div className={styles.formRow}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="name" className={styles.label}>Nome completo *</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                    placeholder="Seu nome"
                    className={styles.input}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="email" className={styles.label}>E-mail *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    placeholder="seu@email.com"
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="phone" className={styles.label}>Telefone / WhatsApp</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    autoComplete="tel"
                    placeholder="(11) 9 9999-0000"
                    className={styles.input}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="interest" className={styles.label}>Interesse</label>
                  <select
                    id="interest"
                    name="interest"
                    value={form.interest}
                    onChange={handleChange}
                    className={styles.select}
                  >
                    <option value="">Selecione...</option>
                    {INTERESTS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="message" className={styles.label}>Mensagem</label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Conte-nos mais sobre o que você busca..."
                  className={styles.textarea}
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={status === 'sending'}
                aria-label="Enviar formulário de contato"
              >
                {status === 'sending' ? 'Enviando...' : 'Enviar Mensagem'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
