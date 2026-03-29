// Google Sheets lead capture
// Appends one row per assessment submission to a Google Sheet.
//
// Required env vars:
//   GOOGLE_SHEETS_LEAD_ID   — spreadsheet ID (from the URL: /spreadsheets/d/{ID}/edit)
//   GOOGLE_CLIENT_ID        — george@byebyeadmin.com OAuth app (698251746508-...)
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REFRESH_TOKEN    — must include scope: spreadsheets (run scripts/google-reauth.mjs to refresh)
//
// Sheet setup: create a sheet called "Leads" with headers in row 1:
//   Timestamp | First Name | Email | Readiness Score | Vehicles | Annual Saving | Maturity Stage

export interface LeadRow {
  firstName: string;
  email: string;
  readinessScore: number;
  vehicleCount: number;
  totalAnnualSavings: number;
  maturityStage: number;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function saveLeadToSheet(lead: LeadRow): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_LEAD_ID;
  if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_LEAD_ID not set');

  const token = await getAccessToken();
  const timestamp = new Date().toISOString();
  const range = 'Leads!A:G';

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[
          timestamp,
          lead.firstName,
          lead.email,
          lead.readinessScore,
          lead.vehicleCount,
          lead.totalAnnualSavings,
          lead.maturityStage,
        ]],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
}
