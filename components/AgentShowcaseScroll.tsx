'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { C, FONT, MONO } from '@/lib/constants';
import { Tag } from '@/components/ui';

gsap.registerPlugin(ScrollTrigger);

// ── Per-agent background word sets ───────────────────────────────────────────
const AGENT_WORDS: string[][] = [
  ['ORDER ENTRY', 'EMAIL', 'PORTAL', 'BOOKING', 'MANIFEST', 'PICKUP', 'DELIVERY', 'PALLET', 'RATE CARD', 'LOAD'],
  ['POD', 'DELIVERY NOTE', 'MATCHED', 'SIGNED', 'RECONCILED', 'INVOICE', 'JOB #', 'PROOF', 'DISCREPANCY', 'FILED'],
  ['TACHOGRAPH', 'WTD', 'DRIVER HOURS', 'REST BREAK', 'O-LICENCE', 'COMPLIANCE', 'INFRINGEMENT', 'DVSA', 'HOURS', 'SCHEDULE'],
  ['INVOICE', 'RATE', 'PAYMENT', 'CREDIT NOTE', 'AGED DEBT', 'NET 30', 'FUEL SURCHARGE', 'BILLING', 'XERO', 'REMITTANCE'],
  ['ROUTE', 'ETA', 'STOPS', 'DISTANCE', 'CAPACITY', 'SCHEDULE', 'WINDOWS', 'MANIFEST', 'OPTIMISED', 'CORRIDOR'],
  ['EMAIL', 'STATUS UPDATE', 'ETA', 'REPLY', 'CHASE', 'CUSTOMER', 'QUERY', 'TRACKING', 'NOTIFICATION', 'CONFIRMATION'],
];

// Stable positions matching ChaosWordField layout
const WORD_POSITIONS = [
  { left: '7%',  top: '10%', rotate: '-8deg',  opacity: 0.042, size: '0.58rem', delay: '0s',   duration: '20s' },
  { left: '21%', top: '4%',  rotate: '4deg',   opacity: 0.034, size: '0.54rem', delay: '2.1s', duration: '24s' },
  { left: '54%', top: '7%',  rotate: '-3deg',  opacity: 0.048, size: '0.62rem', delay: '0.7s', duration: '17s' },
  { left: '74%', top: '14%', rotate: '6deg',   opacity: 0.036, size: '0.56rem', delay: '3.4s', duration: '22s' },
  { left: '87%', top: '3%',  rotate: '-11deg', opacity: 0.038, size: '0.5rem',  delay: '1.2s', duration: '27s' },
  { left: '3%',  top: '34%', rotate: '9deg',   opacity: 0.044, size: '0.6rem',  delay: '4.5s', duration: '21s' },
  { left: '32%', top: '29%', rotate: '-5deg',  opacity: 0.032, size: '0.52rem', delay: '0.3s', duration: '26s' },
  { left: '67%', top: '27%', rotate: '12deg',  opacity: 0.04,  size: '0.58rem', delay: '5.1s', duration: '18s' },
  { left: '89%', top: '42%', rotate: '-7deg',  opacity: 0.034, size: '0.54rem', delay: '2.8s', duration: '23s' },
  { left: '14%', top: '54%', rotate: '4deg',   opacity: 0.046, size: '0.62rem', delay: '1.8s', duration: '25s' },
];

function AgentWordField({ agentIndex }: { agentIndex: number }) {
  const words = AGENT_WORDS[agentIndex];
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' }}
    >
      <style>{`
        @keyframes agWordDrift {
          0%   { transform: translateY(0) rotate(var(--awr)); opacity: var(--awo); }
          80%  { opacity: var(--awo); }
          100% { transform: translateY(-110px) rotate(calc(var(--awr) + 4deg)); opacity: 0; }
        }
      `}</style>
      {WORD_POSITIONS.map((cfg, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: cfg.left,
            top: cfg.top,
            fontFamily: MONO,
            fontSize: cfg.size,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#2D8B8B',
            opacity: cfg.opacity,
            animation: `agWordDrift ${cfg.duration} linear ${cfg.delay} infinite`,
            ['--awr' as string]: cfg.rotate,
            ['--awo' as string]: String(cfg.opacity),
            whiteSpace: 'nowrap',
          }}
        >
          {words[i % words.length]}
        </div>
      ))}
    </div>
  );
}

