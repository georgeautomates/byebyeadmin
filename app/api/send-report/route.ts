import { NextRequest, NextResponse } from 'next/server';
import { generateReportEmail } from '@/emails/report-template';
import type { Results } from '@/lib/assessmentLogic';
import { addAssessmentLead } from '@/lib/instantly';
import { saveLeadToSheet } from '@/lib/sheets';

async function notifySlack(lead: {
  firstName: string;
  email: string;
  readinessScore: number;
  vehicleCount: number;
  totalAnnualSavings: number;
  maturityStage: number;
}) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'U0AETR5UK4Y',
      text: `*New assessment completion!*\n*${lead.firstName}* (${lead.email})\nScore: ${lead.readinessScore} | Vehicles: ${lead.vehicleCount} | Stage: ${lead.maturityStage} | Savings: £${lead.totalAnnualSavings.toLocaleString()}`,
    }),
  });
}

export async function POST(req: NextRequest) {
  const { firstName, email, result } = (await req.json()) as {
    firstName: string;
    email: string;
    result: Results;
  };

  // Input validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }
  if (typeof firstName !== 'string' || firstName.trim().length > 100) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  if (
    !result ||
    typeof result.readinessScore !== 'number' || result.readinessScore < 0 || result.readinessScore > 100 ||
    typeof result.vehicleCount !== 'number' || result.vehicleCount < 0 ||
    typeof result.totalAnnualSavings !== 'number' ||
    typeof result.maturityStage !== 'number'
  ) {
    return NextResponse.json({ error: 'Invalid result data' }, { status: 400 });
  }

  const leadData = {
    email,
    firstName: firstName?.trim() ?? '',
    readinessScore: result.readinessScore,
    vehicleCount: result.vehicleCount,
    totalAnnualSavings: result.totalAnnualSavings,
    maturityStage: result.maturityStage,
  };

  // CRM + Sheets + Slack — all in parallel, errors logged but non-blocking
  const [instantlyResult, sheetsResult, slackResult] = await Promise.allSettled([
    addAssessmentLead(leadData),
    saveLeadToSheet(leadData),
    notifySlack(leadData),
  ]);
  if (instantlyResult.status === 'rejected')
    console.error('INSTANTLY_ERR:', instantlyResult.reason instanceof Error ? instantlyResult.reason.message : String(instantlyResult.reason));
  if (sheetsResult.status === 'rejected')
    console.error('SHEETS_ERR:', sheetsResult.reason instanceof Error ? sheetsResult.reason.message : String(sheetsResult.reason));
  if (slackResult.status === 'rejected')
    console.error('SLACK_ERR:', slackResult.reason instanceof Error ? slackResult.reason.message : String(slackResult.reason));

  try {
    const subject = firstName?.trim()
      ? `${firstName.trim()}, your Fleet Automation Assessment Report`
      : 'Your Fleet Automation Assessment Report';

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: 'george@byebyeadmin.com', name: 'George at ByeByeAdmin' },
        subject,
        content: [{ type: 'text/html', value: generateReportEmail(firstName, result) }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SendGrid error: ${err}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('EMAIL_ERR:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'Failed to send report' },
      { status: 500 }
    );
  }
}
