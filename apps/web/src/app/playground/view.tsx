'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ModelSelector } from '@/components/playground/ModelSelector';
import { PromptInput } from '@/components/playground/PromptInput';
import { ResponseStream, type StreamStatus } from '@/components/playground/ResponseStream';
import { PricePanel } from '@/components/playground/PricePanel';
import { AttestationBadge } from '@/components/playground/AttestationBadge';
import { CodeSnippet } from '@/components/playground/CodeSnippet';
import { Chip } from '@/components/ui/Chip';
import type { AttestationSummary, ModelDescriptor, RouteMeta } from '@/lib/api';
import { fetchModels, streamInference } from '@/lib/api';
import { formatMs, formatTps } from '@/lib/format';

const DEFAULT_PROMPT =
  'You are on a Solana AI inference marketplace called Wattz. Introduce yourself in three concise sentences to a builder who has never heard of it.';
const SYSTEM_PROMPT = 'You are Wattz, a Solana-native inference marketplace assistant.';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 512;
const RELAY_DISCLOSURE =
  'Inference is relayed through Groq LPU capacity until the first bare-metal node registers. The wire protocol does not change.';

function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

export function PlaygroundView() {
  return (
    <Suspense fallback={<PlaygroundFallback />}>
      <Playground />
    </Suspense>
  );
}

