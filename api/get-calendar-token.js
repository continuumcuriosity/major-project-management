exports.handler = async function(){
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/google_auth?id=eq.1&select=refresh_token`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  const rows = await res.json();
  const refresh_token = rows[0]?.refresh_token;
  if(!refresh_token) return { statusCode: 400, body: JSON.stringify({ error: 'Not authorized yet' }) };

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
  return { statusCode: 200, body: JSON.stringify({ access_token: tokenData.access_token }) };
};