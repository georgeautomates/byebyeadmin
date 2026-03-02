'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { C, FONT, MONO } from '@/lib/constants';
import { Btn } from '@/components/ui';
import {
  QUESTIONS,
  INTERSTITIALS,
  MATURITY_STAGES,
  calculateResults,
  getScoreColor,
  getScoreLabel,
  getCategoryStatus,
  type Results,
} from '@/lib/assessmentLogic';

// ─── Screen types ─────────────────────────────────────────────────────────────
type Screen = 'welcome' | 'quiz' | 'contact' | 'results';

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AssessmentPage() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [answers, setAnswers] = useState<string[]>(Array(9).fill(''));
  const [results, setResults] = useState<Results | null>(null);
  const [contact, setContact] = useState({ firstName: '', email: '' });

  function handleQuizComplete(finalAnswers: string[]) {
    setAnswers(finalAnswers);
    setScreen('contact');
  }

  function handleContactSubmit(firstName: string, email: string) {
    setContact({ firstName, email });
    const r = calculateResults(answers);
    setResults(r);
    setScreen('results');
  }

  return (
    <div style={{ paddingTop: 60, minHeight: '100vh', fontFamily: FONT }}>
      {screen === 'welcome' && <WelcomeScreen onStart={() => setScreen('quiz')} />}
      {screen === 'quiz' && <QuizScreen onComplete={handleQuizComplete} />}
      {screen === 'contact' && answers.length > 0 && (
        <ContactScreen answers={answers} onSubmit={handleContactSubmit} />
      )}
      {screen === 'results' && results && (
        <ResultsReport results={results} firstName={contact.firstName} />
      )}
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
      <div style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
        {/* Tag */}
        <div style={tagStyle(C.accent, C.accentDim)}>Free Fleet Assessment</div>

        <h1 style={{ fontFamily: FONT, fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, color: C.text, lineHeight: 1.15, margin: '20px 0 16px', letterSpacing: '-0.02em' }}>
          Find Out Exactly How Much Your Fleet Is Losing to Manual Admin
        </h1>
        <p style={{ color: C.textMid, fontSize: '1.08rem', lineHeight: 1.65, marginBottom: 32 }}>
          2 minutes. Instant personalised report. No phone number required.
        </p>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
          {['Takes 2 minutes', '100% free', 'Personalised report'].map((b) => (
            <span key={b} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 20, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 700, color: C.textMid }}>{b}</span>
          ))}
        </div>

        <Btn primary onClick={onStart} style={{ fontSize: '1.05rem', padding: '16px 48px' }}>
          Start My Assessment →
        </Btn>

      </div>
    </div>
  );
}

