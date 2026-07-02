'use client';

import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { CopyAddress } from '@/components/ui/CopyAddress';
import { SafeLink } from '@/components/layout/SafeLink';
import { cn } from '@/lib/cn';
import { shortHash } from '@/lib/format';

const github = process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';
const PROGRAM_ID =
  process.env.NEXT_PUBLIC_2_PROGRAM_ID?.trim() ||
  'GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU';
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const programExplorer = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${cluster}`;

const RELAY_DISCLOSURE =
  'Inference is relayed through Groq LPU capacity until the first bare-metal node registers. The wire protocol does not change.';

function CopyButton({
  text,
  label = 'copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 900);
    } catch {
      // Clipboard unavailable; text stays selectable.
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy to clipboard"
      className={cn(
        'shrink-0 rounded border border-cyan-glow/25 bg-night-deep/80 px-2 py-0.5 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/70 transition-colors hover:border-cyan-glow/60 hover:text-cluster-white',
        className,
      )}
    >
      {copied ? 'copied' : label}
    </button>
  );
}

function CopyAnchorButton({ anchorId }: { anchorId: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onCopy = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}#${anchorId}`
        : `#${anchorId}`;
    try {
      await navigator.clipboard.writeText(url);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${anchorId}`);
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 900);
    } catch {
      // Clipboard unavailable.
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="shrink-0 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45 transition-colors hover:text-cyan-glow"
    >
      {copied ? 'link copied' : 'copy link'}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <CopyButton text={code} className="absolute right-3 top-3 z-10" />
      <pre className="overflow-x-auto whitespace-pre rounded-xl border border-cyan-glow/10 bg-night-deep/70 px-4 py-4 pr-16 font-mono-tech text-[12px] leading-6 text-cluster-white/85">
{code}
      </pre>
    </div>
  );
}

function DocSection({
  id,
  label,
  title,
  children,
}: {
  id: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cyan-glow/85">
            {label}
          </div>
          <h2 className="mt-2 font-display text-xl text-cluster-white">{title}</h2>
        </div>
        <CopyAnchorButton anchorId={id} />
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-3xl text-sm leading-7 text-cluster-white/70">{children}</p>
  );
}

interface ProgramData {
  programId: string;
  cluster: string;
  account: {
    executable: boolean;
    owner: string;
    lamports: number;
    dataLen: number;
  } | null;
  signatures: {
    signature: string;
    slot: number;
    blockTime: number | null;
    err: unknown;
  }[];
}

function ProgramInspector() {
  const [data, setData] = useState<ProgramData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/program', { cache: 'no-store' });
        if (!res.ok) throw new Error(`program ${res.status}`);
        const json = (await res.json()) as ProgramData;
        if (alive) {
          setData(json);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const account = data?.account ?? null;

  return (
    <Card id="program-inspector" glow="gold" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cyan-glow/85">
            Live program inspector
          </div>
          <h2 className="mt-2 font-display text-xl text-cluster-white">
            Read straight from devnet
          </h2>
        </div>
        <SafeLink
          href={programExplorer}
          className="chip text-[10px] hover:border-cyan-glow/60"
        >
          Open on Explorer
        </SafeLink>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="chip gold text-[10px]">
          <span className="dot" /> program id
        </span>
        <CopyAddress address={PROGRAM_ID} />
      </div>

      {loading ? (
        <div className="mt-6 font-mono-tech text-xs uppercase tracking-widest text-cluster-white/50">
          querying getAccountInfo...
        </div>
      ) : error ? (
        <div className="mt-6 font-mono-tech text-xs uppercase tracking-widest text-fog">
          devnet RPC unreachable -- retry shortly
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric
              label="executable"
              value={account?.executable ? 'true' : 'false'}
            />
            <Metric label="data length" value={`${account?.dataLen ?? 0} B`} />
            <Metric
              label="lamports"
              value={(account?.lamports ?? 0).toLocaleString()}
            />
            <Metric label="cluster" value={data?.cluster ?? 'devnet'} />
          </div>
          {account?.owner ? (
            <div className="mt-4">
              <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45">
                owner
              </div>
              <code className="break-all font-mono-tech text-[11px] text-cluster-white/80">
                {account.owner}
              </code>
            </div>
          ) : null}

          <div className="mt-6">
            <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45">
              recent signatures
            </div>
            {data && data.signatures.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {data.signatures.map((s) => (
                  <li key={s.signature} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        s.err ? 'bg-wire-glow' : 'bg-cyan-glow',
                      )}
                      aria-hidden="true"
                    />
                    <SafeLink
                      href={`https://explorer.solana.com/tx/${s.signature}?cluster=devnet`}
                      className="font-mono-tech text-[11px] text-cyan-glow/90 hover:underline"
                    >
                      {shortHash(s.signature, 8, 8)}
                    </SafeLink>
                    <span className="font-mono-tech text-[10px] text-cluster-white/45">
                      slot {s.slot.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 font-mono-tech text-[11px] text-cluster-white/50">
                no signatures yet
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45">
        {label}
      </div>
      <div className="mt-0.5 font-mono-tech text-sm text-cluster-white">{value}</div>
    </div>
  );
}

