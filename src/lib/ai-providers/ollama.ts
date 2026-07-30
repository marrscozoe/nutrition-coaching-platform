import { AIResponse, AIMessage } from '../ai-coach';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

export async function chatWithOllama(
  messages: AIMessage[],
  prompt: string
): Promise<AIResponse> {
  try {
    const allMessages = [
      ...messages,
      { role: 'user' as const, content: prompt },
    ];

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: allMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { text: '', error: `Ollama API error: ${response.status}` };
    }

    const data = await response.json();
    return { text: data.message?.content || '' };
  } catch (err) {
    return { text: '', error: `Ollama error: ${err}. Make sure Ollama is running locally.` };
  }
}

export async function analyzeImageWithOllama(
  imageBase64: string,
  prompt: string
): Promise<AIResponse> {
  // Ollama doesn't support vision in the same way - fallback to text analysis
  // In production, you'd use a vision-capable model like llava
  return {
    text: '',
    error: 'Image analysis requires OpenAI GPT-4o or similar vision model. Please use text description for now.',
  };
}
