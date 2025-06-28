// api/analyze.js
export default async function handler(req, res) {
  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Получаем текст из запроса
  let text = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    text = body.text || '';
  } catch (e) {
    text = '';
  }

  // Проверяем наличие текста
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  console.log('Analyzing text:', text);

  try {
    // Проверяем наличие API ключа
    const HF_API_TOKEN = process.env.HF_API_TOKEN;
    if (!HF_API_TOKEN) {
      console.error('HF_API_TOKEN not found');
      return res.status(500).json({ error: 'API token not configured' });
    }

    // Создаем промпт для анализа
    const prompt = `Анализируй день: "${text}". Верни только JSON с метриками:
    
Пример ответа:
{
  "sleep": 1,
  "mood": 0, 
  "health": -1,
  "activity": 2,
  "calMin": 1800,
  "calMax": 2200,
  "vege": 60,
  "coffee": 2,
  "alco": 0,
  "summary": "Хороший день с активностью"
}

Где:
- sleep, mood, health: от -2 до +2
- activity: 0-покой, 1-ходьба, 2-бег, 3-спорт, 4-интенсив
- calMin/calMax: примерные калории
- vege: процент овощей 0-100
- coffee, alco: количество порций

JSON:`;

    // Делаем запрос к HuggingFace
    const response = await fetch(
      'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_API_TOKEN}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.3,
            return_full_text: false
          }
        }),
      }
    );

    console.log('HF Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HF inference error:', response.status, errorText);
      
      // Возвращаем дефолтные значения при ошибке API
      return res.status(200).json({
        sleep: 0,
        mood: 0,
        health: 0,
        activity: 1,
        calMin: 1800,
        calMax: 2200,
        vege: 30,
        coffee: 1,
        alco: 0,
        summary: "Анализ недоступен, использованы стандартные значения",
        original: text
      });
    }

    const result = await response.json();
    console.log('HF Result:', result);

    // Парсим ответ от модели
    let jsonResult;
    try {
      const generatedText = result[0]?.generated_text || result.generated_text || '';
      console.log('Generated text:', generatedText);
      
      // Ищем JSON в ответе
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.log('Parse error, using fallback analysis');
      
      // Простой анализ по ключевым словам
      const lowerText = text.toLowerCase();
      
      jsonResult = {
        sleep: lowerText.includes('плохо спал') || lowerText.includes('не выспался') ? -1 : 
               lowerText.includes('хорошо спал') || lowerText.includes('выспался') ? 1 : 0,
        mood: lowerText.includes('грустно') || lowerText.includes('плохо') ? -1 :
              lowerText.includes('хорошо') || lowerText.includes('отлично') ? 1 : 0,
        health: lowerText.includes('болит') || lowerText.includes('плохо себя') ? -1 :
                lowerText.includes('здоров') || lowerText.includes('хорошо себя') ? 1 : 0,
        activity: lowerText.includes('спорт') || lowerText.includes('тренировка') ? 3 :
                  lowerText.includes('бег') || lowerText.includes('пробежка') ? 2 :
                  lowerText.includes('прогулка') || lowerText.includes('ходьба') ? 1 : 0,
        calMin: 1800 + (lowerText.includes('много ел') ? 400 : 0),
        calMax: 2200 + (lowerText.includes('много ел') ? 600 : 0),
        vege: lowerText.includes('овощи') || lowerText.includes('салат') ? 70 : 30,
        coffee: (lowerText.match(/кофе/g) || []).length || 1,
        alco: (lowerText.match(/пиво|вино|алкоголь/g) || []).length,
        summary: "Анализ выполнен по ключевым словам"
      };
    }

    // Добавляем оригинальный текст
    jsonResult.original = text;

    console.log('Final result:', jsonResult);
    return res.status(200).json(jsonResult);

  } catch (error) {
    console.error('Unexpected error in /api/analyze:', error);
    
    // Возвращаем дефолтные значения при любой ошибке
    return res.status(200).json({
      sleep: 0,
      mood: 0,
      health: 0,
      activity: 1,
      calMin: 1800,
      calMax: 2200,
      vege: 30,
      coffee: 1,
      alco: 0,
      summary: "Произошла ошибка, использованы стандартные значения",
      original: text
    });
  }
}
