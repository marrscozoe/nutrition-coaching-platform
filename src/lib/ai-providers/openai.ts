import { AIResponse, AIMessage } from '../ai-coach';

const apiKey = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

export async function chatWithOpenAI(
  messages: AIMessage[],
  prompt: string
): Promise<AIResponse> {
  if (!apiKey) {
    return { text: '', error: 'OpenAI API key not configured' };
  }

  try {
    const allMessages = [
      ...messages,
      { role: 'user' as const, content: prompt },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: allMessages,
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      // Check for rate limiting
      if (response.status === 429) {
        return { text: '', error: 'OPENAI_RATE_LIMIT', provider: 'openai', retryable: true };
      }
      return { text: '', error: `OpenAI API error: ${response.status} - ${error}` };
    }

    const data = await response.json();
    return { text: data.choices[0]?.message?.content || '' };
  } catch (err: any) {
    if (err.message?.includes('network') || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { text: '', error: 'OPENAI_NETWORK_ERROR', provider: 'openai', retryable: true };
    }
    return { text: '', error: `OpenAI error: ${err.message || err}` };
  }
}

export async function analyzeImageWithOpenAI(
  imageBase64: string,
  prompt: string
): Promise<AIResponse> {
  if (!apiKey) {
    return { text: '', error: 'OpenAI API key not configured', provider: 'openai' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      // Check for rate limiting
      if (response.status === 429) {
        return { text: '', error: 'OPENAI_RATE_LIMIT', provider: 'openai', retryable: true };
      }
      return { text: '', error: `OpenAI API error: ${response.status} - ${error}`, provider: 'openai' };
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';
    if (!text) {
      return { text: '', error: 'OpenAI returned empty response', provider: 'openai' };
    }
    return { text, provider: 'openai' };
  } catch (err: any) {
    if (err.message?.includes('network') || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { text: '', error: 'OPENAI_NETWORK_ERROR', provider: 'openai', retryable: true };
    }
    return { text: '', error: `OpenAI error: ${err.message || err}`, provider: 'openai' };
  }
}
