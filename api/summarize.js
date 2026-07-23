// Uses Google's Gemini API (free tier, no credit card required as of 2026 —
// see aistudio.google.com to get GEMINI_API_KEY). Takes the already-distilled
// recap text the frontend builds (buildRecapText) and asks Gemini to turn it
// into a short narrative recap, rather than just repeating the bullet list.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, scopeLabel } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'Missing text to summarize' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel environment variables' });
  }

  const prompt = `You are helping a graduate researcher recap their own research log for the EEG/EMG spiking-network fusion project. Below is a raw, already-distilled log covering: "${scopeLabel}".

Write a clear, well-organized narrative recap in plain prose — a few short paragraphs, not just repeating the bullet list back. Group related work together, call out any milestones or key decisions explicitly, and note any open questions or next steps at the end. Do not invent facts, numbers, or results that are not present in the log below. If the log is sparse, keep the recap short rather than padding it.

--- LOG START ---
${text}
--- LOG END ---

Recap:`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const rawMsg = data?.error?.message || 'Gemini API error';
      const friendly = /free_tier_requests|free_tier_input_token_count/.test(rawMsg)
        ? 'Gemini says this model has no free quota on your project (this usually means the model name is deprecated/unsupported for free tier, or the API key needs regenerating at aistudio.google.com). Raw error: ' + rawMsg
        : rawMsg;
      return res.status(500).json({ error: friendly });
    }

    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!summary) {
      return res.status(500).json({ error: 'Gemini returned no summary text' });
    }

    return res.status(200).json({ summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}