const endpoints: { method: 'GET' | 'POST'; path: string; note: string }[] = [
  {
    method: 'GET',
    path: '/v1/models',
    note: 'Registry snapshot in OpenAI list format. Relay-live models are selectable now; native-only models list as awaiting node.',
  },
  {
    method: 'POST',
    path: '/v1/chat/completions',
    note: 'Chat completions, streaming or blocking. Request and response envelopes are OpenAI-identical.',
  },
  {
    method: 'POST',
    path: '/v1/embeddings',
    note: 'Embedding vectors. OpenAI-compatible request shape; served once an embedding node registers.',
  },
  {
    method: 'POST',
    path: '/v1/images/generations',
    note: 'Image generation. Awaiting a native image node before it accepts traffic.',
  },
  { method: 'GET', path: '/healthz', note: 'Liveness probe. Returns 200 while the process is up.' },
  { method: 'GET', path: '/metrics', note: 'Prometheus exposition for the gateway.' },
  {
    method: 'GET',
    path: '/v1/network/stats',
    note: 'Live network counters: relay-live model count, catalog size, relay state, external node count.',
  },
];

const QUICKSTART = `import OpenAI from 'openai';

const client = new OpenAI({
  // Keys are optional during the bootstrap phase (see Authentication).
  apiKey: process.env.WATTZ_API_KEY ?? 'not-required-yet',
  baseURL: 'https://api.wattz.fi/v1',
});

const stream = await client.chat.completions.create({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: 'Summarize the Wattz settlement flow.' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}`;

const CURL = `curl https://api.wattz.fi/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -H 'authorization: Bearer $WATTZ_API_KEY' \\
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{ "role": "user", "content": "ping" }],
    "stream": true
  }'`;

const SSE_TRANSCRIPT = `data: {"id":"chatcmpl-932aed98","object":"chat.completion.chunk",
       "model":"llama-3.1-8b-instant",
       "choices":[{"index":0,"delta":{"role":"assistant","content":""},
                   "finish_reason":null}]}

data: {"id":"chatcmpl-932aed98","object":"chat.completion.chunk",
       "model":"llama-3.1-8b-instant",
       "choices":[{"index":0,"delta":{"content":"Hello"},
                   "finish_reason":null}]}

data: {"id":"chatcmpl-932aed98","object":"chat.completion.chunk",
       "model":"llama-3.1-8b-instant",
       "choices":[{"index":0,"delta":{},"finish_reason":"stop"}],
       "usage":{"prompt_tokens":42,"completion_tokens":5,"total_tokens":47}}

data: [DONE]`;

const WATTZ_BLOCK = `{
  "id": "chatcmpl-497b18ef",
  "object": "chat.completion",
  "model": "llama-3.1-8b-instant",
  "choices": [ /* ...standard OpenAI choices... */ ],
  "usage": { "prompt_tokens": 42, "completion_tokens": 6, "total_tokens": 48 },
  "wattz": {
    "request_id": "f6f101ee-0a06-4b5f-8a25-1da173229ffd",
    "provider": "groq",
    "node": {
      "pubkey": "GroqUsEast11111111111111111111111111111111",
      "region": "us-east",
      "is_bootstrap_fallback": true
    },
    "attestation": { "verified": false, "kind": "relay" },
    "settlement": { "simulated": true, "receipt_pda": "48JHQd9U...", "slot": null },
    "price_lamports": 1
  }
}`;