// ─── Quiz screen ──────────────────────────────────────────────────────────────
function QuizScreen({ onComplete }: { onComplete: (answers: string[]) => void }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(9).fill(''));
  const [showInterstitial, setShowInterstitial] = useState(false);

  function selectAnswer(option: string) {
    const updated = [...answers];
    updated[currentQ] = option;
    setAnswers(updated);

    // Check for interstitial
    if (INTERSTITIALS[currentQ + 1]) {
      setShowInterstitial(true);
      setTimeout(() => {
        setShowInterstitial(false);
        advance(updated);
      }, 1600);
    } else {
      setTimeout(() => advance(updated), 180);
    }
  }

  function advance(updatedAnswers: string[]) {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ((q) => q + 1);
    } else {
      onComplete(updatedAnswers);
    }
  }

  function goBack() {
    if (currentQ > 0) setCurrentQ((q) => q - 1);
  }

  const q = QUESTIONS[currentQ];
  const progress = ((currentQ + 1) / QUESTIONS.length) * 100;

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: '#0B1120', display: 'flex', flexDirection: 'column' }}>
      {/* Grid overlay */}
      <style>{`
        .quiz-grid-bg {
          background-image: radial-gradient(ellipse at 50% 40%, hsla(175,51%,26%,0.12) 0%, transparent 60%),
            repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(255,255,255,0.012) 40px, rgba(255,255,255,0.012) 42px);
        }
      `}</style>
      <div className="quiz-grid-bg" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 24px' }}>

        {/* Progress */}
        <div style={{ maxWidth: 600, width: '100%', margin: '0 auto', marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'rgba(245,242,239,0.4)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Question {currentQ + 1} of {QUESTIONS.length}
            </span>
            <span style={{ color: C.accent, fontSize: '0.78rem', fontWeight: 700 }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: C.accent, borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
          {/* Lorry progress */}
          <LorryProgress current={currentQ} total={QUESTIONS.length} />
        </div>

        {/* Question card */}
        <div style={{ maxWidth: 600, width: '100%', margin: '0 auto', flex: 1 }}>
          {showInterstitial && INTERSTITIALS[currentQ + 1] ? (
            <InterstitialCard text={INTERSTITIALS[currentQ + 1]!} />
          ) : (
            <div>
              <h2 style={{ fontFamily: FONT, fontSize: 'clamp(1.4rem, 3.5vw, 1.85rem)', fontWeight: 800, color: '#F5F2EF', lineHeight: 1.3, marginBottom: 28, letterSpacing: '-0.01em' }}>
                {q.text}
              </h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {q.options.map((opt, i) => {
                  const letters = 'ABCDEFG';
                  const selected = answers[currentQ] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => selectAnswer(opt)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 18px',
                        borderRadius: 10,
                        border: `1.5px solid ${selected ? C.accent : 'rgba(255,255,255,0.1)'}`,
                        background: selected ? 'rgba(232,97,45,0.12)' : 'rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        width: '100%',
                      }}
                    >
                      <span style={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, color: selected ? C.accent : 'rgba(245,242,239,0.35)', background: selected ? 'rgba(232,97,45,0.15)' : 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                        {letters[i]}
                      </span>
                      <span style={{ fontFamily: FONT, fontSize: '0.95rem', fontWeight: 600, color: selected ? '#F5F2EF' : 'rgba(245,242,239,0.75)', lineHeight: 1.4 }}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {currentQ > 0 && (
                <button onClick={goBack} style={{ marginTop: 24, fontFamily: FONT, fontSize: '0.85rem', color: 'rgba(245,242,239,0.35)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  ← Back
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Interstitial card ────────────────────────────────────────────────────────
function InterstitialCard({ text }: { text: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 20 }}>💡</div>
      <p style={{ fontFamily: FONT, fontSize: '1.15rem', fontWeight: 700, color: '#F5F2EF', lineHeight: 1.5, maxWidth: 380, margin: '0 auto 36px' }}>
        {text.replace('💡 Did you know? ', '')}
      </p>
      {/* Animated progress bar so users see something is happening */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', maxWidth: 200, margin: '0 auto' }}>
        <div style={{
          height: '100%',
          background: C.accent,
          borderRadius: 2,
          animation: 'interstitialFill 1.6s linear forwards',
        }} />
      </div>
    </div>
  );
}

// ─── Lorry progress indicator ─────────────────────────────────────────────────
function LorryProgress({ current, total }: { current: number; total: number }) {
  const pct = (current / (total - 1)) * 100;
  return (
    <div style={{ position: 'relative', marginTop: 16, height: 32 }}>
      {/* Road */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.08)', transform: 'translateY(-50%)' }} />
      {/* Completed road */}
      <div style={{ position: 'absolute', top: '50%', left: 0, width: `${pct}%`, height: 2, background: C.accent, transform: 'translateY(-50%)', transition: 'width 0.4s ease' }} />
      {/* Lorry */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: `${pct}%`,
        transform: 'translate(-50%, -50%)',
        transition: 'left 0.4s ease',
        fontSize: '1.1rem',
      }}>
        🚛
      </div>
    </div>
  );
}

// ─── Contact / email gate ─────────────────────────────────────────────────────
function ContactScreen({
  answers,
  onSubmit,
}: {
  answers: string[];
  onSubmit: (firstName: string, email: string) => void;
}) {
  const previewScore = Math.min(100, Math.round(
    (answers.filter((a) => a !== '').length / 6) * 40
  ));
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address.');
      return;
    }
    onSubmit(firstName, email);
  }

  const scoreColor = getScoreColor(previewScore);

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {/* Score preview */}
        <ScoreGauge score={previewScore} size={120} color={scoreColor} blurred />
        <div style={{ marginTop: 12, marginBottom: 4 }}>
          <span style={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 900, color: scoreColor }}>{previewScore}</span>
          <span style={{ color: C.textLight, fontSize: '1rem' }}>/100</span>
        </div>
        <p style={{ color: C.textMid, fontSize: '0.95rem', marginBottom: 32 }}>
          Your automation readiness score is ready. Enter your email to reveal the full report.
        </p>

        <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 24px', textAlign: 'left' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="George"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.teal)}
              onBlur={(e) => (e.target.style.borderColor = C.border)}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Email address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="george@yourcompany.co.uk"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.accent)}
              onBlur={(e) => (e.target.style.borderColor = C.border)}
            />
            {error && <p style={{ color: '#DC2626', fontSize: '0.82rem', marginTop: 6 }}>{error}</p>}
          </div>
          <Btn primary onClick={submit} style={{ width: '100%', fontSize: '1rem', padding: '14px' }}>
            See My Full Results →
          </Btn>
          <p style={{ fontSize: '0.75rem', color: C.textLight, marginTop: 12, textAlign: 'center' }}>
            🔒 256-bit encrypted · GDPR compliant · No spam, ever
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Results report ───────────────────────────────────────────────────────────
function ResultsReport({ results, firstName }: { results: Results; firstName: string }) {
  const {
    readinessScore,
    maturityStage,
    categoryScores,
    topAgents,
    totalWeeklyHoursSaved,
    totalMonthlySavings,
    totalAnnualSavings,
    workingDaysEquivalent,
    adminEquivalent,
    benchmarks,
    vehicleCount,
    flags,
  } = results;

  const scoreColor = getScoreColor(readinessScore);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '40px 24px 80px', position: 'relative' }}>
      {/* Haulage-themed background elements — low opacity road scene */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 800 1600" style={{ opacity: 0.055 }}>
          {/* ── Road stripes ── */}
          <line x1="120" y1="0" x2="120" y2="1600" stroke="#1F2937" strokeWidth="2.5" strokeDasharray="20 14" />
          <line x1="680" y1="0" x2="680" y2="1600" stroke="#1F2937" strokeWidth="2.5" strokeDasharray="20 14" />
          {/* Center route guide */}
          <line x1="400" y1="0" x2="400" y2="1600" stroke="#2D8B8B" strokeWidth="1" strokeDasharray="4 20" />

          {/* ── Distance markers left ── */}
          {([200, 500, 800, 1100] as number[]).map((y) => (
            <g key={y}>
              <circle cx="120" cy={y} r="5" fill="#E8612D" />
              <line x1="120" y1={y} x2="138" y2={y} stroke="#1F2937" strokeWidth="1.5" />
            </g>
          ))}
          {/* ── Distance markers right ── */}
          {([350, 650, 950, 1250] as number[]).map((y) => (
            <g key={y}>
              <circle cx="680" cy={y} r="5" fill="#E8612D" />
              <line x1="662" y1={y} x2="680" y2={y} stroke="#1F2937" strokeWidth="1.5" />
            </g>
          ))}

          {/* ── Lorry A — large, right margin, facing LEFT (hero lorry) ── */}
          <g transform="translate(790, 230) scale(-1, 1)">
            <rect x="0" y="8" width="120" height="60" rx="4" fill="#1F2937" />
            <rect x="120" y="24" width="54" height="44" rx="4" fill="#1F2937" />
            <rect x="128" y="30" width="28" height="20" rx="2" fill="rgba(232,97,45,0.35)" />
            <rect x="165" y="14" width="6" height="18" rx="2" fill="#1F2937" />
            <circle cx="36" cy="76" r="18" fill="#374151" />
            <circle cx="36" cy="76" r="8" fill="#6B7280" />
            <circle cx="152" cy="76" r="18" fill="#374151" />
            <circle cx="152" cy="76" r="8" fill="#6B7280" />
          </g>
          {/* Speed lines behind Lorry A (to its right = trailer end) */}
          <line x1="792" y1="258" x2="820" y2="258" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
          <line x1="792" y1="272" x2="826" y2="272" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="792" y1="286" x2="818" y2="286" stroke="#1F2937" strokeWidth="1" strokeLinecap="round" />

          {/* ── Lorry B — medium, left margin, facing RIGHT ── */}
          <g transform="translate(15, 605) scale(0.6, 0.6)">
            <rect x="0" y="8" width="120" height="60" rx="4" fill="#1F2937" />
            <rect x="120" y="24" width="54" height="44" rx="4" fill="#1F2937" />
            <rect x="128" y="30" width="28" height="20" rx="2" fill="rgba(232,97,45,0.35)" />
            <rect x="165" y="14" width="6" height="18" rx="2" fill="#1F2937" />
            <circle cx="36" cy="76" r="18" fill="#374151" />
            <circle cx="36" cy="76" r="8" fill="#6B7280" />
            <circle cx="152" cy="76" r="18" fill="#374151" />
            <circle cx="152" cy="76" r="8" fill="#6B7280" />
          </g>

          {/* ── Lorry C — small, right margin, facing LEFT ── */}
          <g transform="translate(785, 980) scale(-0.45, 0.45)">
            <rect x="0" y="8" width="120" height="60" rx="4" fill="#1F2937" />
            <rect x="120" y="24" width="54" height="44" rx="4" fill="#1F2937" />
            <rect x="128" y="30" width="28" height="20" rx="2" fill="rgba(232,97,45,0.35)" />
            <rect x="165" y="14" width="6" height="18" rx="2" fill="#1F2937" />
            <circle cx="36" cy="76" r="18" fill="#374151" />
            <circle cx="36" cy="76" r="8" fill="#6B7280" />
            <circle cx="152" cy="76" r="18" fill="#374151" />
            <circle cx="152" cy="76" r="8" fill="#6B7280" />
          </g>

          {/* ── Route arcs ── */}
          <path d="M 0 1600 Q 400 700 800 0" fill="none" stroke="#2D8B8B" strokeWidth="1.5" strokeDasharray="10 16" />
          <path d="M 150 0 Q 250 800 100 1600" fill="none" stroke="#2D8B8B" strokeWidth="1" strokeDasharray="5 20" opacity="0.5" />

          {/* ── GPS waypoint — page midpoint ── */}
          <circle cx="400" cy="800" r="6" fill="#E8612D" />
          <circle cx="400" cy="800" r="14" fill="none" stroke="#2D8B8B" strokeWidth="1.5" />
          <circle cx="400" cy="800" r="22" fill="none" stroke="#2D8B8B" strokeWidth="1" opacity="0.5" />
        </svg>
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: '1.2rem', fontWeight: 800 }}>
              <span style={{ color: C.accent }}>bye</span>
              <span style={{ color: C.text }}>bye</span>
              <span style={{ color: C.accent }}>admin</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: C.textDim, marginTop: 2 }}>Fleet Automation Assessment Report</div>
          </div>
          <div style={{ fontSize: '0.78rem', color: C.textLight, fontFamily: MONO }}>
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {firstName && (
          <p style={{ color: C.textMid, fontSize: '1.05rem', marginBottom: 24 }}>
            Hi {firstName}, here&apos;s your personalised fleet assessment.
          </p>
        )}

        {/* ── Score + Savings hero ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 16 }}>
            {/* Left: gauge */}
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '0.75rem', color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                Automation Readiness Score
              </div>
              <ScoreGauge score={readinessScore} size={200} color={scoreColor} />
              <div style={{ marginTop: 12 }}>
                <span style={{ fontFamily: FONT, fontSize: '3.5rem', fontWeight: 900, color: scoreColor }}>{readinessScore}</span>
                <span style={{ color: C.textLight, fontSize: '1.2rem' }}>/100</span>
              </div>
              <div style={{ fontFamily: FONT, fontSize: '0.9rem', fontWeight: 700, color: scoreColor, marginTop: 4 }}>
                {getScoreLabel(readinessScore)}
              </div>
            </div>
            {/* Right: savings numbers */}
            <div style={{ background: C.bgDark, borderRadius: 12, padding: '28px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, textAlign: 'center' }}>
              <SavingsStat label="Hours saved/week" value={totalWeeklyHoursSaved.toString()} color={C.teal} />
              <SavingsStat label="Monthly savings" value={`£${totalMonthlySavings.toLocaleString()}`} color={C.accent} />
              <SavingsStat label="Annual savings" value={`£${totalAnnualSavings.toLocaleString()}`} color="#F5F2EF" />
            </div>
          </div>
          <p style={{ color: C.textMid, fontSize: '0.92rem', fontStyle: 'italic', margin: 0, textAlign: 'center', paddingTop: 16, borderTop: `1px solid ${C.borderLight}` }}>
            Based on {vehicleCount} vehicles, you have {totalWeeklyHoursSaved} hours of recoverable admin time per week — equivalent to {adminEquivalent} admin role{adminEquivalent !== 1 ? 's' : ''} or {workingDaysEquivalent} working days a year.
          </p>
        </div>

        {/* ── Top 3 Automation Opportunities (card grid) ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <SectionTitle>Your Top 3 Automation Opportunities</SectionTitle>
          <p style={{ color: C.textDim, fontSize: '0.88rem', marginBottom: 20 }}>Based on your {vehicleCount} vehicles and current processes:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {topAgents.map((agent) => {
              const priorityColor = agent.priority === 'HIGH IMPACT' ? '#DC2626' : agent.priority === 'QUICK WIN' ? C.teal : C.textDim;
              const topBorderColor = agent.priority === 'HIGH IMPACT' ? C.accent : agent.priority === 'QUICK WIN' ? C.teal : C.textLight;
              return (
                <div key={agent.name} style={{
                  borderRadius: 12,
                  border: `1px solid ${C.borderLight}`,
                  borderTop: `3px solid ${topBorderColor}`,
                  background: `${topBorderColor}08`,
                  padding: '18px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontFamily: FONT, fontSize: '1rem', fontWeight: 800, color: C.text, lineHeight: 1.3 }}>{agent.name}</div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: priorityColor, background: `${priorityColor}18`, padding: '3px 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {agent.priority}
                    </span>
                  </div>
                  <p style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.5, margin: 0, flex: 1 }}>{agent.description}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.teal, background: C.tealDim, border: `1px solid ${C.tealBorder}`, borderRadius: 5, padding: '3px 9px' }}>
                      {agent.totalWeeklyHours.toFixed(1)} hrs/wk
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 5, padding: '3px 9px' }}>
                      £{agent.monthlySaving.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Score Breakdown ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <SectionTitle>Score Breakdown</SectionTitle>
          {(
            [
              ['Admin Efficiency', categoryScores.adminEfficiency, 'How much of your order and invoice admin is still manual.'],
              ['Cash Flow Health', categoryScores.cashFlowHealth, 'How quickly your invoices go out after delivery.'],
              ['Compliance Readiness', categoryScores.complianceReadiness, 'How well you monitor driver hours and tacho rules.'],
              ['Technology Adoption', categoryScores.technologyAdoption, 'How automated your order processing and tracking are.'],
              ['Quote Response Speed', categoryScores.quoteResponseSpeed, 'How quickly you price and respond to job requests.'],
            ] as [string, number, string][]
          ).map(([label, score, note]) => {
            const status = getCategoryStatus(score);
            const dotColor = status === 'green' ? '#059669' : status === 'amber' ? '#D97706' : '#DC2626';
            return (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                    <span style={{ fontFamily: FONT, fontSize: '0.9rem', fontWeight: 700, color: C.text }}>{label}</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: '0.82rem', color: dotColor, fontWeight: 700 }}>{score}%</span>
                </div>
                <div style={{ fontFamily: FONT, fontSize: '0.76rem', color: C.textDim, marginBottom: 6, paddingLeft: 16 }}>{note}</div>
                <div style={{ height: 10, background: C.borderLight, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: dotColor, borderRadius: 5, transition: 'width 1s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Fleet Profile ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <SectionTitle>Your Fleet Profile</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <ProfileStat label="Fleet size" value={`${vehicleCount} vehicles`} />
            <ProfileStat label="Admin hours benchmark" value={`${benchmarks.adminHours} hrs/week`} />
            <ProfileStat label="Revenue in back-office" value={`~${benchmarks.revenuePct}% of revenue`} />
            <ProfileStat label="Sector average" value="UK haulage operator" />
          </div>
        </div>

        {/* ── Risk flags ── */}
        {flags.complianceRisk && (
          <AlertCard color="#DC2626" bg="rgba(220,38,38,0.06)" borderColor="rgba(220,38,38,0.2)" title="⚠️ Compliance Risk Detected">
            You indicated you don&apos;t check driver hours as thoroughly as you should. A missed tacho violation can cost your operator licence. This is your highest-priority issue.
          </AlertCard>
        )}
        {flags.revenueOpportunity && (
          <AlertCard color={C.teal} bg={C.tealDim} borderColor={C.tealBorder} title="💰 Revenue Opportunity Identified">
            You&apos;re missing out-of-hours quote requests. Operators who automate quoting typically win 23% more jobs without adding staff.
          </AlertCard>
        )}
        {flags.ownerOperator && (
          <AlertCard color={C.accent} bg={C.accentDim} borderColor={C.accentBorder} title="👤 Owner-Operator Profile">
            You&apos;re doing everything yourself. The biggest win for operators like you is automating order entry first - it frees 15-25 hours/week that you can reinvest into growth.
          </AlertCard>
        )}

        {/* ── Maturity stage ── */}
        <div style={{ ...card, marginBottom: 32 }}>
          <SectionTitle>Your Automation Maturity Stage</SectionTitle>
          <div style={{ display: 'flex', gap: 0, position: 'relative', marginTop: 8, marginBottom: 8 }}>
            <div style={{ position: 'absolute', top: 24, left: 0, right: 0, height: 2, background: C.borderLight }} />
            {MATURITY_STAGES.map((stage, i) => {
              const stageNum = i + 1;
              const isCurrent = stageNum === maturityStage;
              const isPast = stageNum < maturityStage;
              return (
                <div key={stage.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCurrent ? C.accent : isPast ? C.teal : C.bgWhite,
                    border: `2px solid ${isCurrent ? C.accent : isPast ? C.teal : C.border}`,
                    fontFamily: FONT, fontSize: '0.9rem', fontWeight: 800,
                    color: isCurrent || isPast ? '#FFF' : C.textLight,
                    boxShadow: isCurrent ? `0 0 0 4px ${C.accentDim}` : 'none',
                    transition: 'all 0.3s',
                  }}>
                    {stageNum}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: isCurrent ? C.accent : isPast ? C.teal : C.textLight, whiteSpace: 'nowrap', marginBottom: 2 }}>
                      {stage.label}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: C.textLight }}>{stage.pct} of UK operators</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.88rem', color: C.textMid, margin: 0, textAlign: 'center', paddingTop: 16, borderTop: `1px solid ${C.borderLight}` }}>
            85% of UK fleet operators are still fully manual. You&apos;re at Stage {maturityStage} — {MATURITY_STAGES[maturityStage - 1]?.label}.
          </p>
        </div>

        {/* ── CTA ── */}
        <div style={{ ...card, textAlign: 'center', padding: '40px 28px' }}>
          <h3 style={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 900, color: C.text, margin: '0 0 12px' }}>
            Ready to recover those hours?
          </h3>
          <p style={{ color: C.textMid, maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.6 }}>
            15-minute call. I&apos;ll tell you honestly whether AI automation would make sense for your operation right now.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <a href="https://calendly.com/byebyeadmin/15min" target="_blank" rel="noopener noreferrer">
              <Btn primary style={{ fontSize: '1rem', padding: '14px 36px' }}>Book a Free 15-Minute Call →</Btn>
            </a>
            <Link href="/"><Btn>Back to Home</Btn></Link>
          </div>
          <p style={{ fontSize: '0.78rem', color: C.textLight }}>No obligation. No sales pitch. George answers personally.</p>
          <p style={{ fontSize: '0.72rem', color: C.textLight, marginTop: 16 }}>
            Savings estimates are based on £15/hr admin cost (including NI, pension, holiday) and 85% automation accuracy. Individual results vary.
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Score gauge (SVG animated) ───────────────────────────────────────────────
function ScoreGauge({ score, size = 160, color, blurred = false }: { score: number; size?: number; color: string; blurred?: boolean }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div style={{ display: 'inline-block', position: 'relative', filter: blurred ? 'blur(4px) opacity(0.6)' : 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.borderLight} strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)', transformOrigin: 'center' }}
        />
      </svg>
    </div>
  );
}

