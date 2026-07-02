/**
 * Migration example: point the official `openai` npm package at the Wattz
 * gateway by overriding `baseURL` and using a Wattz API key. This is the
 * fastest path for existing OpenAI-based projects.
 *
 * The Wattz gateway is a strict superset of the OpenAI schema, so the
 * unmodified `openai` client works. The Wattz-specific metadata (node
 * attestation, region, price) is available on the `wattz` block of a
 * non-streaming response.
 *
 * Requires `openai` installed alongside `@wattz/sdk` in your project
 * (it ships as a devDependency of this package):
 *
 *   npm install openai @wattz/sdk
 *
 * Run with:
 *   WATTZ_API_KEY=sk_... npx tsx examples/with-openai-sdk.ts
 */

import OpenAI from 'openai';

async function main() {
  const openai = new OpenAI({
    apiKey: process.env.WATTZ_API_KEY ?? '',
    baseURL: 'https://api.wattz.fi/v1',
  });

  const res = await openai.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: 'Say hello via Wattz.' }],
  });

  console.log(res.choices[0]?.message?.content);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