interface AgentDef {
  id: string;
  badge: string;
  badgeColor: string;
  headline: string;
  highlight: string;
  sub: string;
  metricLabel: string;
  metricValue: string;
  show: [number, number];
}

const AGENTS: AgentDef[] = [
  {
    id: 'agent-0',
    badge: 'Order Entry',
    badgeColor: C.accent,
    headline: 'Every inbound order',
    highlight: 'handled in under 3 seconds.',
    sub: 'It reads emails, WhatsApp messages, and customer portals, converting them into jobs automatically. Vague requests, misspelled names, \u2018same as last week\u2019: it figures it out.',
    metricLabel: 'Orders processed today',
    metricValue: '47',
    show: [0, 0.15],
  },
  {
    id: 'agent-1',
    badge: 'POD Matching',
    badgeColor: C.teal,
    headline: 'Every delivery note',
    highlight: 'matched before you blink.',
    sub: 'Incoming PODs cross-referenced against open jobs in real time. Digital, photographed, or barely legible: matched. Discrepancies flagged. Zero manual checking.',
    metricLabel: 'Match accuracy',
    metricValue: '100%',
    show: [0.17, 0.32],
  },
  {
    id: 'agent-2',
    badge: 'Compliance',
    badgeColor: C.accent,
    headline: 'Tachograph chaos',
    highlight: 'turned into clean records.',
    sub: 'Driver hours, rest periods, O-licence deadlines: all monitored. Issues flagged before they become fines. Audit-ready reports generated automatically.',
    metricLabel: 'Violations this quarter',
    metricValue: 'Zero',
    show: [0.34, 0.49],
  },
  {
    id: 'agent-3',
    badge: 'Invoicing',
    badgeColor: C.teal,
    headline: 'Invoice out',
    highlight: 'the moment the job\u2019s done.',
    sub: 'No end-of-week batch. No chasing the right rate. It applies your agreed price and sends the invoice automatically, with the POD attached.',
    metricLabel: 'Invoiced today',
    metricValue: '£12,450',
    show: [0.51, 0.66],
  },
  {
    id: 'agent-4',
    badge: 'Route Planning',
    badgeColor: C.accent,
    headline: 'Every run optimised',
    highlight: 'before the driver leaves.',
    sub: 'Live traffic, delivery windows, driver hours, vehicle capacity: all factored in automatically. Manifest sent to the driver. No more planning runs by hand.',
    metricLabel: 'Routes planned today',
    metricValue: '23',
    show: [0.68, 0.83],
  },
  {
    id: 'agent-5',
    badge: 'Customer Comms',
    badgeColor: C.teal,
    headline: 'Every customer query',
    highlight: 'answered in under 4 seconds.',
    sub: 'Status updates, ETA queries, booking confirmations: handled instantly from live tracking data. Only escalated when a human decision is genuinely needed.',
    metricLabel: 'Avg. response time',
    metricValue: '3.2s',
    show: [0.85, 1.0],
  },
];