const RESPONSE_HEADERS = `x-wattz-node:        GroqUsEast11111111111111111111111111111111
x-wattz-region:      us-east
x-wattz-attestation: relay
x-wattz-request-id:  f6f101ee-0a06-4b5f-8a25-1da173229ffd`;

const NATIVE_FRAME = `// Emitted only by native Wattz nodes -- not present on the bootstrap
// relay. On the relay path attestation is { "verified": false, "kind": "relay" }.
data: {"type":"attestation","attestation":{
  "verified": true,
  "kind": "sgx"        // sgx | sev-snp | nvidia-cc | risc0 | sp1
}}`;

const REGISTRY = `#[account]
pub struct ModelRegistry {
    pub authority: Pubkey,
    pub model_id: String,       // 'llama-3.1-8b-instant'
    pub license: LicenseClass,  // Apache | Llama | MIT | OpenRAIL | Commercial
    pub weights_checksum: [u8; 32],
    pub version: u16,
    pub published_at: i64,
    pub kyc_gated: bool,
}`;

const SPLIT = `SETTLEMENT SPLIT   // anchor-program constants.rs
  node immediate    80%   // released on settlement
  node pending      10%   // held through the dispute window
  model publisher    5%   // registry royalty
  project fee        5%   // of which half is burned:
                          //   BURN_RATE_BPS = 5000 (50% of project fee) -> 2.5% of price,
                          //   burned via a direct SPL Token Burn CPI`;

const CLI = `npm install -g wattz-cli
wattz node init --region us-east --gpu rtx-4090
wattz node keys generate
wattz node register
wattz node start --models llama-3.1-8b-instant
wattz node logs --follow`;

