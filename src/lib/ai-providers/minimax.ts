import { AIResponse, AIMessage } from '../ai-coach';

const apiKey = process.env.MINIMAX_API_KEY || '';
const MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

// MiniMax API endpoint - includes v1 path
const BASE_URL = 'https://api.minimax.io/v1';

/**
 * MiniMax AI Provider
 * 
 * Environment:
 * - MINIMAX_API_KEY: *** API key
 * - MINIMAX_MODEL: Model to use (default: MiniMax-M2.7)
 */
export async function chatWithMinimax(
  messages: AIMessage[],
  prompt: string
): Promise<AIResponse> {
  if (!apiKey) {
    return { 
      text: '', 
      error: 'MiniMax API key not configured. Set MINIMAX_API_KEY environment variable.' 
    };
  }

  try {
    const allMessages = [
      ...messages,
      { role: 'user' as const, content: prompt },
    ];

    const response = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: allMessages,
        max_tokens: 500,
        temperature: 0.3,
        thinking: { type: 'off' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (response.status === 429) {
        return { 
          text: '', 
          error: 'MINIMAX_RATE_LIMIT',
          provider: 'minimax',
          retryable: true 
        };
      }
      
      return { text: '', error: `MiniMax API error: ${response.status} - ${error}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    return { text };
  } catch (err: any) {
    if (err.message?.includes('network') || err.code === 'ENOTFOUND') {
      return { 
        text: '', 
        error: 'MINIMAX_NETWORK_ERROR',
        provider: 'minimax',
        retryable: true 
      };
    }
    return { text: '', error: `MiniMax error: ${err.message || err}` };
  }
}

export async function analyzeImageWithMinimax(
  imageBase64: string,
  prompt: string
): Promise<AIResponse> {
  if (!apiKey) {
    return { 
      text: '', 
      error: 'MiniMax API key not configured. Set MINIMAX_API_KEY environment variable.',
      provider: 'minimax'
    };
  }

  try {
    const imageUrl = imageBase64;

    const response = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            contents: [
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.3,
        thinking: { type: 'off' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (response.status === 429) {
        return { 
          text: '', 
          error: 'MINIMAX_RATE_LIMIT',
          provider: 'minimax',
          retryable: true 
        };
      }
      
      if (error.includes('quota') || error.includes('limit')) {
        return { 
          text: '', 
          error: 'MINIMAX_QUOTA_EXCEEDED',
          provider: 'minimax',
          retryable: true 
        };
      }
      
      return { text: '', error: `MiniMax API error: ${response.status} - ${error}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    if (!text) {
      return { text: '', error: 'MiniMax returned empty response' };
    }
    
    return { text };
  } catch (err: any) {
    if (err.message?.includes('network') || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { 
        text: '', 
        error: 'MINIMAX_NETWORK_ERROR',
        provider: 'minimax',
        retryable: true 
      };
    }
    return { text: '', error: `MiniMax error: ${err.message || err}` };
  }
}

function detectImageType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGO')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

export async function checkMinimaxHealth(): Promise<{ available: boolean; error?: string }> {
  if (!apiKey) {
    return { available: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });

    if (response.ok) {
      return { available: true };
    }

    return { available: false, error: `HTTP ${response.status}` };
  } catch (err: any) {
    return { available: false, error: err.message };
  }
}
