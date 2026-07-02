/**
 * Image generation example, hitting `POST /v1/images/generations`.
 *
 * Run with:
 *   WATTZ_API_KEY=sk_... npx tsx examples/images.ts
 */

import { WattzClient } from '@wattz/sdk';

async function main() {
  const wattz = new WattzClient({ apiKey: process.env.WATTZ_API_KEY });

  const res = await wattz.images.generate({
    model: 'stable-diffusion-xl-1.0',
    prompt: 'A giant nighttime substation with glowing cyan power lines and low fog, industrial infrastructure aesthetic, muted palette',
    size: '1024x1024',
    n: 1,
    response_format: 'url',
  });

  for (const image of res.data) {
    if (image.url) console.log('image url:', image.url);
    if (image.revised_prompt) console.log('revised prompt:', image.revised_prompt);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
