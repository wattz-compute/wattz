import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { SafeLink } from '@/components/layout/SafeLink';

const sections = [
  {
    id: 'quickstart',
    label: 'Quickstart',
    body: 'Point any OpenAI client at the Wattz gateway. Response envelope and SSE contract are identical to OpenAI 1.0.',
    code: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.WATTZ_API_KEY,
  baseURL: 'https://api.wattz.fi/v1',
});

const stream = await client.chat.completions.create({
  model: 'llama-3-8b-instruct',
  messages: [{ role: 'user', content: 'Explain Solana Token-2022 hooks.' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}`,
  },
  {
    id: 'model-registry',
    label: 'Model registry',
    body: 'Registry entries live as PDAs seeded with model_id. Each entry stores license, checksum, and version. Publishing a model reserves the PDA and pays a small $WATTZ registration fee.',
    code: `#[account]
pub struct ModelRegistry {
    pub authority: Pubkey,
    pub model_id: String,       // 'llama-3-8b-instruct'
    pub license: LicenseClass,  // Apache | Llama | MIT | OpenRAIL | Commercial
    pub weights_checksum: [u8; 32],
    pub version: u16,
    pub published_at: i64,
    pub kyc_gated: bool,
}`,
  },
  {
    id: 'attestation',
    label: 'Compute attestation',
    body: 'Every inference response carries an attestation quote. Clients that need extra assurance may request a Risc0 or SP1 receipt for the tokenizer + sampler path.',
    code: `POST /v1/chat/completions
{
  "model": "mistral-7b-instruct-v0.3",
  "messages": [...],
  "wattz": {
    "attestation": "sgx",
    "zk_receipt": "risc0"
  }
}

// response tail
data: {"type":"attestation","attestation":{
  "proofHash":"9ab5...",
  "attestationType":"sgx",
  "verifier":"wattz-compute-verifier v0.9.4",
  "timestamp":1735689600000
}}`,
  },
  {
    id: 'settlement',
    label: 'Streaming settlement',
    body: 'Callers pre-authorize a $WATTZ escrow. Each token triggers a Token-2022 transfer hook, splitting revenue between node, host, and treasury. Anchor bulk-settles hourly.',
    code: `SPLIT
  node:     68%   // GPU operator
  host:     22%   // Model publisher
  treasury: 10%   // Buyback + burn, grants, audits`,
  },
  {
    id: 'operator-cli',
    label: 'Operator CLI',
    body: 'npm i -g wattz-cli. The CLI wraps node runtime, key management, and Anchor calls.',
    code: `wattz node init --region us-east
wattz node stake 25000
wattz node start --models llama-3-8b,mistral-7b
wattz infer --model llama-3-8b --prompt 'Hello'
wattz payouts --last 7d`,
  },
];

export default function DocsPage() {
  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="cyan">Public spec</Chip>
            <Chip tone="wire">OpenAI 1.0 compatible</Chip>
          </div>
          <h1 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
            The wire protocol is OpenAI. The settlement is Solana.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cluster-white/70">
            A curated tour of the pieces builders integrate against. The full
            reference lives in{' '}
            <SafeLink
              href="https://github.com/wattz-compute/wattz"
              className="text-cyan-glow hover:underline"
            >
              wattz-inference-gateway
            </SafeLink>
            .
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6">
            {sections.map((s) => (
              <Card key={s.id} className="scroll-mt-24" id={s.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cyan-glow/85">
                      {s.label}
                    </div>
                    <div className="mt-2 font-display text-xl text-cluster-white">
                      {s.body}
                    </div>
                  </div>
                  <SafeLink
                    href={`#${s.id}`}
                    className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/50 hover:text-cyan-glow"
                  >
                    Copy anchor
                  </SafeLink>
                </div>
                <pre className="mt-6 overflow-x-auto rounded-xl border border-cyan-glow/10 bg-night-deep/70 px-4 py-4 font-mono-tech text-[12px] leading-6 text-cluster-white/85">
{s.code}
                </pre>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
