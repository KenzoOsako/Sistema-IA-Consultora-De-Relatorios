'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '#inicio',          label: 'Início' },
  { href: '#empreendimentos', label: 'Empreendimentos' },
  { href: '#servicos',        label: 'Serviços' },
  { href: '#sobre',           label: 'Sobre' },
  { href: '#contato',         label: 'Contato' },
];

export default function Navbar() {
  const [scrolled,     setScrolled]     = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [activeSection,setActiveSection]= useState('inicio');
  const navRef = useRef(null);

  /* ── Scroll listener: toggles "scrolled" state ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Close mobile menu on outside click ── */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  /* ── Lock body scroll when mobile menu open ── */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleNavClick = (href) => {
    setMenuOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      ref={navRef}
      className={`${styles.navbar} ${scrolled ? styles.scrolled : styles.transparent}`}
      role="banner"
    >
      <div className={styles.inner}>

        {/* ── Logo ── */}
        <a
          href="#inicio"
          className={styles.logo}
          onClick={() => handleNavClick('#inicio')}
          aria-label="Delta Empreendimentos - Página Inicial"
        >
          <span className={styles.logoMark}>Δ</span>
          <span className={styles.logoText}>
            DELTA<br />
            <span className={styles.logoSub}>EMPREENDIMENTOS</span>
          </span>
        </a>

        {/* ── Desktop Navigation ── */}
        <nav className={styles.desktopNav} aria-label="Navegação principal">
          <ul className={styles.navList}>
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <button
                  className={`${styles.navLink} ${activeSection === href.replace('#','') ? styles.navLinkActive : ''}`}
                  onClick={() => handleNavClick(href)}
                  aria-label={`Ir para ${label}`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Desktop CTA ── */}
        <button
          className={`${styles.ctaBtn} ${scrolled ? styles.ctaBtnScrolled : ''}`}
          onClick={() => handleNavClick('#contato')}
          aria-label="Falar com um especialista"
        >
          Fale Conosco
        </button>

        {/* ── Hamburger (mobile) ── */}
        <button
          className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <span className={styles.bar} />
          <span className={styles.bar} />
          <span className={styles.bar} />
        </button>
      </div>

      {/* ── Mobile Overlay Menu ── */}
      <div
        id="mobile-menu"
        className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}
        aria-hidden={!menuOpen}
      >
        <nav aria-label="Navegação mobile">
          <ul className={styles.mobileNavList}>
            {NAV_LINKS.map(({ href, label }, i) => (
              <li key={href} style={{ animationDelay: `${i * 0.07}s` }}>
                <button
                  className={styles.mobileNavLink}
                  onClick={() => handleNavClick(href)}
                >
                  {label}
                </button>
              </li>
            ))}
            <li style={{ animationDelay: `${NAV_LINKS.length * 0.07}s` }}>
              <button
                className={styles.mobileCtaBtn}
                onClick={() => handleNavClick('#contato')}
              >
                Fale Conosco
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