// ─── Small reusable UI pieces ─────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: C.bgWhite,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: '28px 24px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: '0.75rem', color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
      {children}
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.bg, borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: '0.72rem', color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: '0.95rem', fontWeight: 800, color: C.text }}>{value}</div>
    </div>
  );
}

function AgentStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', color: C.textLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: '0.95rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function SavingsStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: FONT, fontSize: '1.8rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'rgba(245,242,239,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>{label}</div>
    </div>
  );
}

function SavingsPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
      <div style={{ fontFamily: FONT, fontSize: '1.2rem', fontWeight: 800, color: '#F5F2EF' }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'rgba(245,242,239,0.4)', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AlertCard({ color, bg, borderColor, title, children }: { color: string; bg: string; borderColor: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontFamily: FONT, fontSize: '0.92rem', fontWeight: 800, color, marginBottom: 6 }}>{title}</div>
      <p style={{ fontFamily: FONT, fontSize: '0.88rem', color: C.textMid, lineHeight: 1.55, margin: 0 }}>{children}</p>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: FONT,
  fontSize: '0.85rem',
  fontWeight: 700,
  color: C.text,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: '0.95rem',
  padding: '12px 16px',
  borderRadius: 8,
  border: `1.5px solid ${C.border}`,
  width: '100%',
  background: C.bg,
  color: C.text,
  outline: 'none',
  transition: 'border-color 0.2s',
};

function tagStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: 'inline-block',
    fontFamily: FONT,
    fontSize: '0.72rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color,
    background: bg,
    padding: '5px 14px',
    borderRadius: 6,
    fontWeight: 700,
    marginBottom: 8,
  };
}
