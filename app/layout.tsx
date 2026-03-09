import type { Metadata, Viewport } from 'next';
import { Nunito_Sans, JetBrains_Mono, Outfit } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { LenisProvider } from '@/components/LenisProvider';
import { CalendlyProvider } from '@/lib/calendly-context';
import Script from 'next/script';

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-outfit',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'ByeByeAdmin | AI Automation for UK Haulage Operations',
  description:
    'AI automation that handles order entry, invoicing, compliance and portal monitoring for UK fleet operators running 3–100 vehicles. Save 60+ hours a month.',
  keywords: ['haulage AI', 'fleet management', 'UK logistics automation', 'transport office software'],
  openGraph: {
    title: 'ByeByeAdmin | AI Automation for UK Haulage',
    description: 'Save 60+ hours a month. From £150/month.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunitoSans.variable} ${jetbrainsMono.variable} ${outfit.variable}`}>
      <head>
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-NFX2T4BT');`,
          }}
        />
        <Script
          id="vtag-ai-js"
          async
          src="https://r2.leadsy.ai/tag.js"
          data-pid="s7wcRIKsfE6YFH3r"
          data-version="062024"
        />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NFX2T4BT"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <LenisProvider>
          <CalendlyProvider>
            <Nav />
            <main>{children}</main>
            <Footer />
          </CalendlyProvider>
        </LenisProvider>
      </body>
    </html>
  );
}
