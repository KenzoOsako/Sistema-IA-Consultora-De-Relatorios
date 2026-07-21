'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from './Developments.module.css';

const EMPREENDIMENTOS = [
  {
    id: 'reserva-verde',
    image: '/images/empreendimento1.jpg',
    tag: 'Lançamento',
    location: 'São Paulo, SP',
    title: 'Reserva Verde',
    description:
      'Condomínio fechado de alto padrão com 120 unidades, integrado à Mata Atlântica. Arquitetura contemporânea com grandes varandas e vistas panorâmicas.',
    area: 'De 180 a 320 m²',
    units: '120 unidades',
    status: 'Lançamento',
  },
  {
    id: 'alto-das-pedras',
    image: '/images/hero.jpg',
    tag: 'Em Obras',
    location: 'Campinas, SP',
    title: 'Alto das Pedras',
    description:
      'Residências exclusivas em terrenos amplos, com design biofílico que respeita a topografia natural do terreno e a vegetação nativa existente.',
    area: 'De 250 a 500 m²',
    units: '64 lotes',
    status: 'Entrega 2026',
  },
  {
    id: 'villa-serena',
    image: '/images/about.jpg',
    tag: 'Entregue',
    location: 'Indaiatuba, SP',
    title: 'Villa Serena',
    description:
      'Primeiro empreendimento certificado verde da região, entregue com 98% das unidades vendidas e índice de satisfação acima da média do mercado.',
    area: 'De 120 a 200 m²',
    units: '200 apartamentos',
    status: 'Entregue',
  },
];

const TAG_COLORS = {
  'Lançamento': 'tagLaunch',
  'Em Obras':   'tagConstruction',
  'Entregue':   'tagDelivered',
};

export default function Developments() {
  const cardsRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.12 }
    );
    cardsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="empreendimentos"
      className={styles.section}
      aria-labelledby="empreendimentos-title"
    >
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <span className="eyebrow">Portfólio</span>
          <h2 id="empreendimentos-title" className={styles.title}>
            Nossos <em className="accent">Empreendimentos</em>
          </h2>
          <p className={styles.subtitle}>
            Cada projeto é concebido como um legado — lugares que as pessoas
            se orgulham de chamar de lar.
          </p>
        </div>

        {/* Cards */}
        <div className={styles.grid} role="list">
          {EMPREENDIMENTOS.map((item, i) => (
            <article
              key={item.id}
              ref={(el) => (cardsRef.current[i] = el)}
              className={`${styles.card} reveal`}
              style={{ transitionDelay: `${i * 0.14}s` }}
              role="listitem"
              aria-labelledby={`dev-${item.id}-title`}
            >
              {/* Image */}
              <div className={styles.imageWrap}>
                <Image
                  src={item.image}
                  alt={`Foto do empreendimento ${item.title} em ${item.location}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{ objectFit: 'cover' }}
                  className={styles.image}
                />
                {/* Image overlay */}
                <div className={styles.imageOverlay} aria-hidden="true" />

                {/* Status tag */}
                <span
                  className={`${styles.tag} ${styles[TAG_COLORS[item.tag]]}`}
                  aria-label={`Status: ${item.tag}`}
                >
                  {item.tag}
                </span>

                {/* Location pill */}
                <span className={styles.location} aria-label={`Localização: ${item.location}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor"/>
                  </svg>
                  {item.location}
                </span>
              </div>

              {/* Body */}
              <div className={styles.body}>
                <h3 id={`dev-${item.id}-title`} className={styles.cardTitle}>
                  {item.title}
                </h3>
                <p className={styles.cardDesc}>{item.description}</p>

                {/* Meta row */}
                <div className={styles.meta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Área</span>
                    <span className={styles.metaValue}>{item.area}</span>
                  </div>
                  <div className={styles.metaDivider} aria-hidden="true" />
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Unidades</span>
                    <span className={styles.metaValue}>{item.units}</span>
                  </div>
                  <div className={styles.metaDivider} aria-hidden="true" />
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Status</span>
                    <span className={styles.metaValue}>{item.status}</span>
                  </div>
                </div>

                <button
                  className={styles.cardBtn}
                  aria-label={`Saiba mais sobre ${item.title}`}
                  onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Saiba Mais
                  <span className={styles.btnArrow} aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* View all CTA */}
        <div className={styles.viewAll}>
          <button
            className="btn btn--outline-primary"
            onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
            aria-label="Ver todos os empreendimentos"
          >
            Ver Todos os Empreendimentos
          </button>
        </div>
      </div>
    </section>
  );
}
