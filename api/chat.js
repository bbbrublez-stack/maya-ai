// api/chat.js
// Groq API — бесплатно, без карты, работает из России
// Текст:    llama-3.3-70b-versatile
// Картинки: meta-llama/llama-4-scout-17b-16e-instruct (актуальная vision-модель)

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, system } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Неверный запрос: messages отсутствуют.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY не найден. Добавь переменную в Vercel → Settings → Environment Variables.'
    });
  }

  // Определяем есть ли изображение в последнем сообщении
  const lastMsg = messages[messages.length - 1];
  const hasImage = Array.isArray(lastMsg?.content) &&
    lastMsg.content.some(p => p.type === 'image_url');

  // Выбор модели:
  // - vision (изображения): meta-llama/llama-4-scout-17b-16e-instruct
  // - текст:                llama-3.3-70b-versatile
  const model = hasImage
    ? 'meta-llama/llama-4-scout-17b-16e-instruct'
    : 'llama-3.3-70b-versatile';

  const apiMessages = [
    { role: 'system', content: system || 'Ты полезный ассистент. Отвечай на языке пользователя.' },
    ...messages
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        max_tokens: 1500,
        temperature: 0.8
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', response.status, JSON.stringify(data));
      if (response.status === 401) {
        return res.status(401).json({ error: 'Неверный API-ключ. Проверь GROQ_API_KEY в Vercel.' });
      }
      if (response.status === 429) {
        return res.status(429).json({ error: 'Слишком много запросов. Подожди минуту.' });
      }
      return res.status(500).json({ error: data?.error?.message || `Ошибка Groq: ${response.status}` });
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      console.error('Empty Groq response:', JSON.stringify(data));
      return res.status(500).json({ error: 'Пустой ответ. Попробуй ещё раз.' });
    }

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: 'Ошибка подключения: ' + err.message });
  }
}
