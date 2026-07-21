'use client';

import { useEffect, useRef } from 'react';
import styles from './Hero.module.css';

export default function Hero() {
  const scrollRef = useRef(null);

  /* Parallax subtle effect on background */
  useEffect(() => {
    const hero = document.getElementById('inicio');
    const onScroll = () => {
      const scrollY = window.scrollY;
      if (hero) {
        hero.style.setProperty('--parallax-offset', `${scrollY * 0.35}px`);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToEmpreendimentos = () => {
    const el = document.getElementById('empreendimentos');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToContato = () => {
    const el = document.getElementById('contato');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="inicio"
      className={styles.hero}
      aria-label="Banner principal"
    >
      {/* Background image with parallax */}
      <div className={styles.bgImage} aria-hidden="true" />

      {/* Dark gradient overlay */}
      <div className={styles.overlay} aria-hidden="true" />

      {/* Content */}
      <div className={styles.content}>
        {/* Eyebrow */}
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowLine} aria-hidden="true" />
          <span>Qualidade · Transparência · Natureza</span>
        </div>

        {/* Main heading */}
        <h1 className={styles.heading}>
          Transformando{' '}
          <em className={styles.accent}>Sonhos</em>
          <br />
          em <em className={styles.accent}>Lares</em>
        </h1>

        {/* Subheading */}
        <p className={styles.subheading}>
          Mais de uma década criando empreendimentos residenciais de alto padrão,
          onde a arquitetura contemporânea se integra à natureza com sofisticação
          e transparência em cada etapa.
        </p>

        {/* CTA Buttons */}
        <div className={styles.actions}>
          <button
            className={`${styles.btnPrimary}`}
            onClick={scrollToEmpreendimentos}
            aria-label="Ver nossos empreendimentos"
          >
            Nossos Empreendimentos
          </button>
          <button
            className={`${styles.btnOutline}`}
            onClick={scrollToContato}
            aria-label="Falar com um especialista"
          >
            Fale com um Especialista
          </button>
        </div>

        {/* Trust badges */}
        <div className={styles.badges} aria-label="Diferenciais da empresa">
          {[
            { number: '15+',  label: 'Anos de Mercado' },
            { number: '500+', label: 'Unidades Entregues' },
            { number: '98%',  label: 'Índice de Satisfação' },
          ].map(({ number, label }) => (
            <div key={label} className={styles.badge}>
              <span className={styles.badgeNumber}>{number}</span>
              <span className={styles.badgeLabel}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        ref={scrollRef}
        className={styles.scrollIndicator}
        onClick={scrollToEmpreendimentos}
        aria-label="Rolar para baixo"
      >
        <span className={styles.scrollText}>Explorar</span>
        <span className={styles.scrollArrow} aria-hidden="true">
          <span /><span /><span />
        </span>
      </button>
    </section>
  );
}
