'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Fade, Tag, Btn } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';
import { POSTS, CATEGORIES, type Post } from '@/lib/blog-posts';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function FeaturedCard({ post }: { post: Post }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/blog/${post.slug}`}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          background: C.bgWhite,
          border: `1px solid ${C.border}`,
          borderLeft: `4px solid ${C.accent}`,
          borderRadius: 12,
          padding: 'clamp(28px, 4vw, 44px)',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          boxShadow: hovered
            ? '0 8px 32px rgba(31,41,55,0.1)'
            : '0 2px 8px rgba(31,41,55,0.04)',
          transform: hovered ? 'translateY(-2px)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Tag>{post.category}</Tag>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '0.75rem',
              color: C.textDim,
              letterSpacing: '0.04em',
            }}
          >
            {post.readTime}
          </span>
        </div>
        <h2
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(1.3rem, 3.5vw, 1.9rem)',
            fontWeight: 900,
            color: C.text,
            lineHeight: 1.2,
            margin: '0 0 14px',
          }}
        >
          {post.title}
        </h2>
        <p
          style={{
            fontFamily: FONT,
            color: C.textMid,
            fontSize: '1.02rem',
            lineHeight: 1.7,
            margin: '0 0 20px',
          }}
        >
          {post.excerpt}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '0.75rem',
              color: C.textLight,
              letterSpacing: '0.04em',
            }}
          >
            {formatDate(post.date)}
          </span>
          <span
            style={{
              fontFamily: FONT,
              fontSize: '0.9rem',
              fontWeight: 700,
              color: hovered ? C.accentHover : C.accent,
              transition: 'color 0.2s',
            }}
          >
            Read article →
          </span>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: Post }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/blog/${post.slug}`}
      style={{ textDecoration: 'none', display: 'block', height: '100%' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          background: C.bgWhite,
          border: `1px solid ${hovered ? C.accentBorder : C.border}`,
          borderRadius: 12,
          padding: '28px 24px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
          boxShadow: hovered
            ? '0 6px 24px rgba(31,41,55,0.09)'
            : '0 1px 4px rgba(31,41,55,0.04)',
          transform: hovered ? 'translateY(-2px)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Tag teal={post.category === 'Compliance'}>{post.category}</Tag>
          <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: C.textDim }}>{post.readTime}</span>
        </div>
        <h3
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.3,
            margin: '0 0 10px',
            flex: '0 0 auto',
          }}
        >
          {post.title}
        </h3>
        <p
          style={{
            fontFamily: FONT,
            color: C.textMid,
            fontSize: '0.92rem',
            lineHeight: 1.65,
            margin: '0 0 20px',
            flex: '1 1 auto',
          }}
        >
          {post.excerpt}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: C.textLight }}>
            {formatDate(post.date)}
          </span>
          <span
            style={{
              fontFamily: FONT,
              fontSize: '0.85rem',
              fontWeight: 700,
              color: hovered ? C.accentHover : C.accent,
              transition: 'color 0.2s',
            }}
          >
            Read →
          </span>
        </div>
      </div>
    </Link>
  );
}

function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div style={{ background: C.bgDark, padding: 'clamp(40px, 6vw, 64px) clamp(16px, 5vw, 24px)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <Tag teal>Newsletter</Tag>
        <h2
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)',
            fontWeight: 900,
            color: '#F5F2EF',
            margin: '16px 0 10px',
            lineHeight: 1.2,
          }}
        >
          The monthly briefing for UK fleet operators.
        </h2>
        <p
          style={{
            fontFamily: FONT,
            color: 'rgba(245,242,239,0.6)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            margin: '0 0 28px',
          }}
        >
          Practical AI automation updates. No fluff. Straight to your inbox once a month.
        </p>
        {submitted ? (
          <p style={{ fontFamily: FONT, color: C.accent, fontWeight: 700, fontSize: '1rem' }}>
            You are on the list. See you in your inbox.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) setSubmitted(true);
            }}
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                fontFamily: FONT,
                fontSize: '0.92rem',
                padding: '12px 16px',
                borderRadius: 8,
                border: `1px solid rgba(245,242,239,0.15)`,
                background: 'rgba(255,255,255,0.07)',
                color: '#F5F2EF',
                outline: 'none',
                minWidth: 240,
                flex: '1 1 auto',
                maxWidth: 320,
              }}
            />
            <Btn primary type="submit">
              Subscribe
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered =
    activeCategory === 'All'
      ? POSTS
      : POSTS.filter((p) => p.category === activeCategory);

  const [featured, ...rest] = filtered;

  return (
    <div style={{ paddingTop: 80, background: C.bg, minHeight: '100vh' }}>

      {/* Masthead */}
      <div style={{ background: C.bgDark }}>
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: 'clamp(40px, 6vw, 72px) clamp(16px, 5vw, 24px)',
          }}
        >
          <Fade>
            <Tag teal>Blog</Tag>
            <h1
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 900,
                color: '#F5F2EF',
                lineHeight: 1.1,
                margin: '16px 0 12px',
              }}
            >
              Straight talk on<br />
              <span style={{ color: C.accent }}>haulage AI.</span>
            </h1>
            <p
              style={{
                fontFamily: FONT,
                color: 'rgba(245,242,239,0.55)',
                fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
                lineHeight: 1.65,
                margin: 0,
                maxWidth: 520,
              }}
            >
              Practical guides for UK fleet operators on automating admin, staying compliant, and getting more from AI without the hype.
            </p>
          </Fade>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ background: C.bgWhite, borderBottom: `1px solid ${C.border}` }}>
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: '0 clamp(16px, 5vw, 24px)',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {CATEGORIES.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  fontFamily: FONT,
                  fontSize: '0.82rem',
                  fontWeight: active ? 700 : 600,
                  color: active ? '#FFFFFF' : C.textDim,
                  background: active ? C.accent : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: 'clamp(32px, 5vw, 56px) clamp(16px, 5vw, 24px)',
        }}
      >
        {filtered.length === 0 ? (
          <p style={{ fontFamily: FONT, color: C.textDim, textAlign: 'center', padding: '40px 0' }}>
            No posts in this category yet.
          </p>
        ) : (
          <>
            {/* Featured post */}
            {featured && (
              <Fade>
                <div style={{ marginBottom: 32 }}>
                  <FeaturedCard post={featured} />
                </div>
              </Fade>
            )}

            {/* Grid */}
            {rest.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 20,
                }}
              >
                {rest.map((post, i) => (
                  <Fade key={post.slug} delay={i * 0.06}>
                    <PostCard post={post} />
                  </Fade>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Newsletter CTA */}
      <NewsletterCTA />
    </div>
  );
}
