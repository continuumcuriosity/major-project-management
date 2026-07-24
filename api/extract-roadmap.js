// Extracts structured decision points from PDF text for the roadmap feature.
// Body: { text: string }
//
// Uses Vercel AI Gateway to parse raw text into JSON decision points.
// Returns: { ok: true, items: [{title, choice, rationale}] }

const MODEL = 'anthropic/claude-haiku-4-5';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }
  if (!process.env.AI_GATEWAY_API_KEY) {
    return res.status(500).json({ error: 'AI_GATEWAY_API_KEY is not set on the server' });
  }

  const prompt = `You are extracting decision points from a research chat log for a roadmap visualization. Parse the following text into a JSON array of decision points. Each point should have:
- title: short descriptive title (under 50 chars)
- choice: the decision made or option chosen
- rationale: brief explanation of why (under 200 chars)

Return ONLY valid JSON array, no markdown, no explanation. Format:
[
  {"title": "...", "choice": "...", "rationale": "..."},
  ...
]

TEXT TO PARSE:
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
        max_tokens: 1000
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || `AI Gateway error (HTTP ${response.status})`);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No content returned');
    }

    // Parse JSON from the response
    let items;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      items = JSON.parse(cleanContent);
    } catch (e) {
      throw new Error('Failed to parse AI response as JSON');
    }

    if (!Array.isArray(items)) {
      throw new Error('AI response is not an array');
    }

    return res.status(200).json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
