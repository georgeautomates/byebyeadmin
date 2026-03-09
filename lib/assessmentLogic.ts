// ─── Assessment data & scoring — ported from fleet-score-bot ─────────────────
// Exact scoring logic preserved; visual layer replaced with BrandKit1

export interface Question {
  id: number;
  text: string;
  options: string[];
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    text: 'How many vehicles are in your fleet?',
    options: ['1 to 5 vehicles', '6 to 10 vehicles', '11 to 20 vehicles', '21 to 50 vehicles', '50+ vehicles'],
  },
  {
    id: 2,
    text: 'What type of work do you mainly do?',
    options: [
      'General haulage',
      'Pallet distribution',
      'Temperature controlled',
      'Container / port work',
      'Mixed / other',
    ],
  },
  {
    id: 3,
    text: 'How many people handle your back office admin (including yourself)?',
    options: [
      'Just me. I do everything',
      '1 part-time admin',
      '1 to 2 full-time admin',
      '3 to 5 admin staff',
      '6 or more',
    ],
  },
  {
    id: 4,
    text: 'How do you currently handle order entry?',
    options: [
      'Manually type every order into TMS or spreadsheet',
      'Some orders come through a portal, but most are manual',
      'Mostly automated through TMS integration',
      'Fully automated, orders flow in without us touching them',
    ],
  },
  {
    id: 5,
    text: 'How quickly do your invoices go out after delivery?',
    options: [
      'Same day',
      'Within 24 hours',
      '2 to 3 days',
      'End of the week',
      'Whenever we get round to it',
    ],
  },
  {
    id: 6,
    text: 'How do you check driver hours and tacho compliance?',
    options: [
      'Manual tacho printouts and spreadsheets',
      'Our TMS has some compliance features we use',
      'Outsourced to a third party',
      "We don't check as thoroughly as we should",
    ],
  },
  {
    id: 7,
    text: 'How do you handle quote requests?',
    options: [
      'Manually price each one when we see it',
      'We have a rate card but still type quotes manually',
      'Partially automated through our TMS',
      "We miss out-of-hours quotes because nobody's in the office",
    ],
  },
  {
    id: 8,
    text: "When a customer asks 'where's my delivery?', what happens?",
    options: [
      'Someone checks the TMS and calls or emails back',
      'We call the driver directly',
      'We have live tracking the customer can access',
      "Honestly, it's a bit chaotic",
    ],
  },
  {
    id: 9,
    text: "What's the single biggest drain on your time right now?",
    options: [
      'Order entry and data input',
      'Invoicing and getting paid',
      'Compliance and driver hours',
      'Quoting and winning new work',
      'Customer communication and chasing',
      'Route planning and scheduling',
      'All of the above. I do everything',
    ],
  },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

function getQ3Score(answer: string): number {
  const map: Record<string, number> = {
    'Just me. I do everything': 0,
    '1 part-time admin': 3,
    '1 to 2 full-time admin': 6,
    '3 to 5 admin staff': 9,
    '6 or more': 12,
  };
  return map[answer] ?? 0;
}

function getQ4Score(answer: string): number {
  const map: Record<string, number> = {
    'Manually type every order into TMS or spreadsheet': 0,
    'Some orders come through a portal, but most are manual': 5,
    'Mostly automated through TMS integration': 12,
    'Fully automated, orders flow in without us touching them': 18,
  };
  return map[answer] ?? 0;
}

function getQ5Score(answer: string): number {
  const map: Record<string, number> = {
    'Same day': 18,
    'Within 24 hours': 12,
    '2 to 3 days': 5,
    'End of the week': 2,
    'Whenever we get round to it': 0,
  };
  return map[answer] ?? 0;
}

function getQ6Score(answer: string): number {
  const map: Record<string, number> = {
    'Manual tacho printouts and spreadsheets': 0,
    'Our TMS has some compliance features we use': 8,
    'Outsourced to a third party': 10,
    "We don't check as thoroughly as we should": 0,
  };
  return map[answer] ?? 0;
}

function getQ7Score(answer: string): number {
  const map: Record<string, number> = {
    'Manually price each one when we see it': 0,
    'We have a rate card but still type quotes manually': 4,
    'Partially automated through our TMS': 12,
    "We miss out-of-hours quotes because nobody's in the office": 2,
  };
  return map[answer] ?? 0;
}

function getQ8Score(answer: string): number {
  const map: Record<string, number> = {
    'Someone checks the TMS and calls or emails back': 4,
    'We call the driver directly': 2,
    'We have live tracking the customer can access': 16,
    "Honestly, it's a bit chaotic": 0,
  };
  return map[answer] ?? 0;
}