// ── Shared CSS keyframes ──────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes agBlink  { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes agPulse  { 0%,100%{opacity:0.35} 50%{opacity:1} }
  @keyframes agDot1   { 0%,80%,100%{opacity:0.2} 20%{opacity:1} }
  @keyframes agDot2   { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
  @keyframes agDot3   { 0%,80%,100%{opacity:0.2} 60%{opacity:1} }
  @keyframes agFillA  { 0%{width:0} 100%{width:82%} }
  @keyframes agFillB  { 0%{width:0} 100%{width:91%} }
  @keyframes agFillC  { 0%{width:0} 100%{width:68%} }
  @keyframes agRow1   { 0%,15%{opacity:0;transform:translateY(6px)} 20%,100%{opacity:1;transform:translateY(0)} }
  @keyframes agRow2   { 0%,25%{opacity:0;transform:translateY(6px)} 30%,100%{opacity:1;transform:translateY(0)} }
  @keyframes agRow3   { 0%,35%{opacity:0;transform:translateY(6px)} 40%,100%{opacity:1;transform:translateY(0)} }
  @keyframes agRow4   { 0%,45%{opacity:0;transform:translateY(6px)} 50%,100%{opacity:1;transform:translateY(0)} }
  @keyframes agRow5   { 0%,55%{opacity:0;transform:translateY(6px)} 60%,100%{opacity:1;transform:translateY(0)} }
  @keyframes agMatch  { 0%,50%{opacity:0;transform:scale(0.9)} 65%,100%{opacity:1;transform:scale(1)} }
  @keyframes agLine   { 0%{stroke-dashoffset:120} 60%,100%{stroke-dashoffset:0} }
  @keyframes agReply  { 0%,55%{opacity:0;transform:translateY(8px)} 70%,100%{opacity:1;transform:translateY(0)} }
`;

// ── Shared card shell ─────────────────────────────────────────────────────────
function MockCard({ children, accentColor = '#E8612D', isMobile }: { children: React.ReactNode; accentColor?: string; isMobile?: boolean }) {
  return (
    <div style={{
      background: 'rgba(8,13,27,0.92)',
      border: `1px solid ${accentColor}28`,
      borderRadius: 14,
      padding: isMobile ? '14px 14px' : '22px 22px',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: `0 0 40px -10px ${accentColor}30, 0 24px 64px rgba(0,0,0,0.6)`,
      maxWidth: 480,
      width: '100%',
    }}>
      {children}
    </div>
  );
}

function CardHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(245,242,239,0.07)' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px 2px ${color}` }} />
      <span style={{ fontFamily: MONO, fontSize: '0.62rem', color, letterSpacing: '0.14em', textTransform: 'uppercase' as const, fontWeight: 700 }}>{label}</span>
    </div>
  );
}

function MonoRow({ label, value, dimValue }: { label: string; value: string; dimValue?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
      <span style={{ fontFamily: MONO, fontSize: '0.66rem', color: 'rgba(245,242,239,0.3)', minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: '0.66rem', color: dimValue ? 'rgba(245,242,239,0.45)' : 'rgba(245,242,239,0.82)' }}>{value}</span>
    </div>
  );
}

// ── Mock UI 1: Order Entry ───────────────────────────────────────────────────
function OrderEntryMock({ isMobile }: { isMobile?: boolean }) {
  return (
    <MockCard accentColor={C.accent} isMobile={isMobile}>
      <CardHeader label="Order Entry Agent · Live" color={C.accent} />

      {/* Raw email */}
      <div style={{ background: 'rgba(245,242,239,0.04)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: '0.6rem', color: 'rgba(245,242,239,0.3)', marginBottom: 4 }}>
          From: mark@johnson-logistics.co.uk · 09:42
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.72rem', color: 'rgba(245,242,239,0.55)', lineHeight: 1.55 }}>
          &quot;hi can you do Dave&apos;s usual for tomorrow please? 12 pallets mixed ambient, deliver to Tesco DC Thurrock&quot;
          <span style={{ animation: 'agBlink 1s ease infinite' }}>▍</span>
        </div>
      </div>

      {/* Processing */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot1 1.2s ease infinite' }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot2 1.2s ease infinite' }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot3 1.2s ease infinite' }} />
        <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.accent, letterSpacing: '0.1em' }}>PARSING · 2.8s</span>
      </div>

      {/* Structured output */}
      <div style={{ background: 'rgba(232,97,45,0.08)', border: '1px solid rgba(232,97,45,0.28)', borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.accent, letterSpacing: '0.12em' }}>ORDER #JL-4821</span>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#4ADE80', letterSpacing: '0.08em' }}>✓ CONFIRMED</span>
        </div>
        <MonoRow label="Customer" value="Johnson Logistics" />
        <MonoRow label="Collection" value="Dave's - Unit 4, Thurrock" />
        <MonoRow label="Goods" value="12 × Mixed Ambient Pallets" />
        <MonoRow label="Date" value="Tomorrow · 08:00" />
        <MonoRow label="Rate" value="£245.00" />
      </div>
    </MockCard>
  );
}

