const BASE_URL = 'https://api.instantly.ai/api/v2';

interface AssessmentLead {
  email: string;
  firstName: string;
  readinessScore: number;
  vehicleCount: number;
  totalAnnualSavings: number;
  maturityStage: number;
}

export async function addAssessmentLead(lead: AssessmentLead): Promise<void> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  const listId = process.env.INSTANTLY_ASSESSMENT_LIST_ID;

  if (!apiKey || !listId) {
    throw new Error('INSTANTLY_API_KEY or INSTANTLY_ASSESSMENT_LIST_ID not set');
  }

  const res = await fetch(`${BASE_URL}/leads/add`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      list_id: listId,
      leads: [
        {
          email: lead.email,
          first_name: lead.firstName,
          custom_variables: {
            readiness_score: lead.readinessScore,
            vehicle_count: lead.vehicleCount,
            annual_savings: lead.totalAnnualSavings,
            maturity_stage: lead.maturityStage,
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instantly API error ${res.status}: ${text}`);
  }
}

export async function addLeadToCampaign(
  lead: AssessmentLead & { reportUrl: string }
): Promise<void> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  const listId = process.env.INSTANTLY_ASSESSMENT_LIST_ID;
  const campaignId = process.env.INSTANTLY_CAMPAIGN_ID;

  if (!apiKey || !listId || !campaignId) {
    throw new Error('Missing INSTANTLY env vars (API_KEY, ASSESSMENT_LIST_ID, or CAMPAIGN_ID)');
  }

  // 1. Add lead to list with all custom variables (including report_url)
  const addRes = await fetch(`${BASE_URL}/leads/add`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      list_id: listId,
      leads: [
        {
          email: lead.email,
          first_name: lead.firstName,
          custom_variables: {
            readiness_score: lead.readinessScore,
            vehicle_count: lead.vehicleCount,
            annual_savings: lead.totalAnnualSavings,
            maturity_stage: lead.maturityStage,
            report_url: lead.reportUrl,
          },
        },
      ],
    }),
  });

  if (!addRes.ok) {
    const text = await addRes.text();
    throw new Error(`Instantly add error ${addRes.status}: ${text}`);
  }

  // 2. Move lead into the campaign so Instantly sends the email sequence
  const moveRes = await fetch(`${BASE_URL}/lead/moveleads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ campaign_id: campaignId, emails: [lead.email] }),
  });

  if (!moveRes.ok) {
    const text = await moveRes.text();
    throw new Error(`Instantly move error ${moveRes.status}: ${text}`);
  }
}
