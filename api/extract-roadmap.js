// Extracts structured decision points from PDF text for the roadmap feature.
// Body: { text: string }
//
// Uses local Ollama to parse raw text into JSON decision points.
// Returns: { ok: true, items: [{title, choice, rationale}] }

const MODEL = 'llama3.1';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
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
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false })
    });

    if (!response.ok) {
      throw new Error(`Ollama returned an error (HTTP ${response.status})`);
    }

    const data = await response.json();
    if (!data.response) {
      throw new Error('Ollama returned no text — check the model name matches what you pulled (ollama list)');
    }

    const content = data.response.trim();
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
