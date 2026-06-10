/**
 * Migration example: point the official `openai` npm package at the Wattz
 * gateway by overriding `baseURL` and using a Wattz API key. This is the
 * fastest path for existing OpenAI-based projects.
 *
 * The Wattz gateway is a strict superset of the OpenAI schema, so the
 * unmodified `openai` client works. The Wattz-specific metadata (node
 * attestation, region, settlement signature) is available on
 * `response.wattz`; the OpenAI SDK will preserve it under its own
 * `x-additional-properties` bag depending on the version.
 *
 * Requires `openai` installed alongside `@wattz/sdk` in your project.
 *
 *   npm install openai @wattz/sdk
 *
 * Run with:
 *   WATTZ_API_KEY=sk_... npx tsx examples/with-openai-sdk.ts
 */

// The import path is left as a comment so the SDK's own tsc does not
// require `openai` as a peer dependency. Uncomment in a consumer project.
// import OpenAI from 'openai';

async function main() {
  // const openai = new OpenAI({
  //   apiKey: process.env.WATTZ_API_KEY,
  //   baseURL: 'https://api.wattz.fi/v1',
  // });
  //
  // const res = await openai.chat.completions.create({
  //   model: 'llama-3-8b-instruct',
  //   messages: [{ role: 'user', content: 'Say hello via Wattz.' }],
  // });
  //
  // console.log(res.choices[0]?.message?.content);

  console.log('See the block above. Uncomment when `openai` is installed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
