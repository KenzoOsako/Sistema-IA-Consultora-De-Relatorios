'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from './About.module.css';

const VALUES = [
  { label: 'Transparência total em cada etapa da obra' },
  { label: 'Materiais certificados e sustentáveis' },
  { label: 'Arquitetura integrada ao meio ambiente' },
  { label: 'Suporte completo do sonho à entrega das chaves' },
  { label: 'Projetos desenvolvidos com arquitetos premiados' },
];

export default function About() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.reveal').forEach((el, i) => {
            setTimeout(() => el.classList.add('visible'), i * 120);
          });
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="sobre"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="sobre-title"
    >
      <div className={styles.container}>

        {/* ── Image column (60%) ── */}
        <div className={`${styles.imageCol} reveal`}>
          <div className={styles.imageWrap}>
            <Image
              src="/images/about.jpg"
              alt="Equipe Delta Empreendimentos em reunião de planejamento"
              fill
              sizes="(max-width: 768px) 100vw, 55vw"
              style={{ objectFit: 'cover', objectPosition: 'center' }}
              className={styles.image}
              priority={false}
            />
            {/* Floating accent card */}
            <div className={styles.floatCard} aria-label="Prêmio de excelência">
              <span className={styles.floatNumber}>Δ</span>
              <span className={styles.floatLabel}>Excelência<br />Imobiliária</span>
            </div>
          </div>
        </div>

        {/* ── Text column (40%) ── */}
        <div className={styles.textCol}>
          <div className={`${styles.textInner} reveal`} style={{ transitionDelay: '0.1s' }}>

            <span className="eyebrow">Nossa História</span>

            <h2 id="sobre-title" className={styles.title}>
              Construindo com <em className="accent">propósito</em>{' '}
              há mais de uma década
            </h2>

            <div className={styles.divider} aria-hidden="true" />

            <p className={styles.body}>
              Fundada com a missão de transformar a relação das pessoas com o
              espaço que habitam, a Delta Empreendimentos nasceu da convicção de
              que qualidade de vida começa no lar — e que esse lar deve ser belo,
              funcional e harmônico com a natureza.
            </p>
            <p className={styles.body}>
              Atuamos em toda a cadeia do desenvolvimento imobiliário: da
              aquisição do terreno ao pós-venda, com transparência e excelência
              em cada etapa. Nossos empreendimentos são concebidos como
              comunidades vivas, não apenas conjuntos de unidades.
            </p>

            {/* Values list */}
            <ul className={styles.valueList} aria-label="Nossos valores e diferenciais">
              {VALUES.map(({ label }, i) => (
                <li
                  key={label}
                  className={`${styles.valueItem} reveal`}
                  style={{ transitionDelay: `${0.2 + i * 0.08}s` }}
                >
                  <span className={styles.valueDot} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>

            <button
              className={styles.ctaBtn}
              onClick={() => {
                document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
              }}
              aria-label="Conhecer mais sobre a empresa"
            >
              Falar com um Especialista
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
