// файл: api/analyze.js

export async function handler(event) {
  console.log("🧠 analyze.js invoked, body:", event.body);

  let text;
  try {
    ({ text } = JSON.parse(event.body || "{}"));
  } catch (err) {
    console.error("❌ JSON.parse error:", err);
    return { statusCode: 400, body: JSON.stringify({ error: "Bad JSON" }) };
  }
  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ error: "No text provided" }) };
  }

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/google/flan-t5-small",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`
        },
        body: JSON.stringify({
          inputs: `Анализ дня: "${text}". Верни только JSON с метриками.`
        })
      }
    );

    if (!response.ok) {
      console.error("❌ HF response status:", response.status, await response.text());
      return { statusCode: response.status, body: JSON.stringify({ error: "HF inference failed" }) };
    }

    const json = await response.json();
    console.log("✅ HF returned:", json);
    return { statusCode: 200, body: JSON.stringify(json) };

  } catch (err) {
    console.error("❌ Fetch to HF failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Inference error" }) };
  }
}
