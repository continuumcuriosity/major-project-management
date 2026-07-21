exports.handler = async function(event){
  const code = event.queryStringParameters.code;
  if(!code) return { statusCode: 400, body: 'Missing code' };

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'https://major-project-management.netlify.app/.netlify/functions/google-oauth-callback',
      grant_type: 'authorization_code'
    })
  });
  const tokenData = await tokenRes.json();
  if(!tokenData.refresh_token){
    return { statusCode: 200, body: 'No refresh token returned — did you already authorize before without revoking access? Revoke it at https://myaccount.google.com/permissions and try again.' };
  }

  await fetch(`${process.env.SUPABASE_URL}/rest/v1/google_auth?id=eq.1`, {
    method: 'PATCH',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ id: 1, refresh_token: tokenData.refresh_token })
  });

  return { statusCode: 200, body: 'Authorized. You can close this tab and never see this popup again.' };
};