export default function DocsPage() {
  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="cyan">Public spec</Chip>
            <Chip tone="wire">OpenAI 1.0 compatible</Chip>
            <Chip tone="gold">devnet</Chip>
          </div>
          <h1 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
            The wire protocol is OpenAI. The settlement is Solana.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cluster-white/70">
            A tour of what builders integrate against. The full reference lives
            in{' '}
            <SafeLink
              href={`https://github.com/${github}`}
              className="text-cyan-glow hover:underline"
            >
              {github}
            </SafeLink>
            .
          </p>

          {/* Bootstrap-phase honesty callout */}
          <div className="mt-8 rounded-2xl border border-wire-glow/40 bg-night-deep/50 p-6">
            <div className="font-mono-tech text-[10px] uppercase tracking-widest text-wire-glow/90">
              Where this stands today
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-cluster-white/75">
              <li>
                Wattz runs on Solana <span className="text-cluster-white">devnet</span>. The
                settlement program is deployed and live below.
              </li>
              <li>{RELAY_DISCLOSURE}</li>
              <li>
                Attestation frames ship with native nodes. The bootstrap relay
                path reports{' '}
                <code className="font-mono-tech text-[12px] text-cluster-white/85">
                  {'{ verified: false, kind: "relay" }'}
                </code>
                .
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="chip gold text-[10px]">
                <span className="dot" /> program id
              </span>
              <CopyAddress address={PROGRAM_ID} />
            </div>
          </div>

          {/* Live program inspector */}
          <div className="mt-8">
            <ProgramInspector />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6">
            <DocSection
              id="quickstart"
              label="Quickstart"
              title="Point any OpenAI client at the gateway"
            >
              <Body>
                The response envelope and SSE contract are identical to OpenAI
                1.0. Change the base URL and you are done. During the bootstrap
                phase the Authorization header is optional.
              </Body>
              <CodeBlock code={QUICKSTART} />
              <Body>Or with curl:</Body>
              <CodeBlock code={CURL} />
            </DocSection>

            <DocSection
              id="endpoints"
              label="Endpoint reference"
              title="Surface the gateway exposes"
            >
              <div className="overflow-hidden rounded-xl border border-cyan-glow/10">
                {endpoints.map((e, i) => (
                  <div
                    key={e.path}
                    className={cn(
                      'flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4',
                      i > 0 && 'border-t border-cyan-glow/[0.06]',
                    )}
                  >
                    <div className="flex items-center gap-3 sm:w-64 sm:shrink-0">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-mono-tech text-[10px] uppercase tracking-widest',
                          e.method === 'GET'
                            ? 'border border-cyan-glow/40 text-cyan-glow'
                            : 'border border-wire-glow/40 text-wire-glow',
                        )}
                      >
                        {e.method}
                      </span>
                      <code className="font-mono-tech text-[12px] text-cluster-white/90">
                        {e.path}
                      </code>
                    </div>
                    <span className="text-[13px] leading-6 text-cluster-white/65">
                      {e.note}
                    </span>
                  </div>
                ))}
              </div>
            </DocSection>

            <DocSection
              id="streaming"
              label="Streaming format"
              title="Raw OpenAI chunks over SSE"
            >
              <Body>
                Streaming responses are unmodified OpenAI chat completion chunks,
                one per{' '}
                <code className="font-mono-tech text-[12px] text-cluster-white/85">
                  data:
                </code>{' '}
                line, terminated by{' '}
                <code className="font-mono-tech text-[12px] text-cluster-white/85">
                  data: [DONE]
                </code>
                . No Wattz-specific frames are injected into the stream on the
                relay path. The final chunk carries the usage block. Below is a
                trimmed real transcript captured from api.wattz.fi.
              </Body>
              <CodeBlock code={SSE_TRANSCRIPT} />
            </DocSection>

            <DocSection
              id="attestation"
              label="Attestation and metadata"
              title="What the gateway stamps on a response"
            >
              <Body>
                Non-streaming responses carry a{' '}
                <code className="font-mono-tech text-[12px] text-cluster-white/85">
                  wattz
                </code>{' '}
                metadata block alongside the standard OpenAI fields. On the
                bootstrap relay path the attestation is honest about its origin:
                it is not a hardware attestation.
              </Body>
              <CodeBlock code={WATTZ_BLOCK} />
              <Body>
                The same routing metadata is mirrored onto response headers (and
                exposed via CORS):
              </Body>
              <CodeBlock code={RESPONSE_HEADERS} />
              <Body>
                Native Wattz nodes emit an additional streamed attestation frame.
                It is not present on the bootstrap relay and only appears once a
                bare-metal node serves the request:
              </Body>
              <CodeBlock code={NATIVE_FRAME} />
            </DocSection>

            <DocSection
              id="authentication"
              label="Authentication"
              title="Open during bootstrap"
            >
              <Body>
                API keys are not enforced during the bootstrap phase; the gateway
                is open and rate-limited. Key issuance ships with mainnet
                settlement. The Authorization header is accepted and ignored
                today, so you can wire it in now and it will start mattering
                later.
              </Body>
              <CodeBlock
                code={`# Optional today, required at mainnet settlement.
authorization: Bearer $WATTZ_API_KEY`}
              />
            </DocSection>

            <DocSection
              id="model-registry"
              label="Model registry"
              title="Models live as on-chain PDAs"
            >
              <Body>
                Registry entries live as PDAs seeded with the model id. Each
                entry stores license, weights checksum, and version. Publishing a
                model reserves the PDA and, at launch, pays a small $WATTZ
                registration fee.
              </Body>
              <CodeBlock code={REGISTRY} />
            </DocSection>

            <DocSection
              id="settlement"
              label="Settlement"
              title="Fees split and burn on-chain"
            >
              <Body>
                Callers pre-authorize an escrow. On settlement the Anchor program
                splits the fee per{' '}
                <code className="font-mono-tech text-[12px] text-cluster-white/85">
                  constants.rs
                </code>{' '}
                and burns half of the project fee directly. Token-2022 streaming
                settlement activates with the $WATTZ mint at launch.
              </Body>
              <CodeBlock code={SPLIT} />
            </DocSection>

            <DocSection
              id="operator-cli"
              label="Operator CLI"
              title="Run a node from the terminal"
            >
              <Body>
                The CLI wraps the node runtime, key management, and Anchor calls.
                Registration is live on devnet now.
              </Body>
              <CodeBlock code={CLI} />
              <div className="flex flex-wrap gap-4 pt-1 font-mono-tech text-[11px] text-cluster-white/50">
                <SafeLink href="/status" className="hover:text-cyan-glow">
                  Grid status -&gt;
                </SafeLink>
                <SafeLink href="/receipts" className="hover:text-cyan-glow">
                  Settlement receipts -&gt;
                </SafeLink>
                <SafeLink href="/operator" className="hover:text-cyan-glow">
                  Operator -&gt;
                </SafeLink>
              </div>
            </DocSection>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
