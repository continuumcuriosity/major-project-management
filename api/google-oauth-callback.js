// This runs once, when Google redirects back after you approve access
// (triggered by startOneTimeGoogleAuth() in the browser console).
// It exchanges the one-time `code` for a refresh_token, then stores that
// refresh_token in Supabase so get-calendar-token.js can mint fresh access
// tokens forever after, without anyone re-approving.

const REDIRECT_URI = 'https://major-project-management.vercel.app/api/google-oauth-callback';

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Google returned an error: ${error}`);
  }
  if (!code) {
    return res.status(400).send('Missing authorization code in the callback URL.');
  }

  try {
    // Step 1: exchange the authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, // must exactly match what was sent in the original auth request
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.refresh_token) {
      // Google only issues a refresh_token on first-ever consent, unless
      // prompt=consent forces a fresh one (the browser function already sets
      // this, so this branch should be rare — but if you've approved this
      // app with this Google account before, revoke it and try again).
      return res.status(400).send(
        `No refresh token in Google's response: ${JSON.stringify(tokenData)}. ` +
        `If you've authorized this app with this account before, revoke access at ` +
        `myaccount.google.com/permissions and run startOneTimeGoogleAuth() again.`
      );
    }

    // Step 2: store the refresh token in Supabase (upsert into a single row, id=1)
    const upsertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/google_auth?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: 1, refresh_token: tokenData.refresh_token })
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      return res.status(500).send(`Got the refresh token but failed to save it to Supabase: ${errText}`);
    }

    return res.status(200).send(
      '<h2>Google Calendar connected ✓</h2><p>You can close this tab and go back to the app. This only needed to happen once.</p>'
    );
  } catch (err) {
    return res.status(500).send('Unexpected error during token exchange: ' + err.message);
  }
}