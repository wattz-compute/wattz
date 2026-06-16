/**
 * Server-sent events (SSE) bridge.
 *
 * Converts a browser-style SSE `ReadableStream` (as produced by fetch()
 * against the Wattz inference gateway) into a `StreamChunk` async
 * iterable that the streamer consumes. The parser is spec-compliant per
 * WHATWG "Server-sent events" section and is deliberately zero-copy on
 * the data path.
 */

import type { StreamChunk } from "./types.js";

const DATA_PREFIX = "data: ";
const DONE_LITERAL = "[DONE]";

export interface SseParseOptions {
  /**
   * Maps a parsed OpenAI event to the number of output tokens it
   * represents. The default counts each non-empty `delta.content` as one
   * token, and each `usage.completion_tokens` delta absolutely.
   */
  countTokens?: (event: OpenAiEvent) => number;
}

export interface OpenAiEvent {
  choices?: Array<{
    delta?: { content?: string; role?: string };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  [k: string]: unknown;
}

/**
 * Consume a `ReadableStream<Uint8Array>` and yield `StreamChunk`s. Each
 * SSE frame (blank-line separated) becomes exactly one chunk. Comments
 * (lines that start with `:`) are dropped.
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
  options: SseParseOptions = {},
): AsyncGenerator<StreamChunk, void, void> {
  const countTokens = options.countTokens ?? defaultTokenCounter;
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let buffer = "";
  let bytesBuffer: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytesBuffer.push(value);
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      // SSE frames are separated by a blank line (\n\n or \r\n\r\n).
      while ((idx = frameBoundary(buffer)) !== -1) {
        const frameText = buffer.slice(0, idx);
        // Advance past the boundary (blank line = 2 or 4 characters).
        const boundaryLen = buffer.slice(idx, idx + 4).startsWith("\r\n\r\n") ? 4 : 2;
        buffer = buffer.slice(idx + boundaryLen);
        const frameBytes = concatSlice(bytesBuffer, frameText.length + boundaryLen);
        bytesBuffer = frameBytes.tail;
        const chunk = frameToChunk(frameText, frameBytes.head, countTokens);
        if (chunk) yield chunk;
        if (chunk?.done) return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function frameBoundary(s: string): number {
  const lf = s.indexOf("\n\n");
  const crlf = s.indexOf("\r\n\r\n");
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

function frameToChunk(
  text: string,
  bytes: Uint8Array,
  countTokens: (event: OpenAiEvent) => number,
): StreamChunk | null {
  const lines = text.split(/\r?\n/);
  let payload = "";
  for (const line of lines) {
    if (line === "" || line.startsWith(":")) continue;
    if (line.startsWith(DATA_PREFIX)) {
      payload += (payload ? "\n" : "") + line.slice(DATA_PREFIX.length);
    }
  }
  if (!payload) return null;
  if (payload === DONE_LITERAL) {
    return { bytes, outputTokens: 0, done: true };
  }
  let outputTokens = 0;
  try {
    const parsed = JSON.parse(payload) as OpenAiEvent;
    outputTokens = countTokens(parsed);
  } catch {
    outputTokens = 0;
  }
  return { bytes, outputTokens, done: false };
}

function defaultTokenCounter(event: OpenAiEvent): number {
  if (typeof event.usage?.completion_tokens === "number") {
    return event.usage.completion_tokens;
  }
  const choices = event.choices ?? [];
  let count = 0;
  for (const choice of choices) {
    const content = choice.delta?.content;
    if (content && content.length > 0) count += 1;
  }
  return count;
}

/**
 * Concatenate the head portion of `chunks` such that the flattened
 * representation covers at least `head` UTF-16 code units. This
 * mirrors the text buffering so the returned byte slice covers exactly
 * the emitted text frame plus trailing boundary.
 */
function concatSlice(
  chunks: Uint8Array[],
  head: number,
): { head: Uint8Array; tail: Uint8Array[] } {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let acc = "";
  const kept: Uint8Array[] = [];
  const spare: Uint8Array[] = [];
  for (const c of chunks) {
    if (acc.length >= head) {
      spare.push(c);
      continue;
    }
    acc += decoder.decode(c, { stream: true });
    kept.push(c);
  }
  // Concatenate `kept` into a single Uint8Array.
  const total = kept.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of kept) {
    out.set(c, offset);
    offset += c.length;
  }
  return { head: out, tail: spare };
}
