/**
 * Server-Sent Events (SSE) parser. Consumes a `ReadableStream<Uint8Array>`
 * and yields raw `data:` payloads. `parseSSEChunks` layers JSON decoding
 * on top for typed chat completion / embedding deltas.
 */

import { WattzStreamError } from './errors';

const SSE_TERMINATOR = '[DONE]';

export async function* iterateSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const payload = extractDataPayload(rawEvent);
        if (payload !== undefined) {
          if (payload === SSE_TERMINATOR) return;
          yield payload;
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
    // Flush any final event that wasn't terminated by a blank line.
    const remaining = buffer.trim();
    if (remaining.length > 0) {
      const payload = extractDataPayload(remaining);
      if (payload && payload !== SSE_TERMINATOR) yield payload;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // reader may already be released after cancellation
    }
  }
}

function extractDataPayload(rawEvent: string): string | undefined {
  const lines = rawEvent.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    if (line.startsWith(':')) continue; // comment
    if (line.startsWith('data:')) {
      const rest = line.slice(5);
      dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest);
    }
  }
  if (dataLines.length === 0) return undefined;
  return dataLines.join('\n');
}

export async function* parseSSEChunks<T>(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<T, void, unknown> {
  for await (const payload of iterateSSE(body)) {
    try {
      yield JSON.parse(payload) as T;
    } catch (err) {
      throw new WattzStreamError(
        `Failed to parse SSE JSON payload: ${(err as Error).message}. Raw: ${payload.slice(0, 200)}`,
      );
    }
  }
}
