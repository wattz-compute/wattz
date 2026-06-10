/**
 * Embeddings example. Wattz exposes standard sentence-transformer models
 * (bge-large, gte-large) through the OpenAI-compatible endpoint.
 *
 * Run with:
 *   WATTZ_API_KEY=sk_... npx tsx examples/embeddings.ts
 */

import { WattzClient } from '@wattz/sdk';

async function main() {
  const wattz = new WattzClient({ apiKey: process.env.WATTZ_API_KEY });

  const res = await wattz.embeddings.create({
    model: 'bge-large-en-v1.5',
    input: [
      'A substation transforms high voltage transmission current into distribution current.',
      'A GPU inference node performs matrix multiplications against a compiled model graph.',
    ],
  });

  for (const embedding of res.data) {
    console.log(`vector[${embedding.index}] dim=${embedding.embedding.length}`);
  }
  console.log('prompt tokens:', res.usage.prompt_tokens);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
