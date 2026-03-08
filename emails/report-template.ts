import type { Results } from '@/lib/assessmentLogic';

const ACCENT = '#E8612D';
const TEAL = '#2D8B8B';
const DARK = '#1F2937';
const BG = '#F5F2EF';
const MID = '#4B5563';
const DIM = '#6B7280';
const BORDER = '#E5E1DC';
const GREEN = '#059669';
const AMBER = '#D97706';
const RED = '#DC2626';

function scoreColor(score: number) {
  if (score >= 66) return GREEN;
  if (score >= 33) return AMBER;
  return RED;
}

function priorityBadge(priority: string) {
  const cfg: Record<string, { bg: string; color: string }> = {
    'HIGH IMPACT': { bg: '#FEF2F2', color: RED },
    'QUICK WIN': { bg: '#F0FDFA', color: TEAL },
    'MEDIUM IMPACT': { bg: '#F3F4F6', color: DIM },
  };
  const c = cfg[priority] ?? cfg['MEDIUM IMPACT'];
  return `<span style="display:inline-block;background:${c.bg};color:${c.color};font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;padding:3px 8px;border-radius:4px;">${priority}</span>`;
}

function categoryRow(label: string, score: number) {
  const dot = scoreColor(score);
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BORDER};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="10" style="vertical-align:middle;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};margin-right:8px;"></span>
            </td>
            <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${DARK};font-weight:600;vertical-align:middle;">${label}</td>
            <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${dot};font-weight:800;vertical-align:middle;white-space:nowrap;">${score}%</td>
          </tr>
          <tr>
            <td colspan="3" style="padding-top:5px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#E5E7EB;border-radius:3px;height:6px;" width="100%">
                    <table width="${score}%" cellpadding="0" cellspacing="0">
                      <tr><td style="background:${dot};border-radius:3px;height:6px;font-size:1px;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function generateReportEmail(firstName: string, result: Results): string {
  const name = firstName?.trim() || '';
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  const {
    readinessScore,
    totalWeeklyHoursSaved,
    totalMonthlySavings,
    totalAnnualSavings,
    vehicleCount,
    adminEquivalent,
    workingDaysEquivalent,
    topAgents,
    categoryScores,
    flags,
  } = result;

  const scoreLabel = readinessScore >= 66
    ? "You're already well-automated"
    : readinessScore >= 33
    ? 'Moderate automation — clear room to grow'
    : 'Significant opportunity — most operations at this stage';

  const agentsHtml = topAgents.map((agent) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:800;color:${DARK};">${agent.name}</p>
              <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${MID};line-height:1.5;">${agent.description}</p>
              ${priorityBadge(agent.priority)}
              <span style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:${DIM};margin-left:8px;">${agent.totalWeeklyHours.toFixed(1)} hrs/wk &nbsp;·&nbsp; £${agent.monthlySaving.toLocaleString('en-GB')}/mo</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');

  const categoryRows = [
    categoryRow('Admin Efficiency', categoryScores.adminEfficiency),
    categoryRow('Cash Flow Health', categoryScores.cashFlowHealth),
    categoryRow('Compliance Readiness', categoryScores.complianceReadiness),
    categoryRow('Technology Adoption', categoryScores.technologyAdoption),
    categoryRow('Quote Response Speed', categoryScores.quoteResponseSpeed),
  ].join('');

  const flagsHtml = [
    flags.complianceRisk ? `
      <tr><td style="padding:12px 16px;background:#FEF2F2;border-left:3px solid ${RED};border-radius:4px;margin-bottom:8px;">
        <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:800;color:${RED};">Compliance Risk</p>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${DARK};line-height:1.5;">You indicated you don't check driver hours as thoroughly as you should. A missed tacho violation can cost your operator licence — it's the biggest operational risk in haulage right now.</p>
      </td></tr>` : '',
    flags.revenueOpportunity ? `
      <tr><td style="padding:8px 0;"></td></tr>
      <tr><td style="padding:12px 16px;background:#F0FDFA;border-left:3px solid ${TEAL};border-radius:4px;margin-bottom:8px;">
        <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:800;color:${TEAL};">Revenue Opportunity</p>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${DARK};line-height:1.5;">You're missing out-of-hours quote requests. Operators who automate quoting typically win 23% more jobs within 90 days.</p>
      </td></tr>` : '',
    flags.ownerOperator ? `
      <tr><td style="padding:8px 0;"></td></tr>
      <tr><td style="padding:12px 16px;background:#FFF7ED;border-left:3px solid ${ACCENT};border-radius:4px;">
        <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:800;color:${ACCENT};">Owner-Operator Profile</p>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${DARK};line-height:1.5;">You're doing everything yourself. The biggest win for operators like you is automating order entry first — it typically frees 10+ hours a week immediately.</p>
      </td></tr>` : '',
  ].filter(Boolean).join('');

  const hasFlagSection = flags.complianceRisk || flags.revenueOpportunity || flags.ownerOperator;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Fleet Automation Assessment Report</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Helvetica,Arial,sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${DARK}">
    <tr>
      <td align="center" style="padding:28px 20px 24px;">
        <p style="margin:0;font-size:22px;font-weight:900;line-height:1;letter-spacing:-0.01em;">
          <span style="color:${ACCENT};">bye</span><span style="color:#F5F2EF;">bye</span><span style="color:${ACCENT};">admin</span>
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:rgba(245,242,239,0.5);letter-spacing:0.1em;text-transform:uppercase;">Fleet Automation Assessment Report</p>
      </td>
    </tr>
  </table>

  <!-- Content wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${BG}">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Greeting -->
          <tr>
            <td style="padding:0 0 24px;">
              <p style="margin:0;font-size:17px;font-weight:700;color:${DARK};">${greeting}</p>
              <p style="margin:8px 0 0;font-size:14px;color:${MID};line-height:1.6;">Here&apos;s your personalised fleet automation report. Based on your answers, we&apos;ve calculated how much time and money you could recover.</p>
            </td>
          </tr>

          <!-- Score hero card -->
          <tr>
            <td style="background:#FFFFFF;border-radius:12px;border-top:3px solid ${ACCENT};padding:28px 24px 24px;margin-bottom:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <p style="margin:0;font-size:64px;font-weight:900;color:${scoreColor(readinessScore)};line-height:1;">${readinessScore}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:${DIM};">out of 100</p>
                    <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:${scoreColor(readinessScore)};">${scoreLabel}</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:${DARK};border-radius:8px;padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%" align="center" style="padding:0 8px 0 0;border-right:1px solid rgba(255,255,255,0.1);">
                          <p style="margin:0;font-size:22px;font-weight:900;color:${TEAL};">${totalWeeklyHoursSaved}</p>
                          <p style="margin:4px 0 0;font-size:10px;color:rgba(245,242,239,0.5);text-transform:uppercase;letter-spacing:0.06em;">hrs saved/week</p>
                        </td>
                        <td width="33%" align="center" style="padding:0 8px;border-right:1px solid rgba(255,255,255,0.1);">
                          <p style="margin:0;font-size:22px;font-weight:900;color:${ACCENT};">£${totalMonthlySavings.toLocaleString('en-GB')}</p>
                          <p style="margin:4px 0 0;font-size:10px;color:rgba(245,242,239,0.5);text-transform:uppercase;letter-spacing:0.06em;">monthly savings</p>
                        </td>
                        <td width="33%" align="center" style="padding:0 0 0 8px;">
                          <p style="margin:0;font-size:22px;font-weight:900;color:#F5F2EF;">£${totalAnnualSavings.toLocaleString('en-GB')}</p>
                          <p style="margin:4px 0 0;font-size:10px;color:rgba(245,242,239,0.5);text-transform:uppercase;letter-spacing:0.06em;">annual savings</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px;">
                    <p style="margin:0;font-size:11px;color:${DIM};font-style:italic;text-align:center;line-height:1.5;">Based on ${vehicleCount} vehicles — ${totalWeeklyHoursSaved} hrs of recoverable admin time per week, equivalent to ${adminEquivalent} admin role(s) or ${workingDaysEquivalent} working days a year.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:16px;"></td></tr>

          <!-- Top agents -->
          <tr>
            <td style="background:#FFFFFF;border-radius:12px;padding:24px;margin-bottom:16px;">
              <p style="margin:0 0 16px;font-size:15px;font-weight:900;color:${DARK};">Top 3 Automation Opportunities</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${agentsHtml}
              </table>
            </td>
          </tr>

          <tr><td style="height:16px;"></td></tr>

          <!-- Score breakdown -->
          <tr>
            <td style="background:#FFFFFF;border-radius:12px;padding:24px;margin-bottom:16px;">
              <p style="margin:0 0 16px;font-size:15px;font-weight:900;color:${DARK};">Score Breakdown</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${categoryRows}
              </table>
            </td>
          </tr>

          ${hasFlagSection ? `
          <tr><td style="height:16px;"></td></tr>
          <tr>
            <td style="background:#FFFFFF;border-radius:12px;padding:24px;">
              <p style="margin:0 0 16px;font-size:15px;font-weight:900;color:${DARK};">Key Flags</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${flagsHtml}
              </table>
            </td>
          </tr>` : ''}

          <tr><td style="height:24px;"></td></tr>

          <!-- CTA -->
          <tr>
            <td style="background:#FFFFFF;border-radius:12px;border-top:3px solid ${ACCENT};padding:32px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:900;color:${DARK};">Ready to recover those hours?</p>
              <p style="margin:0 0 24px;font-size:13px;color:${MID};line-height:1.6;max-width:400px;display:inline-block;">30-minute call. I&apos;ll tell you honestly whether AI automation would make sense for your operation right now.</p>
              <br />
              <a href="https://calendly.com/george-byebyeadmin/30min" style="display:inline-block;background:${ACCENT};color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;">Book a Free 30-Minute Call →</a>
              <p style="margin:16px 0 0;font-size:12px;color:${DIM};">No obligation. No sales pitch. George answers personally.</p>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding:0 16px;">
              <p style="margin:0 0 4px;font-size:11px;color:${DIM};">
                <span style="color:${ACCENT};">bye</span><span style="color:${DARK};">bye</span><span style="color:${ACCENT};">admin</span> &nbsp;·&nbsp; AI automation for UK haulage operations
              </p>
              <p style="margin:0;font-size:10px;color:rgba(107,114,128,0.7);line-height:1.5;">
                Savings estimates are based on £15/hr admin cost and 85% automation accuracy. Individual results vary.<br />
                You received this because you completed the fleet assessment at byebyeadmin.co.uk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
