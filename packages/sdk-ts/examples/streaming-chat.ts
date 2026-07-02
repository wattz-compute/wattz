/**
 * Streaming chat completion. Prints tokens as they arrive via SSE.
 *
 * Run with:
 *   WATTZ_API_KEY=sk_... npx tsx examples/streaming-chat.ts
 */

import { WattzClient } from '@wattz/sdk';

async function main() {
  const wattz = new WattzClient({
    apiKey: process.env.WATTZ_API_KEY,
  });

  const stream = wattz.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: 'Write a haiku about a substation at night.' }],
    stream: true,
    require_tee: true,
  });

  let full = '';
  let servingNode: string | undefined;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta.content ?? '';
    if (delta) {
      process.stdout.write(delta);
      full += delta;
    }
    if (chunk.wattz?.node_pubkey) servingNode = chunk.wattz.node_pubkey;
  }
  process.stdout.write('\n');
  console.log('length:', full.length);
  if (servingNode) console.log('served by:', servingNode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
