import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import type { Metadata } from 'next';
import { C, FONT } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'ByeByeAdmin | Blog — AI Automation Insights for UK Haulage',
  description: 'Practical guides and insights for UK fleet managers on AI automation, admin reduction, and running a leaner haulage operation.',
};

interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description: string;
}

function getPosts(): PostMeta[] {
  const dir = path.join(process.cwd(), 'content/blog');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));
  const posts = files.map(file => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const { data } = matter(raw);
    return {
      slug: data.slug || file.replace(/\.mdx$/, ''),
      title: data.title || 'Untitled',
      date: data.date || '',
      description: data.description || '',
    };
  });
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogPage() {
  const posts = getPosts();

  return (
    <main style={{ background: C.bg, minHeight: '100vh', fontFamily: FONT }}>
      {/* Header banner */}
      <div style={{ background: C.bgDark, padding: '72px 24px 56px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <span style={{
            display: 'inline-block',
            background: C.accentDim,
            color: C.accent,
            border: `1px solid ${C.accentBorder}`,
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            Blog
          </span>
          <h1 style={{
            color: '#fff',
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 800,
            lineHeight: 1.2,
            margin: 0,
          }}>
            AI automation for UK haulage
          </h1>
          <p style={{
            color: '#9CA3AF',
            fontSize: 17,
            marginTop: 12,
            lineHeight: 1.6,
          }}>
            Practical guides for fleet managers on cutting admin, boosting visibility, and running a leaner operation.
          </p>
        </div>
      </div>

      {/* Post list */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        {posts.length === 0 ? (
          <p style={{ color: C.textDim, fontSize: 16 }}>No posts yet. Check back soon.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {posts.map(post => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none' }}
              >
                <article style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '28px 32px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}>
                  {post.date && (
                    <time style={{
                      display: 'block',
                      color: C.textDim,
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      marginBottom: 10,
                    }}>
                      {formatDate(post.date)}
                    </time>
                  )}
                  <h2 style={{
                    color: C.text,
                    fontSize: 20,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    margin: '0 0 10px',
                  }}>
                    {post.title}
                  </h2>
                  {post.description && (
                    <p style={{
                      color: C.textMid,
                      fontSize: 15,
                      lineHeight: 1.6,
                      margin: '0 0 16px',
                    }}>
                      {post.description}
                    </p>
                  )}
                  <span style={{
                    color: C.accent,
                    fontSize: 14,
                    fontWeight: 700,
                  }}>
                    Read more
                  </span>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
