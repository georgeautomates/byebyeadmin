import { NextRequest, NextResponse } from 'next/server';
import { generateReportEmail } from '@/emails/report-template';
import type { Results } from '@/lib/assessmentLogic';
import { addAssessmentLead } from '@/lib/instantly';

export async function POST(req: NextRequest) {
  const { firstName, email, result } = (await req.json()) as {
    firstName: string;
    email: string;
    result: Results;
  };

  const leadData = {
    email,
    firstName: firstName?.trim() ?? '',
    readinessScore: result.readinessScore,
    vehicleCount: result.vehicleCount,
    totalAnnualSavings: result.totalAnnualSavings,
    maturityStage: result.maturityStage,
  };

  // CRM — fire and forget
  addAssessmentLead(leadData).catch(err =>
    console.error('INSTANTLY_ERR:', err instanceof Error ? err.message : String(err))
  );

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
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