// ── Mock UI 2: POD Matching ───────────────────────────────────────────────────
function PODMatchingMock({ isMobile }: { isMobile?: boolean }) {
  return (
    <MockCard accentColor={C.teal} isMobile={isMobile}>
      <CardHeader label="POD Matching Agent · Live" color={C.teal} />

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 10, alignItems: isMobile ? 'stretch' : 'center' }}>
        {/* Incoming POD */}
        <div style={{ flex: 1, background: 'rgba(45,139,139,0.07)', border: '1px solid rgba(45,139,139,0.22)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontFamily: MONO, fontSize: '0.58rem', color: 'rgba(245,242,239,0.3)', marginBottom: 6, letterSpacing: '0.1em' }}>INCOMING POD</div>
          <MonoRow label="Job" value="#4821" />
          <MonoRow label="Customer" value="Tesco DC" />
          <MonoRow label="Pallets" value="12" />
          <MonoRow label="Signed" value="14:32" />
          <MonoRow label="Driver" value="M. Hughes" />
        </div>

        {/* Connecting SVG line — desktop only */}
        {!isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <svg width="32" height="60" style={{ overflow: 'visible' }}>
              <line x1="16" y1="0" x2="16" y2="60"
                stroke={C.teal} strokeWidth="1.5" strokeDasharray="120" strokeDashoffset="0"
                style={{ animation: 'agLine 1.4s ease-out infinite' }}
              />
            </svg>
          </div>
        )}

        {/* Open job */}
        <div style={{ flex: 1, background: 'rgba(45,139,139,0.07)', border: '1px solid rgba(45,139,139,0.22)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontFamily: MONO, fontSize: '0.58rem', color: 'rgba(245,242,239,0.3)', marginBottom: 6, letterSpacing: '0.1em' }}>OPEN JOB</div>
          <MonoRow label="Job" value="#4821" />
          <MonoRow label="Customer" value="Tesco DC" />
          <MonoRow label="Pallets" value="12" />
          <MonoRow label="ETA" value="14:00" />
          <MonoRow label="Driver" value="M. Hughes" />
        </div>
      </div>

      {/* Match result */}
      <div style={{
        marginTop: 12,
        background: 'rgba(45,139,139,0.12)',
        border: '1px solid rgba(45,139,139,0.4)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        animation: 'agMatch 2s ease infinite',
      }}>
        <span style={{ fontFamily: MONO, fontSize: '0.66rem', color: 'rgba(245,242,239,0.6)' }}>Confidence score</span>
        <span style={{ fontFamily: MONO, fontSize: '0.88rem', color: C.teal, fontWeight: 700 }}>99.8% - MATCHED ✓</span>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        {['Filed to TMS', 'Invoice triggered', 'POD archived'].map((tag) => (
          <span key={tag} style={{ fontFamily: MONO, fontSize: '0.58rem', color: 'rgba(245,242,239,0.35)', background: 'rgba(245,242,239,0.05)', borderRadius: 4, padding: '3px 7px' }}>{tag}</span>
        ))}
      </div>
    </MockCard>
  );
}

// ── Mock UI 3: Compliance ─────────────────────────────────────────────────────
function ComplianceMock({ isMobile }: { isMobile?: boolean }) {
  const drivers = [
    { name: 'M. Hughes',    hours: '8h 20m', fill: 'agFillA', pct: '82%', status: 'COMPLIANT', color: '#4ADE80' },
    { name: 'S. Patel',     hours: '9h 05m', fill: 'agFillB', pct: '91%', status: 'REVIEW',    color: C.accent },
    { name: 'D. Williams',  hours: '6h 45m', fill: 'agFillC', pct: '68%', status: 'COMPLIANT', color: '#4ADE80' },
  ];

  return (
    <MockCard accentColor={C.accent} isMobile={isMobile}>
      <CardHeader label="Compliance Agent · Live" color={C.accent} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: 'rgba(245,242,239,0.3)', letterSpacing: '0.1em' }}>DAILY HOURS · WTD LIMIT: 10h</span>
        <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#4ADE80' }}>Auto-monitored ✓</span>
      </div>

      {drivers.map((d, i) => (
        <div key={d.name} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: MONO, fontSize: '0.68rem', color: 'rgba(245,242,239,0.75)' }}>{d.name}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: '0.64rem', color: 'rgba(245,242,239,0.4)' }}>{d.hours}</span>
              <span style={{ fontFamily: MONO, fontSize: '0.58rem', color: d.color, background: `${d.color}18`, borderRadius: 4, padding: '2px 6px' }}>{d.status}</span>
            </div>
          </div>
          <div style={{ background: 'rgba(245,242,239,0.06)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 4,
              background: d.status === 'REVIEW' ? C.accent : C.teal,
              animation: `${d.fill} 2s ease-out ${i * 0.3}s both infinite`,
              boxShadow: `0 0 8px ${d.status === 'REVIEW' ? C.accent : C.teal}`,
            }} />
          </div>
        </div>
      ))}

      <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(232,97,45,0.07)', border: '1px solid rgba(232,97,45,0.2)', borderRadius: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.accent, letterSpacing: '0.1em', marginBottom: 4 }}>ALERT</div>
        <div style={{ fontFamily: MONO, fontSize: '0.68rem', color: 'rgba(245,242,239,0.65)' }}>
          S. Patel approaching 10h WTD limit - rest break required by 16:45. Dispatcher notified.
        </div>
      </div>
    </MockCard>
  );
}

