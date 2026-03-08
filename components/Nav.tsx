'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { C, FONT } from '@/lib/constants';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/assessment', label: 'Free Assessment' },
  { href: '/contact', label: 'Contact' },
];

// Hero section height — matches HeroScroll.tsx (450vh mobile, 500vh desktop)
const HERO_HEIGHT_VH_DESKTOP = 500;
const HERO_HEIGHT_VH_MOBILE = 450;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [overHero, setOverHero] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      const heroVh = window.innerWidth < 768 ? HERO_HEIGHT_VH_MOBILE : HERO_HEIGHT_VH_DESKTOP;
      const heroEnd = (heroVh / 100) * window.innerHeight;
      setScrolled(y > 20);
      setOverHero(isHome && y < heroEnd - 80);
    };
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [isHome]);

  const dark = isHome && overHero;

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        background: dark
          ? 'rgba(11,17,32,0.7)'
          : scrolled
            ? 'rgba(245,242,239,0.95)'
            : 'rgba(245,242,239,0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: dark
          ? '1px solid rgba(255,255,255,0.06)'
          : `1px solid ${scrolled ? C.border : 'transparent'}`,
        transition: 'all 0.4s ease',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 60,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: FONT, fontSize: '1.2rem', fontWeight: 800, color: C.accent }}>bye</span>
          <span style={{ fontFamily: FONT, fontSize: '1.2rem', fontWeight: 800, color: dark ? '#F5F2EF' : C.text }}>bye</span>
          <span style={{ fontFamily: FONT, fontSize: '1.2rem', fontWeight: 800, color: C.accent }}>admin</span>
        </Link>

        {/* Desktop nav links */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    fontFamily: FONT,
                    fontSize: '0.85rem',
                    color: dark
                      ? (active ? C.accent : 'rgba(245,242,239,0.7)')
                      : (active ? C.accent : C.textDim),
                    background: active ? (dark ? 'rgba(232,97,45,0.15)' : C.accentDim) : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '7px 14px',
                    borderRadius: 6,
                    fontWeight: active ? 700 : 600,
                    transition: 'all 0.2s',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Mobile hamburger button */}
        {isMobile && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '11px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 5,
              marginRight: -8,
            }}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? (
              <span style={{ fontFamily: FONT, fontSize: '1.6rem', lineHeight: 1, color: dark ? '#F5F2EF' : C.text, display: 'block', width: 22, textAlign: 'center' }}>×</span>
            ) : (
              <>
                <span style={{ display: 'block', width: 22, height: 2, background: dark ? '#F5F2EF' : C.text, borderRadius: 1 }} />
                <span style={{ display: 'block', width: 22, height: 2, background: dark ? '#F5F2EF' : C.text, borderRadius: 1 }} />
                <span style={{ display: 'block', width: 22, height: 2, background: dark ? '#F5F2EF' : C.text, borderRadius: 1 }} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Mobile menu overlay */}
      {isMobile && menuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 60,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(11,17,32,0.98)',
            zIndex: 998,
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 24px 40px',
            overflowY: 'auto',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontFamily: FONT,
                  fontSize: '1.15rem',
                  fontWeight: active ? 800 : 600,
                  color: active ? C.accent : '#F5F2EF',
                  textDecoration: 'none',
                  padding: '18px 0',
                  borderBottom: '1px solid rgba(245,242,239,0.08)',
                  display: 'block',
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/assessment"
            onClick={() => setMenuOpen(false)}
            style={{
              display: 'block',
              marginTop: 32,
              background: C.accent,
              color: '#FFFFFF',
              textAlign: 'center',
              padding: '16px',
              borderRadius: 8,
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            Free Assessment →
          </Link>
        </div>
      )}
    </nav>
  );
}
