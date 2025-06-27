// api/analyze.js
export default async function handler(req, res) {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error:'No text' });
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/google/flan-t5-small',
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization': `Bearer ${process.env.HF_API_TOKEN}`
        },
        body: JSON.stringify({ inputs:`Анализ дня: "${text}". Верни JSON с метриками.` })
      }
    );
    if (!response.ok) throw new Error('HF inference failed '+response.status);
    const json = await response.json();
    // ожидаем, что модель вернула {"sleep":..,"mood":..,"health":.., "activity":.., "calMin":.., "calMax":.., "vege":.., "coffee":.., "alco":.., "summary":.., "original": text}
    return res.status(200).json(json);
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error:'Inference error' });
  }
}