// ── Mock UI 4: Invoicing ──────────────────────────────────────────────────────
function InvoicingMock({ isMobile }: { isMobile?: boolean }) {
  const lines = [
    { job: '#4818', customer: 'Tesco DC Thurrock',   rate: '£380.00', anim: 'agRow1' },
    { job: '#4819', customer: 'Johnson Logistics',   rate: '£245.00', anim: 'agRow2' },
    { job: '#4820', customer: 'Asda Lutterworth',    rate: '£520.00', anim: 'agRow3' },
    { job: '#4821', customer: 'Lidl DC Avonmouth',   rate: '£310.00', anim: 'agRow4' },
    { job: '#4822', customer: 'Morrisons Bridgwater',rate: '£418.00', anim: 'agRow5' },
  ];

  return (
    <MockCard accentColor={C.teal} isMobile={isMobile}>
      <CardHeader label="Invoicing Agent · Live" color={C.teal} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: 'rgba(245,242,239,0.3)', letterSpacing: '0.08em' }}>TODAY&apos;S INVOICES - AUTO-GENERATED</span>
        <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#4ADE80' }}>Sent ✓</span>
      </div>

      <div style={{ borderTop: '1px solid rgba(245,242,239,0.07)' }}>
        {lines.map((l) => (
          <div key={l.job} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '7px 0',
            borderBottom: '1px solid rgba(245,242,239,0.05)',
            animation: `${l.anim} 4s ease both infinite`,
          }}>
            <div>
              <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: C.teal, marginRight: 8 }}>{l.job}</span>
              <span style={{ fontFamily: MONO, fontSize: '0.68rem', color: 'rgba(245,242,239,0.65)' }}>{l.customer}</span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: 'rgba(245,242,239,0.85)', fontWeight: 700 }}>{l.rate}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
        <span style={{ fontFamily: MONO, fontSize: '0.68rem', color: 'rgba(245,242,239,0.4)', letterSpacing: '0.08em' }}>TODAY&apos;S TOTAL</span>
        <span style={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 900, color: C.teal, letterSpacing: '-0.02em' }}>£12,450</span>
      </div>
    </MockCard>
  );
}

