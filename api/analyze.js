// файл: api/analyze.js

export default async function handler(req, res) {
  // Разрешаем только POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { text } = req.body || {};
  if (!text) {
    res.status(400).json({ error: "No text provided" });
    return;
  }

  console.log("🧠 analyze.js invoked, text:", text);

  try {
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/google/flan-t5-small",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`,
        },
        body: JSON.stringify({
          inputs: `Анализ дня: "${text}". Верни ТОЛЬКО JSON с метриками.`,
        }),
      }
    );

    if (!hfRes.ok) {
      const errorText = await hfRes.text();
      console.error("❌ HF Error:", hfRes.status, errorText);
      return res.status(hfRes.status).json({ error: "HF inference failed" });
    }

    const data = await hfRes.json();
    console.log("✅ HF returned:", data);
    return res.status(200).json(data);

  } catch (err) {
    console.error("❌ Fetch error:", err);
    return res.status(500).json({ error: "Inference error" });
  }
}