function getVehicleCount(answer: string): number {
  const map: Record<string, number> = {
    '1 to 5 vehicles': 3,
    '6 to 10 vehicles': 8,
    '11 to 20 vehicles': 15,
    '21 to 50 vehicles': 35,
    '50+ vehicles': 60,
  };
  return map[answer] ?? 8;
}

function getBenchmarks(fleetAnswer: string) {
  const map: Record<string, { adminHours: number; revenuePct: number }> = {
    '1 to 5 vehicles':   { adminHours: 25, revenuePct: 22 },
    '6 to 10 vehicles':  { adminHours: 40, revenuePct: 20 },
    '11 to 20 vehicles': { adminHours: 60, revenuePct: 18 },
    '21 to 50 vehicles': { adminHours: 90, revenuePct: 16 },
    '50+ vehicles':      { adminHours: 120, revenuePct: 14 },
  };
  return map[fleetAnswer] ?? { adminHours: 40, revenuePct: 20 };
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export interface Agent {
  name: string;
  description: string;
  hoursPerVehiclePerWeek: number;
  totalWeeklyHours: number;
  monthlySaving: number;
  priority: 'HIGH IMPACT' | 'MEDIUM IMPACT' | 'QUICK WIN';
}

const HOURLY_RATE = 15;
const WEEKS_PER_MONTH = 4.33;

function buildAgent(
  name: string,
  description: string,
  hoursPerVehicle: number,
  vehicleCount: number,
  priority: Agent['priority']
): Agent {
  const totalWeeklyHours = hoursPerVehicle * vehicleCount;
  const monthlySaving = Math.round(totalWeeklyHours * HOURLY_RATE * WEEKS_PER_MONTH);
  return { name, description, hoursPerVehiclePerWeek: hoursPerVehicle, totalWeeklyHours, monthlySaving, priority };
}

// ─── Results ──────────────────────────────────────────────────────────────────

export interface Results {
  readinessScore: number;         // 0–100
  maturityStage: number;          // 1–5
  categoryScores: {
    adminEfficiency: number;
    cashFlowHealth: number;
    complianceReadiness: number;
    technologyAdoption: number;
    quoteResponseSpeed: number;
  };
  topAgents: Agent[];
  totalWeeklyHoursSaved: number;
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  workingDaysEquivalent: number;
  adminEquivalent: number;
  benchmarks: { adminHours: number; revenuePct: number };
  vehicleCount: number;
  flags: {
    complianceRisk: boolean;
    revenueOpportunity: boolean;
    ownerOperator: boolean;
  };
}

export function calculateResults(answers: string[]): Results {
  // answers[0..8] correspond to Q1..Q9
  const [q1, q2, q3, q4, q5, q6, q7, q8, q9] = answers;

  const vehicleCount = getVehicleCount(q1);
  const benchmarks = getBenchmarks(q1);

  // Raw score (max 82)
  const rawScore =
    getQ3Score(q3) +
    getQ4Score(q4) +
    getQ5Score(q5) +
    getQ6Score(q6) +
    getQ7Score(q7) +
    getQ8Score(q8);

  const readinessScore = Math.min(100, Math.round(rawScore / 0.82));

  // Maturity stage
  let maturityStage = 1;
  if (readinessScore > 80) maturityStage = 5;
  else if (readinessScore > 60) maturityStage = 4;
  else if (readinessScore > 40) maturityStage = 3;
  else if (readinessScore > 20) maturityStage = 2;

  // Category scores (0–100)
  const q3s = getQ3Score(q3);
  const q4s = getQ4Score(q4);
  const q5s = getQ5Score(q5);
  const q6s = getQ6Score(q6);
  const q7s = getQ7Score(q7);
  const q8s = getQ8Score(q8);

  const categoryScores = {
    adminEfficiency:       Math.round(((q3s + q4s) / 30) * 100),
    cashFlowHealth:        Math.round((q5s / 18) * 100),
    complianceReadiness:   Math.round((q6s / 10) * 100),
    technologyAdoption:    Math.round(((q4s + q8s) / 34) * 100),
    quoteResponseSpeed:    Math.round((q7s / 12) * 100),
  };

  // Build eligible agents
  const eligibleAgents: Agent[] = [];
  const allAbove = q9 === 'All of the above. I do everything';

  if (
    q4 === 'Manually type every order into TMS or spreadsheet' ||
    q4 === 'Some orders come through a portal, but most are manual' ||
    allAbove
  ) {
    eligibleAgents.push(
      buildAgent(
        'Order Entry Agent',
        'Processes customer emails, extracts order details, and handles vague requests and missing information automatically.',
        0.45,
        vehicleCount,
        'HIGH IMPACT'
      )
    );
  }

  if (
    q5 === '2 to 3 days' ||
    q5 === 'End of the week' ||
    q5 === 'Whenever we get round to it' ||
    allAbove
  ) {
    eligibleAgents.push(
      buildAgent(
        'Invoice & POD Matching Agent',
        'Matches delivery photos to jobs, creates invoices, and catches discrepancies before sending.',
        0.30,
        vehicleCount,
        'HIGH IMPACT'
      )
    );
  }

  if (
    q6 === 'Manual tacho printouts and spreadsheets' ||
    q6 === "We don't check as thoroughly as we should" ||
    allAbove
  ) {
    eligibleAgents.push(
      buildAgent(
        'Compliance & Tachograph Agent',
        'Checks driver hours across your fleet, flags violations, generates weekly reports, and predicts breaches before they happen.',
        0.22,
        vehicleCount,
        'HIGH IMPACT'
      )
    );
  }

  if (
    q7 === 'Manually price each one when we see it' ||
    q7 === 'We have a rate card but still type quotes manually' ||
    q7 === "We miss out-of-hours quotes because nobody's in the office" ||
    allAbove
  ) {
    eligibleAgents.push(
      buildAgent(
        'Quote Generator Agent',
        'Prices jobs instantly including multi-leg work, and responds to out-of-hours requests automatically.',
        0.18,
        vehicleCount,
        'MEDIUM IMPACT'
      )
    );
  }

  if (
    q8 === 'Someone checks the TMS and calls or emails back' ||
    q8 === 'We call the driver directly' ||
    q8 === "Honestly, it's a bit chaotic" ||
    allAbove
  ) {
    eligibleAgents.push(
      buildAgent(
        'Customer Communication Agent',
        "Responds to delivery queries, sends bulk status updates, and handles 'where's my delivery' emails automatically.",
        0.14,
        vehicleCount,
        'QUICK WIN'
      )
    );
  }

  // Route optimisation as fallback
  const routeAgent = buildAgent(
    'Route Optimisation Agent',
    'Plans multi-stop routes, re-optimises after breakdowns, and maximises vehicle utilisation.',
    0.28,
    vehicleCount,
    'MEDIUM IMPACT'
  );

  // Sort by monthly saving, take top 3
  eligibleAgents.sort((a, b) => b.monthlySaving - a.monthlySaving);
  if (eligibleAgents.length < 3) eligibleAgents.push(routeAgent);
  const topAgents = eligibleAgents.slice(0, 3);

  const totalWeeklyHoursSaved = topAgents.reduce((sum, a) => sum + a.totalWeeklyHours, 0);
  const totalMonthlySavings = topAgents.reduce((sum, a) => sum + a.monthlySaving, 0);
  const totalAnnualSavings = totalMonthlySavings * 12;
  const workingDaysEquivalent = Math.round((totalWeeklyHoursSaved * 52) / 8);
  const adminEquivalent = parseFloat((totalWeeklyHoursSaved / 37.5).toFixed(1));

  return {
    readinessScore,
    maturityStage,
    categoryScores,
    topAgents,
    totalWeeklyHoursSaved: Math.round(totalWeeklyHoursSaved * 10) / 10,
    totalMonthlySavings,
    totalAnnualSavings,
    workingDaysEquivalent,
    adminEquivalent,
    benchmarks,
    vehicleCount,
    flags: {
      complianceRisk: q6 === "We don't check as thoroughly as we should",
      revenueOpportunity: q7 === "We miss out-of-hours quotes because nobody's in the office",
      ownerOperator: q9 === 'All of the above. I do everything',
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 66) return '#059669'; // green
  if (score >= 33) return '#D97706'; // amber
  return '#DC2626';                  // red
}

export function getScoreLabel(score: number): string {
  if (score >= 81) return "You're ahead of most UK operators";
  if (score >= 61) return 'Good foundations — real savings still within reach';
  if (score >= 33) return 'Moderate automation — clear room to grow';
  return 'Significant opportunity — most operations are here too';
}

export function getCategoryStatus(score: number): 'green' | 'amber' | 'red' {
  if (score >= 66) return 'green';
  if (score >= 33) return 'amber';
  return 'red';
}

export const MATURITY_STAGES = [
  { label: 'Fully Manual', pct: '85%' },
  { label: 'Partly Digitised', pct: '10%' },
  { label: 'Integrated', pct: '4%' },
  { label: 'Advanced', pct: '0.8%' },
  { label: 'Autonomous', pct: '0.2%' },
];

export const INTERSTITIALS: Record<number, string> = {
  4: '💡 Did you know? Operators who automate invoicing get paid an average of 23 days faster.',
  6: '💡 Did you know? The average operator misses 12 out-of-hours quote requests per month.',
};
