// Called by the "✨ Summarize with AI" button in the Recap panel.
// Body: { text: string, scopeLabel: string }
//
// Uses Vercel AI Gateway instead of calling Gemini directly. This fixes two
// separate problems you were hitting:
//   1. Gemini's model names get deprecated/rotated every few months
//      (that's exactly what "gemini-2.5-flash is no longer available to
//      new users" was). The Gateway lets you swap MODEL below without
//      touching auth or request shape.
//   2. It runs entirely server-side, so there's no local-machine/CORS
//      story at all — unlike Ollama, this works from any device, not just
//      the laptop it's running on.
//
// Setup (one-time):
//   1. Vercel dashboard → your project → Storage/AI → create an AI Gateway
//      API key (or use an existing one — it's account-level, not per-project).
//   2. Add it as AI_GATEWAY_API_KEY in Project Settings → Environment
//      Variables, then redeploy.
//   3. (Optional) On Vercel deployments you can skip the API key entirely
//      and authenticate via Vercel's OIDC token instead — see
//      https://vercel.com/docs/ai-gateway for that setup if you want it.

const MODEL = 'anthropic/claude-haiku-4-5'; // swap this string to try a different model/provider

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, scopeLabel } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Nothing to summarize' });
  }
  if (!process.env.AI_GATEWAY_API_KEY) {
    return res.status(500).json({ error: 'AI_GATEWAY_API_KEY is not set on the server' });
  }

  const prompt = `You're helping a researcher prep for a supervisor meeting. Below is their raw research log for "${scopeLabel || 'this period'}". Write a short, plain-spoken narrative summary — 4 to 8 sentences, one paragraph, no headers or bullet points — of what actually happened and where things stand: what was tried, what got decided (and why), what's still open. Write it the way the researcher would casually explain it out loud, not like a report.

RAW LOG:
${text}`;

  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || `AI Gateway error (HTTP ${response.status})`);
    }

    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error('No summary returned');
    }

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}