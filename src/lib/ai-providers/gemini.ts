import { AIResponse, AIMessage } from '../ai-coach';

const apiKey = process.env.GEMINI_API_KEY || '';
// Gemini 1.5 Flash is free tier eligible: 15 req/min, 1,500/day
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

/**
 * Google Gemini Vision API Provider
 * Uses the free tier: 15 requests/minute, 1,500 requests/day
 * 
 * Environment:
 * - GEMINI_API_KEY: Your Google AI API key
 * - GEMINI_MODEL: Model to use (default: gemini-1.5-flash)
 */
export async function chatWithGemini(
  messages: AIMessage[],
  prompt: string
): Promise<AIResponse> {
  if (!apiKey) {
    return { text: '', error: 'Gemini API key not configured. Set GEMINI_API_KEY environment variable.' };
  }

  try {
    // Convert messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
    
    // Add the new prompt
    geminiMessages.push({
      role: 'user' as const,
      parts: [{ text: prompt }],
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 500,
            topP: 0.95,
            topK: 40,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      const errorMsg = errorData?.error?.message || response.statusText;
      
      // Check for rate limiting
      if (response.status === 429) {
        return { 
          text: '', 
          error: 'GEMINI_RATE_LIMIT',
          provider: 'gemini',
          retryable: true 
        };
      }
      
      return { text: '', error: `Gemini API error: ${response.status} - ${errorMsg}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return { text };
  } catch (err: any) {
    // Check for network errors that might be retryable
    if (err.message?.includes('network') || err.code === 'ENOTFOUND') {
      return { 
        text: '', 
        error: 'GEMINI_NETWORK_ERROR',
        provider: 'gemini',
        retryable: true 
      };
    }
    return { text: '', error: `Gemini error: ${err.message || err}` };
  }
}

export async function analyzeImageWithGemini(
  imageBase64: string,
  prompt: string
): Promise<AIResponse> {
  if (!apiKey) {
    return { 
      text: '', 
      error: 'Gemini API key not configured. Set GEMINI_API_KEY environment variable.',
      provider: 'gemini'
    };
  }

  try {
    // Convert base64 to mime type - assume JPEG by default
    const mimeType = 'image/jpeg';
    const imageData = `data:${mimeType};base64,${imageBase64}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 1024,
            topP: 0.95,
            topK: 40,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      const errorMsg = errorData?.error?.message || response.statusText;
      
      // Check for rate limiting - return special error for fallback logic
      if (response.status === 429) {
        return { 
          text: '', 
          error: 'GEMINI_RATE_LIMIT',
          provider: 'gemini',
          retryable: true 
        };
      }
      
      // Check for quota errors
      if (errorMsg?.includes('quota') || errorMsg?.includes('limit')) {
        return { 
          text: '', 
          error: 'GEMINI_QUOTA_EXCEEDED',
          provider: 'gemini',
          retryable: true 
        };
      }
      
      return { text: '', error: `Gemini API error: ${response.status} - ${errorMsg}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      return { text: '', error: 'Gemini returned empty response' };
    }
    
    return { text };
  } catch (err: any) {
    // Check for network errors
    if (err.message?.includes('network') || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { 
        text: '', 
        error: 'GEMINI_NETWORK_ERROR',
        provider: 'gemini',
        retryable: true 
      };
    }
    return { text: '', error: `Gemini error: ${err.message || err}` };
  }
}

/**
 * Check if Gemini API is available and working
 * Useful for health checks and fallback decisions
 */
export async function checkGeminiHealth(): Promise<{ available: boolean; error?: string }> {
  if (!apiKey) {
    return { available: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${MODEL}?key=${apiKey}`,
      { method: 'GET' }
    );

    if (response.ok) {
      return { available: true };
    }

    return { available: false, error: `HTTP ${response.status}` };
  } catch (err: any) {
    return { available: false, error: err.message };
  }
}
// redeploy trigger
