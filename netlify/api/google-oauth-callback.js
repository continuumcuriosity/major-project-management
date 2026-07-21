export default async function handler(req, res) {
  const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/google_auth?id=eq.1&select=refresh_token`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  const rows = await dbRes.json();
  const refresh_token = rows[0]?.refresh_token;
  if (!refresh_token) return res.status(400).json({ error: 'Not authorized yet' });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  const tokenData = await tokenRes.json();
  return res.status(200).json({ access_token: tokenData.access_token });
}