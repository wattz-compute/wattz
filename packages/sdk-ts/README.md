# @wattz/sdk

TypeScript SDK for the Wattz Solana AI Inference Marketplace. OpenAI-compatible
API surface. Streaming responses over SSE. Native fetch, no runtime
dependencies.

## Install

```bash
npm install @wattz/sdk
# or
pnpm add @wattz/sdk
```

Requires Node.js 18+ (global `fetch`, `ReadableStream`, `AbortController`).

## Quick start

```ts
import { WattzClient } from '@wattz/sdk';

const wattz = new WattzClient({
  apiKey: process.env.WATTZ_API_KEY,
  // baseURL defaults to https://api.wattz.fi/v1
});

const res = await wattz.chat.completions.create({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: 'Explain TEE attestation in one line.' }],
});

console.log(res.choices[0].message.content);
console.log('served by node:', res.wattz?.node_pubkey);
```

## Streaming

```ts
const stream = wattz.chat.completions.create({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: 'Stream a haiku.' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta.content ?? '');
}
```

## Namespaces

| Namespace         | Endpoint                        | Description                                    |
| ----------------- | ------------------------------- | ---------------------------------------------- |
| `chat.completions` | `POST /v1/chat/completions`     | Chat completions, streaming or one-shot        |
| `embeddings`      | `POST /v1/embeddings`           | Sentence embeddings (bge, gte, mxbai, ...)     |
| `images`          | `POST /v1/images/generations`   | SDXL / SD1.5 / Flux image generation           |
| `models`          | `GET /v1/models`                | Model registry (Llama, GPT-OSS, SDXL, Whisper) |
| `nodes`           | `GET /v1/nodes`                 | Active GPU node fleet with attestation metadata |

## Errors

```ts
import {
  WattzAPIError,
  WattzAuthenticationError,
  WattzRateLimitError,
  WattzTimeoutError,
} from '@wattz/sdk';
```

Non-2xx responses raise a `WattzAPIError` subclass. 429 and 5xx are retried
with exponential backoff up to `maxRetries` (default 2). `retry-after` is
honored on 429.

## OpenAI SDK drop-in

The Wattz gateway is a strict superset of the OpenAI Chat/Embeddings/Images
schema. Existing OpenAI-based projects can migrate by pointing the official
`openai` client at Wattz:

```ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.WATTZ_API_KEY,
  baseURL: 'https://api.wattz.fi/v1',
});
```

See `examples/with-openai-sdk.ts`.

## Wattz metadata envelope

Every response includes an optional `wattz` object with:

- `node_pubkey` and `operator` (Solana pubkeys)
- `region` (routing region label)
- `attestation_kind` (`relay` on the bootstrap path; `sgx`, `sev`, `nvidia_cc`, `risc0`, `sp1`, or `none` on the node path)
- `attestation_hash` (TEE quote hash or ZK proof hash)
- `price_lamports` (paid amount for the request)
- `settlement_signature` (Solana tx signature once settlement lands)

## License

Apache-2.0.
