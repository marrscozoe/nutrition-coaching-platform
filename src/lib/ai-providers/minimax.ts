import { AIResponse, AIMessage } from '../ai-coach';

const apiKey = process.env.MINIMAX_API_KEY || '';
const GROUP_ID = process.env.MINIMAX_GROUP_ID || '';
const MODEL = process.env.MINIMAX_MODEL || 'abab6.5s-chat';

// MiniMax API endpoint
const BASE_URL = 'https://api.minimax.chat/v1';

/**
 * MiniMax AI Provider
 * 
 * Environment:
 * - MINIMAX_API_KEY: Your MiniMax API key
 * - MINIMAX_GROUP_ID: Your MiniMax Group ID
 * - MINIMAX_MODEL: Model to use (default: abab6.5s-chat)
 */
export async function chatWithMinimax(
  messages: AIMessage[],
  prompt: string
): Promise<AIResponse> {
  if (!apiKey || !GROUP_ID) {
    return { 
      text: '', 
      error: 'MiniMax API key or Group ID not configured. Set MINIMAX_API_KEY and MINIMAX_GROUP_ID environment variables.' 
    };
  }

  try {
    const allMessages = [
      ...messages,
      { role: 'user' as const, content: prompt },
    ];

    const response = await fetch(`${BASE_URL}/text/chatcompletion_v2?GroupId=${GROUP_ID}`, {
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
    // Check for network errors
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
  if (!apiKey || !GROUP_ID) {
    return { 
      text: '', 
      error: 'MiniMax API key or Group ID not configured. Set MINIMAX_API_KEY and MINIMAX_GROUP_ID environment variables.',
      provider: 'minimax'
    };
  }

  try {
    // MiniMax supports image input via URL or base64
    // For base64, we need to determine the image type
    const imageType = detectImageType(imageBase64);
    const imageUrl = `data:${imageType};base64,${imageBase64}`;

    const response = await fetch(`${BASE_URL}/text/chatcompletion_v2?GroupId=${GROUP_ID}`, {
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
                image_url: {
                  url: imageUrl,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      
      // Check for rate limiting
      if (response.status === 429) {
        return { 
          text: '', 
          error: 'MINIMAX_RATE_LIMIT',
          provider: 'minimax',
          retryable: true 
        };
      }
      
      // Check for quota errors
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
    // Check for network errors
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

/**
 * Detect image type from base64 data
 */
function detectImageType(base64: string): string {
  // Check for common image signatures
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGO')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg'; // Default
}

/**
 * Check if MiniMax API is available
 */
export async function checkMinimaxHealth(): Promise<{ available: boolean; error?: string }> {
  if (!apiKey || !GROUP_ID) {
    return { available: false, error: 'API key or Group ID not configured' };
  }

  try {
    const response = await fetch(`${BASE_URL}/text/chatcompletion_v2?GroupId=${GROUP_ID}`, {
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
