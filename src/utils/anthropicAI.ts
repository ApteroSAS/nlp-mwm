import { createParser } from 'eventsource-parser'
import type { ParsedEvent, ReconnectInterval } from 'eventsource-parser'
import type { ChatMessage } from '@/types'
import type { RequestInit } from 'undici';

// I modified the Payload so we can use a model based on the Query String
const defModel = 'claude-3-sonnet-20240229'

export const parseClaudeStream = (rawResponse: Response) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  if (!rawResponse.ok) {
    return new Response(rawResponse.body, {
      status: rawResponse.status,
      statusText: rawResponse.statusText,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = rawResponse.body.getReader();
      let text = '';
      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode(text));
            controller.close();
            break;
          }
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.substring('data:'.length).trim();
              if (data) {
                try {
                  const eventData = JSON.parse(data);
                  if (eventData.type === 'content_block_delta' && eventData.delta.type === 'text_delta') {
                    text += eventData.delta.text;
                  }
                } catch (e) {
                  console.error('Error parsing JSON:', e);
                  // Skip the invalid data and continue processing
                  continue;
                }
              }
            }
          }
        } catch (e) {
          controller.error(e);
          break;
        }
      }
    },
  });

  return new Response(stream);
};

export const generateClaudePayload = (apiKey: string, messages: ChatMessage[], model = defModel, system = ''): RequestInit => ({
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': `${apiKey}`,
    'anthropic-version': '2023-06-01',
  },
  method: 'POST',
  body: JSON.stringify({
    model,
    messages,
    system: system,
    max_tokens: 1024,
    temperature: 0.6,
    stream: true,
  }),
});