/**
 * Basic non-streaming chat completion against the Wattz gateway.
 *
 * Run with:
 *   WATTZ_API_KEY=sk_... npx tsx examples/basic-chat.ts
 */

import { WattzClient } from '@wattz/sdk';

async function main() {
  const wattz = new WattzClient({
    apiKey: process.env.WATTZ_API_KEY,
  });

  const res = await wattz.chat.completions.create({
    model: 'llama-3-8b-instruct',
    messages: [
      { role: 'system', content: 'You are a concise industrial-infrastructure historian.' },
      { role: 'user', content: 'Explain what a substation does in two sentences.' },
    ],
    temperature: 0.4,
    max_tokens: 200,
  });

  console.log('Answer:', res.choices[0]?.message.content);
  console.log('Tokens:', res.usage.total_tokens);
  if (res.wattz) {
    console.log('Served by:', res.wattz.node_pubkey, 'region:', res.wattz.region);
    console.log('Attestation:', res.wattz.attestation_kind, res.wattz.attestation_hash.slice(0, 16));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
