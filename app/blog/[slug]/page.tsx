import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import type { Metadata } from 'next';
import { C, FONT } from '@/lib/constants';

function getPostBySlug(slug: string) {
  const dir = path.join(process.cwd(), 'content/blog');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const { data, content } = matter(raw);
    const fileSlug = data.slug || file.replace(/\.mdx$/, '');
    if (fileSlug === slug) {
      return { data, content };
    }
  }
  return null;
}

export async function generateStaticParams() {
  const dir = path.join(process.cwd(), 'content/blog');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));
  return files.map(file => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const { data } = matter(raw);
    return { slug: data.slug || file.replace(/\.mdx$/, '') };
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post not found | ByeByeAdmin' };
  return {
    title: `${post.data.title} | ByeByeAdmin`,
    description: post.data.description || '',
    keywords: post.data.keywords || [],
  };
}

const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 {...props} style={{ color: C.text, fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800, lineHeight: 1.25, margin: '0 0 24px', fontFamily: FONT }} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props} style={{ color: C.text, fontSize: 22, fontWeight: 700, lineHeight: 1.3, margin: '40px 0 16px', fontFamily: FONT }} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props} style={{ color: C.text, fontSize: 18, fontWeight: 700, lineHeight: 1.35, margin: '32px 0 12px', fontFamily: FONT }} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} style={{ color: C.textMid, fontSize: 16, lineHeight: 1.75, margin: '0 0 20px', fontFamily: FONT }} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} style={{ color: C.accent, textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: FONT }} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} style={{ color: C.textMid, fontSize: 16, lineHeight: 1.75, margin: '0 0 20px', paddingLeft: 24, fontFamily: FONT }} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} style={{ color: C.textMid, fontSize: 16, lineHeight: 1.75, margin: '0 0 20px', paddingLeft: 24, fontFamily: FONT }} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} style={{ marginBottom: 8 }} />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong {...props} style={{ color: C.text, fontWeight: 700 }} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote {...props} style={{
      borderLeft: `3px solid ${C.accent}`,
      paddingLeft: 20,
      margin: '24px 0',
      color: C.textMid,
      fontStyle: 'italic',
    }} />
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '36px 0' }} />
  ),
};

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <main style={{ background: C.bg, minHeight: '100vh', fontFamily: FONT, padding: '80px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ color: C.textDim }}>Post not found.</p>
          <Link href="/blog" style={{ color: C.accent }}>Back to blog</Link>
        </div>
      </main>
    );
  }

  const { data, content } = post;

  return (
    <main style={{ background: C.bg, minHeight: '100vh', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: C.bgDark, padding: '72px 24px 56px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link href="/blog" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#9CA3AF',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            marginBottom: 24,
            letterSpacing: '0.03em',
          }}>
            Blog
          </Link>
          {data.date && (
            <time style={{
              display: 'block',
              color: '#6B7280',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              marginBottom: 12,
            }}>
              {formatDate(data.date)}
            </time>
          )}
          <h1 style={{
            color: '#fff',
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 800,
            lineHeight: 1.2,
            margin: 0,
          }}>
            {data.title}
          </h1>
          {data.description && (
            <p style={{
              color: '#9CA3AF',
              fontSize: 17,
              marginTop: 14,
              lineHeight: 1.6,
            }}>
              {data.description}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        <MDXRemote source={content} components={mdxComponents} />

        {/* CTA */}
        <div style={{
          background: C.accentDim,
          border: `1px solid ${C.accentBorder}`,
          borderRadius: 12,
          padding: '28px 32px',
          marginTop: 48,
        }}>
          <p style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>
            See how much admin your fleet could cut
          </p>
          <p style={{ color: C.textMid, fontSize: 15, margin: '0 0 16px', lineHeight: 1.6 }}>
            Take the free 3-minute assessment and get a personalised savings estimate for your operation.
          </p>
          <Link href="/assessment" style={{
            display: 'inline-block',
            background: C.accent,
            color: '#fff',
            padding: '10px 22px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
          }}>
            Take the assessment
          </Link>
        </div>
      </div>
    </main>
  );
}
