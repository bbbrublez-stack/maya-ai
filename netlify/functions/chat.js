// netlify/functions/chat.js
// Для деплоя на Netlify (альтернатива Vercel)

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); } catch(_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { messages, system } = body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages required' }) };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GROQ_API_KEY не задан. Добавь в Netlify → Site settings → Environment variables.' })
    };
  }

  const lastMsg = messages[messages.length - 1];
  const hasImage = Array.isArray(lastMsg?.content) &&
    lastMsg.content.some(p => p.type === 'image_url');

  const model = hasImage
    ? 'meta-llama/llama-4-scout-17b-16e-instruct'
    : 'llama-3.3-70b-versatile';

  const apiMessages = [
    { role: 'system', content: system || 'Ты полезный ассистент.' },
    ...messages
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, messages: apiMessages, max_tokens: 1500, temperature: 0.8 })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data?.error?.message || 'Groq error' }) };
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) return { statusCode: 500, body: JSON.stringify({ error: 'Empty response' }) };

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
