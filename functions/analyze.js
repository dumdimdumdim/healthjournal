import fetch from "node-fetch";

export async function handler(event) {
  const { text } = JSON.parse(event.body || "{}");
  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ error: "No text" }) };
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
    const json = await response.json();
    return { statusCode: 200, body: JSON.stringify(json) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Inference failed" }) };
  }
}