// ── Mock UI 5: Route Planning ─────────────────────────────────────────────────
function RoutePlanningMock({ isMobile }: { isMobile?: boolean }) {
  const stops = [
    { stop: '01', customer: 'Tesco DC Swindon',    eta: '07:45', load: '8 plt',  anim: 'agRow1' },
    { stop: '02', customer: 'Asda Avonmouth',      eta: '09:10', load: '6 plt',  anim: 'agRow2' },
    { stop: '03', customer: 'Lidl Bristol East',   eta: '10:35', load: '12 plt', anim: 'agRow3' },
    { stop: '04', customer: 'Co-op Chippenham',    eta: '12:20', load: '4 plt',  anim: 'agRow4' },
  ];

  return (
    <MockCard accentColor={C.accent} isMobile={isMobile}>
      <CardHeader label="Route Planning Agent · Live" color={C.accent} />

      {/* Dispatcher request */}
      <div style={{ background: 'rgba(245,242,239,0.04)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: '0.6rem', color: 'rgba(245,242,239,0.3)', marginBottom: 4 }}>
          From: dispatch@haulco.co.uk · 07:18
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.72rem', color: 'rgba(245,242,239,0.55)', lineHeight: 1.55 }}>
          &quot;Can you plan tomorrow&apos;s runs? 8 drops, Thurrock to Bristol corridor, mixed loads&quot;
          <span style={{ animation: 'agBlink 1s ease infinite' }}>▍</span>
        </div>
      </div>

      {/* Processing */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot1 1.2s ease infinite' }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot2 1.2s ease infinite' }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot3 1.2s ease infinite' }} />
        <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.accent, letterSpacing: '0.1em' }}>CALCULATING · 1.4s</span>
      </div>

      {/* Route table */}
      <div style={{ background: 'rgba(232,97,45,0.08)', border: '1px solid rgba(232,97,45,0.28)', borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.accent, letterSpacing: '0.12em' }}>OPTIMISED ROUTE · 8 STOPS</span>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#4ADE80' }}>✓ READY</span>
        </div>
        {/* Column headers */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 5, paddingBottom: 5, borderBottom: '1px solid rgba(245,242,239,0.07)' }}>
          <span style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.28)', width: 22 }}>#</span>
          <span style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.28)', flex: 2 }}>CUSTOMER</span>
          <span style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.28)', width: 38 }}>ETA</span>
          <span style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.28)', width: 38 }}>LOAD</span>
        </div>
        {stops.map((row) => (
          <div key={row.stop} style={{
            display: 'flex',
            gap: 6,
            padding: '4px 0',
            borderBottom: '1px solid rgba(245,242,239,0.04)',
            animation: `${row.anim} 4s ease both infinite`,
          }}>
            <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: C.accent, width: 22 }}>{row.stop}</span>
            <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: 'rgba(245,242,239,0.65)', flex: 2 }}>{row.customer}</span>
            <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: 'rgba(245,242,239,0.45)', width: 38 }}>{row.eta}</span>
            <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: 'rgba(245,242,239,0.45)', width: 38 }}>{row.load}</span>
          </div>
        ))}
      </div>

      {/* Stat chips */}
      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, background: 'rgba(245,242,239,0.04)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' as const }}>
          <div style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.3)', letterSpacing: '0.08em' }}>DIST SAVED</div>
          <div style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 700, color: C.accent, marginTop: 2 }}>14%</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(245,242,239,0.04)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' as const }}>
          <div style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.3)', letterSpacing: '0.08em' }}>DRIVER HRS</div>
          <div style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 700, color: C.teal, marginTop: 2 }}>9h 20m</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(245,242,239,0.04)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' as const }}>
          <div style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.3)', letterSpacing: '0.08em' }}>ON TIME</div>
          <div style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 700, color: '#4ADE80', marginTop: 2 }}>✓</div>
        </div>
      </div>
    </MockCard>
  );
}

