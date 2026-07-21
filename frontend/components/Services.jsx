'use client';

import { useEffect, useRef } from 'react';
import styles from './Services.module.css';

const SERVICES = [
  {
    id: 'planejamento',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="6" y="6" width="36" height="36" rx="1" stroke="currentColor" strokeWidth="2"/>
        <line x1="6" y1="16" x2="42" y2="16" stroke="currentColor" strokeWidth="2"/>
        <line x1="16" y1="6" x2="16" y2="16" stroke="currentColor" strokeWidth="2"/>
        <line x1="32" y1="6" x2="32" y2="16" stroke="currentColor" strokeWidth="2"/>
        <line x1="14" y1="26" x2="24" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="14" y1="32" x2="34" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Planejamento Estratégico',
    description:
      'Do terreno à planta aprovada, cada etapa é orquestrada com rigor técnico e atenção às regulações urbanísticas, garantindo viabilidade e rentabilidade.',
    features: ['Estudo de viabilidade', 'Aprovação de projetos', 'Gestão de licenças'],
  },
  {
    id: 'construcao',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M8 40L24 10L40 40" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <line x1="14" y1="30" x2="34" y2="30" stroke="currentColor" strokeWidth="2"/>
        <circle cx="24" cy="10" r="3" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    title: 'Construção de Alto Padrão',
    description:
      'Utilizamos materiais premium e metodologias construtivas inovadoras para entregar obras que superam padrões de qualidade e superam as expectativas.',
    features: ['Gestão BIM', 'Materiais certificados', 'Controle de qualidade'],
  },
  {
    id: 'natureza',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M24 6C24 6 10 18 10 28C10 35.732 16.268 42 24 42C31.732 42 38 35.732 38 28C38 18 24 6 24 6Z" stroke="currentColor" strokeWidth="2"/>
        <line x1="24" y1="42" x2="24" y2="28" stroke="currentColor" strokeWidth="2"/>
        <path d="M24 28C24 28 16 22 14 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M24 34C24 34 30 30 34 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Integração com a Natureza',
    description:
      'Paisagismo biofílico, áreas verdes preservadas e design sustentável que criam harmonia entre o built environment e o ecossistema local.',
    features: ['Paisagismo assinado', 'Certificação verde', 'Áreas de preservação'],
  },
  {
    id: 'pos-venda',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2"/>
        <path d="M16 24L22 30L32 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Transparência & Pós-Venda',
    description:
      'Acompanhamento completo da obra com relatórios periódicos e suporte dedicado após a entrega das chaves, porque nosso compromisso não termina na venda.',
    features: ['Portal do cliente', 'Relatórios mensais', 'Assistência técnica'],
  },
];

export default function Services() {
  const cardsRef = useRef([]);

  /* Scroll-reveal animation */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.15 }
    );
    cardsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="servicos" className={styles.section} aria-labelledby="servicos-title">
      <div className={styles.container}>

        {/* Section header */}
        <div className={styles.header}>
          <span className="eyebrow" aria-label="Categoria">Nossos Serviços</span>
          <h2 id="servicos-title" className={styles.title}>
            Por que escolher a <em className="accent">Delta</em>?
          </h2>
          <p className={styles.subtitle}>
            Cada empreendimento é uma obra de arte habitável — planejada com
            precisão e entregue com orgulho.
          </p>
        </div>

        {/* Cards grid */}
        <div className={styles.grid} role="list">
          {SERVICES.map((service, i) => (
            <article
              key={service.id}
              ref={(el) => (cardsRef.current[i] = el)}
              className={`${styles.card} reveal`}
              style={{ transitionDelay: `${i * 0.12}s` }}
              role="listitem"
              aria-labelledby={`service-${service.id}-title`}
            >
              {/* Icon */}
              <div className={styles.iconWrap} aria-hidden="true">
                {service.icon}
              </div>

              {/* Content */}
              <div className={styles.cardBody}>
                <h3 id={`service-${service.id}-title`} className={styles.cardTitle}>
                  {service.title}
                </h3>
                <p className={styles.cardDescription}>{service.description}</p>

                {/* Feature list */}
                <ul className={styles.featureList} aria-label={`Recursos de ${service.title}`}>
                  {service.features.map((f) => (
                    <li key={f} className={styles.featureItem}>
                      <span className={styles.featureCheck} aria-hidden="true">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Terracota bottom accent line */}
              <div className={styles.accentLine} aria-hidden="true" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
