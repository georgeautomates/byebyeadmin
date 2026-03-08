import Link from 'next/link';
import { C, FONT, MONO } from '@/lib/constants';

const FOOTER_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/assessment', label: 'Free Assessment' },
  { href: '/contact', label: 'Contact' },
];

export function Footer() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${C.border}`,
        padding: '40px 24px',
        background: C.bgDark,
      }}
    >
      <div
        style={{
          maxWidth: 880,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        {/* Logo + tagline */}
        <div>
          <div style={{ fontFamily: FONT, fontSize: '1.05rem', fontWeight: 800 }}>
            <span style={{ color: C.accent }}>bye</span>
            <span style={{ color: '#F5F2EF' }}>bye</span>
            <span style={{ color: C.accent }}>admin</span>
          </div>
          <div style={{ color: 'rgba(245,242,239,0.5)', fontSize: '0.85rem', marginTop: 4 }}>
            AI automation for UK haulage operations
          </div>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: 'rgba(245,242,239,0.5)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'none',
                fontFamily: FONT,
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Email */}
        <div style={{ color: 'rgba(245,242,239,0.4)', fontSize: '0.85rem', fontFamily: MONO }}>
          george@byebyeadmin.com
        </div>
      </div>
    </footer>
  );
}