// ── Mock UI 6: Customer Comms ─────────────────────────────────────────────────
function CustomerCommsMock({ isMobile }: { isMobile?: boolean }) {
  return (
    <MockCard accentColor={C.accent} isMobile={isMobile}>
      <CardHeader label="Customer Comms Agent · Live" color={C.accent} />

      {/* Inbound email */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: 'rgba(245,242,239,0.3)' }}>From: sarah@megaloads.co.uk</span>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: 'rgba(245,242,239,0.25)' }}>09:41:18</span>
        </div>
        <div style={{ background: 'rgba(245,242,239,0.04)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontFamily: MONO, fontSize: '0.7rem', color: 'rgba(245,242,239,0.55)', lineHeight: 1.5 }}>
            What&apos;s the ETA on our delivery to Lutterworth? Driver hasn&apos;t checked in.
          </div>
        </div>
      </div>

      {/* Agent processing */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingLeft: 4 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot1 1.2s ease infinite' }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot2 1.2s ease infinite' }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'agDot3 1.2s ease infinite' }} />
        <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: 'rgba(245,242,239,0.3)' }}>Checking live tracking · 1.1s</span>
      </div>

      {/* Auto-reply */}
      <div style={{
        background: 'rgba(232,97,45,0.08)',
        border: '1px solid rgba(232,97,45,0.28)',
        borderRadius: 8,
        padding: '12px 14px',
        animation: 'agReply 3s ease infinite',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.accent, letterSpacing: '0.1em' }}>AUTO-REPLY SENT</span>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#4ADE80' }}>09:41:21 · 3.2s</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.68rem', color: 'rgba(245,242,239,0.62)', lineHeight: 1.55 }}>
          Hi Sarah - your delivery (Job #4820) is currently 14 miles from Lutterworth. ETA 11:05.
          Driver M. Hughes can be reached on 07... if needed. We&apos;ll send confirmation when he arrives.
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'rgba(245,242,239,0.04)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' as const }}>
          <div style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 700, color: C.accent }}>3.2s</div>
          <div style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.3)', marginTop: 2 }}>AVG RESPONSE</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(245,242,239,0.04)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' as const }}>
          <div style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 700, color: C.teal }}>94%</div>
          <div style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.3)', marginTop: 2 }}>AUTONOMOUS</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(245,242,239,0.04)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' as const }}>
          <div style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 700, color: '#4ADE80' }}>0</div>
          <div style={{ fontFamily: MONO, fontSize: '0.56rem', color: 'rgba(245,242,239,0.3)', marginTop: 2 }}>MISSED</div>
        </div>
      </div>
    </MockCard>
  );
}

const MOCK_UIS: Array<React.FC<{ isMobile?: boolean }>> = [OrderEntryMock, PODMatchingMock, ComplianceMock, InvoicingMock, RoutePlanningMock, CustomerCommsMock];

