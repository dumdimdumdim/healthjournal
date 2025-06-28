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

  console.log('Analyzing text with Groq:', text);

  try {
    // Проверяем наличие API ключа Groq
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY not found');
      return res.status(500).json({ error: 'Groq API key not configured' });
    }

    // Делаем запрос к Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", // Быстрая и качественная модель
        messages: [
          {
            role: "system",
            content: `Ты эксперт по анализу здоровья. Анализируй описание дня человека и возвращай ТОЛЬКО валидный JSON без дополнительного текста.

Параметры анализа:
- sleep: от -2 (очень плохой сон) до +2 (отличный сон)
- mood: от -2 (очень плохое настроение) до +2 (отличное настроение)  
- health: от -2 (очень плохое самочувствие) до +2 (отличное самочувствие)
- activity: 0=отдых, 1=легкая активность/ходьба, 2=умеренная/плавание/бег, 3=спорт/тренировка, 4=интенсивная тренировка
- calMin, calMax: примерный диапазон калорий за день
- vege: процент овощей и фруктов в рационе (0-100)
- coffee: количество порций кофе
- alco: количество порций алкоголя
- summary: краткое описание дня (1-2 предложения)

Отвечай ТОЛЬКО JSON, никакого дополнительного текста!`
          },
          {
            role: "user",
            content: `Проанализируй этот день: "${text}"

Верни JSON в точно таком формате:
{
  "sleep": число,
  "mood": число,
  "health": число,
  "activity": число,
  "calMin": число,
  "calMax": число,
  "vege": число,
  "coffee": число,
  "alco": число,
  "summary": "текст"
}`
          }
        ],
        temperature: 0.1, // Низкая температура для стабильности
        max_tokens: 300,
        response_format: { type: "json_object" } // Принуждаем к JSON формату
      })
    });

    console.log('Groq Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      return res.status(500).json({ 
        error: 'Groq API error',
        details: errorText,
        status: response.status
      });
    }

    const result = await response.json();
    console.log('Groq Result:', result);

    // Извлекаем сгенерированный JSON
    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in Groq response');
    }

    console.log('Generated content:', content);

    // Парсим JSON ответ
    let jsonResult;
    try {
      jsonResult = JSON.parse(content);
      
      // Валидируем обязательные поля
      const requiredFields = ['sleep', 'mood', 'health', 'activity', 'calMin', 'calMax', 'vege', 'coffee', 'alco', 'summary'];
      const missingFields = requiredFields.filter(field => jsonResult[field] === undefined);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(', ')}`);
      }

      // Валидируем диапазоны значений
      jsonResult.sleep = Math.max(-2, Math.min(2, Number(jsonResult.sleep) || 0));
      jsonResult.mood = Math.max(-2, Math.min(2, Number(jsonResult.mood) || 0));
      jsonResult.health = Math.max(-2, Math.min(2, Number(jsonResult.health) || 0));
      jsonResult.activity = Math.max(0, Math.min(4, Number(jsonResult.activity) || 0));
      jsonResult.vege = Math.max(0, Math.min(100, Number(jsonResult.vege) || 0));
      jsonResult.coffee = Math.max(0, Math.min(20, Number(jsonResult.coffee) || 0));
      jsonResult.alco = Math.max(0, Math.min(20, Number(jsonResult.alco) || 0));
      jsonResult.calMin = Math.max(800, Math.min(5000, Number(jsonResult.calMin) || 1500));
      jsonResult.calMax = Math.max(jsonResult.calMin, Math.min(6000, Number(jsonResult.calMax) || 2500));

    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content that failed to parse:', content);
      
      // Пытаемся извлечь JSON из текста, если он обернут в дополнительный текст
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          jsonResult = JSON.parse(jsonMatch[0]);
          console.log('Successfully extracted JSON from text');
        } catch (secondTryError) {
          throw new Error(`Failed to parse JSON: ${parseError.message}`);
        }
      } else {
        throw new Error(`No valid JSON found in response: ${content}`);
      }
    }

    // Добавляем оригинальный текст
    jsonResult.original = text;

    console.log('Final validated result:', jsonResult);
    return res.status(200).json(jsonResult);

  } catch (error) {
    console.error('Error in Groq analysis:', error);
    
    // Возвращаем ошибку с деталями для отладки
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      original: text
    });
  }
}