function Playground() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modelsQuery = useQuery({ queryKey: ['models'], queryFn: fetchModels });

  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAfterMs, setRetryAfterMs] = useState<number | null>(null);
  const [meta, setMeta] = useState<RouteMeta | null>(null);
  const [attestation, setAttestation] = useState<AttestationSummary | null>(null);
  const [tokensOut, setTokensOut] = useState(0);
  const [tokensOutEstimated, setTokensOutEstimated] = useState(true);
  const [tokensIn, setTokensIn] = useState(0);
  const [tokensInEstimated, setTokensInEstimated] = useState(true);
  const [tokensPerSec, setTokensPerSec] = useState<number | null>(null);
  const [ttfbMs, setTtfbMs] = useState<number | null>(null);
  const [streamMs, setStreamMs] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const submitAtRef = useRef<number | null>(null);
  const firstDeltaAtRef = useRef<number | null>(null);
  const usageOutRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const streamingRef = useRef(false);

  useEffect(() => {
    streamingRef.current = status === 'streaming';
  }, [status]);

  const models: ModelDescriptor[] = useMemo(() => modelsQuery.data || [], [modelsQuery.data]);
  const selectedModel = useMemo(
    () => models.find((m) => m.id === selected),
    [models, selected],
  );

  // Hydrate model + prompt from the URL once, before defaults kick in.
  useEffect(() => {
    const m = searchParams.get('model');
    const p = searchParams.get('prompt');
    if (m) setSelected(m);
    if (p) setPrompt(p);
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default / validate selection: only a selectable (relay-live) model can be
  // active. Falls back to Llama 3.1 8B Instant.
  useEffect(() => {
    if (!models.length) return;
    const selectable = models.filter((m) => m.selectable);
    if (selected && selectable.some((m) => m.id === selected)) return;
    const def = selectable.find((m) => m.id === DEFAULT_MODEL) || selectable[0];
    if (def) setSelected(def.id);
  }, [models, selected]);

  // Live input-token estimate while idle; replaced by the usage frame's real
  // count once a run reports it.
  useEffect(() => {
    if (streamingRef.current) return;
    setTokensIn(estimateTokens(prompt));
    setTokensInEstimated(true);
  }, [prompt]);

  // Keep the shareable permalink in sync with model + prompt.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (selected) params.set('model', selected);
      if (prompt) params.set('prompt', prompt);
      router.replace(`/playground?${params.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [selected, prompt, router]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    runIdRef.current += 1; // orphan the in-flight generator
    setStatus((prev) => (prev === 'streaming' ? (content ? 'complete' : 'idle') : prev));
  }, [content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && streamingRef.current) stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop]);

  const submit = useCallback(async () => {
    const model = selectedModel;
    if (!model || !model.selectable) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    const isCurrent = () => runId === runIdRef.current;

    setStatus('streaming');
    setContent('');
    setErrorMessage(null);
    setRetryAfterMs(null);
    setMeta(null);
    setAttestation(null);
    setTokensOut(0);
    setTokensOutEstimated(true);
    setTokensIn(estimateTokens(prompt));
    setTokensInEstimated(true);
    setTokensPerSec(null);
    setTtfbMs(null);
    setStreamMs(null);
    setTotalMs(null);
    submitAtRef.current = performance.now();
    firstDeltaAtRef.current = null;
    usageOutRef.current = null;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: prompt },
    ];
    let accumulated = '';

    try {
      for await (const event of streamInference(
        {
          model: model.id,
          messages,
          temperature: DEFAULT_TEMPERATURE,
          maxTokens: DEFAULT_MAX_TOKENS,
          stream: true,
        },
        controller.signal,
      )) {
        if (!isCurrent()) return;
        switch (event.kind) {
          case 'meta':
            setMeta(event.meta);
            break;
          case 'delta': {
            accumulated += event.content;
            const now = performance.now();
            if (firstDeltaAtRef.current == null) {
              firstDeltaAtRef.current = now;
              setTtfbMs(now - (submitAtRef.current ?? now));
            }
            const est = Math.max(1, Math.round(accumulated.length / 4));
            const elapsed = now - (firstDeltaAtRef.current ?? now);
            setContent(accumulated);
            setTokensOut(est);
            setTokensOutEstimated(true);
            if (elapsed > 0) setTokensPerSec((est / elapsed) * 1000);
            break;
          }
          case 'usage':
            if (event.tokensOut != null) usageOutRef.current = event.tokensOut;
            if (event.tokensIn != null) {
              setTokensIn(event.tokensIn);
              setTokensInEstimated(false);
            }
            break;
          case 'attestation':
            setAttestation(event.attestation);
            break;
          case 'status':
            if (event.mode === 'bootstrap-relay') setStatus('warming');
            break;
          case 'error':
            setStatus('error');
            setErrorMessage(event.message);
            setRetryAfterMs(event.retryAfterMs);
            break;
          case 'done': {
            const now = performance.now();
            const first = firstDeltaAtRef.current;
            if (first != null) {
              const sMs = now - first;
              setStreamMs(sMs);
              const finalTokens =
                usageOutRef.current ?? Math.max(1, Math.round(accumulated.length / 4));
              setTokensOut(finalTokens);
              setTokensOutEstimated(usageOutRef.current == null);
              if (sMs > 0) setTokensPerSec((finalTokens / sMs) * 1000);
            }
            setTotalMs(now - (submitAtRef.current ?? now));
            if (accumulated) {
              setStatus((prev) => (prev === 'streaming' ? 'complete' : prev));
              playChime();
            }
            break;
          }
        }
      }
      if (!isCurrent()) return;
      setStatus((prev) => (prev === 'streaming' ? (accumulated ? 'complete' : 'idle') : prev));
    } catch (err) {
      if (!isCurrent()) return;
      if (controller.signal.aborted) {
        setStatus((prev) => (prev === 'streaming' ? (accumulated ? 'complete' : 'idle') : prev));
        return;
      }
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Inference stream aborted.');
    }
  }, [selectedModel, prompt]);

  const shareCard = () => {
    if (!content || !selectedModel) return;
    const viaRelay = meta?.source === 'gateway-proxy';
    downloadShareCard({
      title: viaRelay ? 'Wattz — Groq LPU relay' : 'Wattz — routing gateway',
      via: viaRelay ? 'Groq LPU relay' : 'routing gateway',
      model: selectedModel.label,
      body: content,
      requestId: meta?.requestId || null,
      ttfbMs,
      tokensPerSec,
    });
  };

  const retryHint =
    status === 'error' && retryAfterMs != null
      ? `Retry in ${formatMs(retryAfterMs)}.`
      : null;

  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Chip tone="cyan">Relay: Groq LPU</Chip>
              <Chip tone="wire">OpenAI-compatible SSE</Chip>
              <Chip tone="gold">Devnet</Chip>
            </div>
            <h1 className="font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
              Route a prompt through the substation.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-cluster-white/70">
              Every response streams token by token through the routing gateway.{' '}
              {RELAY_DISCLOSURE}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4">
              <div className="playground-panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                    Model registry
                  </div>
                  <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45">
                    {models.length} listed
                  </span>
                </div>
                {modelsQuery.isLoading ? (
                  <ModelsLoading />
                ) : (
                  <ModelSelector models={models} value={selected} onSelect={setSelected} />
                )}
              </div>
            </aside>

            <div className="flex flex-col gap-4 lg:col-span-5">
              <ResponseStream
                content={content}
                status={status}
                errorMessage={retryHint ? `${errorMessage} ${retryHint}` : errorMessage}
                tokensOut={tokensOut}
                tokensOutEstimated={tokensOutEstimated}
                ttfbMs={ttfbMs}
                streamMs={streamMs}
                totalMs={totalMs}
              />
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={submit}
                onStop={stop}
                disabled={!selectedModel?.selectable}
                isStreaming={status === 'streaming'}
              />
              <CodeSnippet
                model={selectedModel?.id || DEFAULT_MODEL}
                systemPrompt={SYSTEM_PROMPT}
                prompt={prompt}
                temperature={DEFAULT_TEMPERATURE}
                maxTokens={DEFAULT_MAX_TOKENS}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={shareCard}
                  disabled={!content}
                  className="ghost rounded-md px-4 py-2 font-mono-tech text-xs uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/70 disabled:opacity-50"
                >
                  Download share card
                </button>
                <button
                  type="button"
                  onClick={() => setPrompt(DEFAULT_PROMPT)}
                  className="ghost rounded-md px-4 py-2 font-mono-tech text-xs uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/70"
                >
                  Reset prompt
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-3">
              <PricePanel
                model={selectedModel}
                tokensIn={tokensIn}
                tokensInEstimated={tokensInEstimated}
                tokensOut={tokensOut}
                tokensOutEstimated={tokensOutEstimated}
                tokensPerSec={tokensPerSec}
                ttfbMs={ttfbMs}
                streamMs={streamMs}
              />
              <AttestationBadge attestation={attestation} meta={meta} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function PlaygroundFallback() {
  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="playground-panel h-[420px] animate-pulse" />
        </div>
      </main>
      <Footer />
    </>
  );
}

function ModelsLoading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-cyan-glow/10 bg-night-deep/40"
        />
      ))}
    </div>
  );
}

function playChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  } catch {
    // Audio unlock unavailable; silent skip.
  }
}

function downloadShareCard({
  title,
  via,
  model,
  body,
  requestId,
  ttfbMs,
  tokensPerSec,
}: {
  title: string;
  via: string;
  model: string;
  body: string;
  requestId: string | null;
  ttfbMs: number | null;
  tokensPerSec: number | null;
}) {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#050818');
  gradient.addColorStop(1, '#1A1A2E');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(91, 192, 235, 0.12)';
  for (let y = 0; y < canvas.height; y += 42) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
  for (let x = 0; x < canvas.width; x += 42) {
    ctx.fillRect(x, 0, 1, canvas.height);
  }

  ctx.fillStyle = '#F0EAD6';
  ctx.font = 'bold 58px "Space Mono", monospace';
  ctx.fillText(title, 60, 120);

  ctx.font = '26px "JetBrains Mono", monospace';
  ctx.fillStyle = '#5BC0EB';
  ctx.fillText(`model: ${model}  ·  via ${via}`, 60, 176);

  const stamp = [
    requestId ? `req ${requestId.slice(0, 8)}` : null,
    ttfbMs != null ? `first token ${Math.round(ttfbMs)} ms` : null,
    tokensPerSec != null ? `${formatTps(tokensPerSec)} tok/s` : null,
  ]
    .filter(Boolean)
    .join('   ');
  ctx.fillStyle = '#D4AF37';
  ctx.fillText(stamp, 60, 216);

  ctx.fillStyle = '#F0EAD6';
  ctx.font = '26px "JetBrains Mono", monospace';
  const wrapped = wrap(body, 60);
  const startY = 300;
  wrapped.slice(0, 8).forEach((line, i) => {
    ctx.fillText(line, 60, startY + i * 34);
  });

  ctx.fillStyle = '#5BC0EB';
  ctx.font = '22px "Space Mono", monospace';
  ctx.fillText('wattz.fi', 60, canvas.height - 60);

  const link = document.createElement('a');
  link.download = 'wattz-inference-card.png';
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}
