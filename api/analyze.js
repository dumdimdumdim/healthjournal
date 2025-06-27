// api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST allowed' });
    return;
  }

  let { text } = {};
  try {
    ({ text } = JSON.parse(req.body || '{}'));
  } catch {
    text = '';
  }
  if (!text) {
    res.status(400).json({ error: 'No text' });
    return;
  }

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/google/flan-t5-small',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
        },
        body: JSON.stringify({
          inputs: `Анализ дня: "${text}". Верни только JSON с метриками.`,
        }),
      }
    );

    if (!response.ok) {
      const txt = await response.text();
      console.error('HF inference error:', response.status, txt);
      res.status(502).json({ error: 'Inference failed', details: txt });
      return;
    }

    const json = await response.json();
    res.status(200).json(json);
  } catch (e) {
    console.error('Unexpected error in /api/analyze:', e);
    res.status(500).json({ error: 'Server error' });
  }
}