// ── Agent progress indicator ──────────────────────────────────────────────────
function AgentProgress({ active, isMobile }: { active: number; isMobile: boolean }) {
  const labels = ['Orders', 'PODs', 'Compliance', 'Invoicing', 'Routes', 'Comms'];
  return (
    <div style={{
      position: 'absolute',
      bottom: isMobile ? 16 : 28,
      left: 0,
      right: 0,
      zIndex: 5,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', width: 'min(480px, 90vw)' }}>
        {labels.map((label, i) => (
          <React.Fragment key={label}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: i === active ? 14 : 10,
                height: i === active ? 14 : 10,
                borderRadius: '50%',
                background: i < active ? C.teal : i === active ? C.accent : 'transparent',
                border: i > active ? '1.5px solid rgba(0,0,0,0.18)' : 'none',
                boxShadow: i === active ? `0 0 0 4px ${C.accent}28` : 'none',
                transition: 'all 0.4s ease',
              }} />
              {!isMobile && (
                <span style={{
                  fontFamily: MONO,
                  fontSize: '0.56rem',
                  color: i === active ? C.text : C.textDim,
                  fontWeight: i === active ? 700 : 400,
                  transition: 'color 0.3s ease',
                  textAlign: 'center',
                  letterSpacing: '0.06em',
                }}>
                  {label}
                </span>
              )}
            </div>
            {i < 5 && (
              <div style={{
                flex: 2,
                height: 1.5,
                marginTop: i === active || i + 1 === active ? 6 : 4.25,
                background: i < active ? C.teal : 'rgba(0,0,0,0.12)',
                transition: 'background 0.4s ease',
                alignSelf: 'flex-start',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AgentShowcaseScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const [activeAgent, setActiveAgent] = useState(0);
  const setActiveAgentRef = useRef(setActiveAgent);
  setActiveAgentRef.current = setActiveAgent;

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialise all panels invisible except first
    panelRefs.current.forEach((el, i) => {
      if (el) gsap.set(el, { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 40 });
    });

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5,
          onUpdate: (self) => {
            const idx = Math.min(5, Math.floor(self.progress * 6 + 0.08));
            setActiveAgentRef.current(idx);
          },
        },
      });

      const FADE = 0.05;

      // Panel 0 — only needs fade-out
      const el0 = panelRefs.current[0];
      if (el0) {
        tl.to(el0, { opacity: 0, y: -28, duration: FADE, ease: 'power2.in' }, AGENTS[0].show[1] - FADE);
      }

      // Panels 1–4: fromTo
      AGENTS.slice(1).forEach((agent, idx) => {
        const i  = idx + 1;
        const el = panelRefs.current[i];
        if (!el) return;
        const [start, end] = agent.show;

        tl.fromTo(
          el,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: FADE, ease: 'power2.out' },
          start
        );
        if (i < AGENTS.length - 1) {
          tl.to(el, { opacity: 0, y: -28, duration: FADE, ease: 'power2.in' }, end - FADE);
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', height: isMobile ? '500vh' : '480vh', background: C.bg }}
    >
      <style>{KEYFRAMES}</style>

      {/* Sticky viewport */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Subtle grid bg */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(45,139,139,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(45,139,139,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            zIndex: 0,
          }}
        />
        {/* Radial vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(245,242,239,0.55) 100%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Bottom fade into next section */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: `linear-gradient(to bottom, transparent, ${C.bgWhite})`,
          zIndex: 4,
          pointerEvents: 'none',
        }} />

        {/* Agent progress indicator */}
        <AgentProgress active={activeAgent} isMobile={isMobile} />

        {/* Panels */}
        {AGENTS.map((agent, i) => {
          const MockUI = MOCK_UIS[i];
          return (
            <div
              key={agent.id}
              ref={(el) => { panelRefs.current[i] = el; }}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                display: 'flex',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'center',
                padding: isMobile ? '90px 14px 16px' : '72px 24px 0',
                willChange: 'opacity, transform',
                overflowY: 'hidden',
              }}
            >
              {/* Per-agent drifting word field */}
              <AgentWordField agentIndex={i} />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: isMobile ? 20 : 56,
                  maxWidth: isMobile ? '100%' : 1080,
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                {/* Left: copy */}
                <div>
                  {/* Badge */}
                  <div style={{
                    display: 'inline-block',
                    fontFamily: MONO,
                    fontSize: '0.78rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: agent.badgeColor,
                    background: `${agent.badgeColor}18`,
                    border: `1px solid ${agent.badgeColor}40`,
                    padding: isMobile ? '5px 12px' : '8px 20px',
                    borderRadius: 6,
                    fontWeight: 700,
                    marginBottom: isMobile ? 10 : 20,
                  }}>
                    {agent.badge}
                  </div>

                  {/* Headline */}
                  <h2
                    style={{
                      fontFamily: FONT,
                      fontSize: isMobile ? '1.45rem' : 'clamp(1.6rem, 3.2vw, 2.6rem)',
                      fontWeight: 900,
                      color: C.text,
                      lineHeight: 1.12,
                      margin: isMobile ? '0 0 8px' : '0 0 14px',
                      letterSpacing: '-0.025em',
                    }}
                  >
                    {agent.headline}{' '}
                    <span style={{ color: agent.badgeColor }}>{agent.highlight}</span>
                  </h2>

                  {/* Sub */}
                  <p
                    style={{
                      fontFamily: FONT,
                      fontSize: isMobile ? '0.88rem' : '1rem',
                      color: C.textMid,
                      lineHeight: 1.55,
                      margin: isMobile ? '0 0 12px' : '0 0 28px',
                      maxWidth: 400,
                    }}
                  >
                    {agent.sub}
                  </p>

                  {/* Metric */}
                  <div style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    gap: 4,
                    background: 'rgba(0,0,0,0.04)',
                    border: `1px solid ${agent.badgeColor}28`,
                    borderRadius: 10,
                    padding: isMobile ? '10px 16px' : '14px 22px',
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.58rem', color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      {agent.metricLabel}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 900, color: agent.badgeColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {agent.metricValue}
                    </span>
                  </div>
                </div>

                {/* Right: mock UI */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <MockUI isMobile={isMobile} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
