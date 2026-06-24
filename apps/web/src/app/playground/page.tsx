'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ModelSelector } from '@/components/playground/ModelSelector';
import { PromptInput } from '@/components/playground/PromptInput';
import { ResponseStream } from '@/components/playground/ResponseStream';
import { PricePanel } from '@/components/playground/PricePanel';
import { AttestationBadge } from '@/components/playground/AttestationBadge';
import { Chip } from '@/components/ui/Chip';
import type { AttestationSummary, ModelDescriptor } from '@/lib/api';
import { fetchModels, streamInference } from '@/lib/api';

type StreamStatus = 'idle' | 'streaming' | 'complete' | 'error';

const DEFAULT_PROMPT =
  'You are on a Solana AI inference marketplace called Wattz. Introduce yourself in three concise sentences to a builder who has never heard of it.';

export default function PlaygroundPage() {
  const modelsQuery = useQuery({ queryKey: ['models'], queryFn: fetchModels });
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [attestation, setAttestation] = useState<AttestationSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tokensOut, setTokensOut] = useState(0);
  const [tokensIn, setTokensIn] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selected && modelsQuery.data && modelsQuery.data.length > 0) {
      setSelected(modelsQuery.data[0].id);
    }
  }, [modelsQuery.data, selected]);

  useEffect(() => {
    setTokensIn(Math.max(1, Math.round(prompt.length / 4)));
  }, [prompt]);

  const models: ModelDescriptor[] = modelsQuery.data || [];
  const selectedModel = useMemo(
    () => models.find((m) => m.id === selected),
    [models, selected],
  );

  const submit = async () => {
    if (!selected) return;
    setStatus('streaming');
    setContent('');
    setErrorMessage(null);
    setAttestation(null);
    setLatencyMs(null);
    setCostUsd(null);
    setRegion(null);
    setTokensOut(0);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const messages = [
        { role: 'system' as const, content: 'You are Wattz, a Solana-native inference marketplace assistant.' },
        { role: 'user' as const, content: prompt },
      ];
      let accumulated = '';
      let outTokens = 0;
      for await (const event of streamInference(
        { model: selected, messages, stream: true },
        controller.signal,
      )) {
        if (event.kind === 'delta') {
          accumulated += event.content;
          outTokens += 1;
          setContent(accumulated);
          setTokensOut(outTokens);
        } else if (event.kind === 'meta') {
          setLatencyMs(event.latencyMs);
          setRegion(event.region);
          setCostUsd(event.costUsd);
        } else if (event.kind === 'attestation') {
          setAttestation(event.attestation);
        } else if (event.kind === 'done') {
          setStatus('complete');
          playChime();
        }
      }
      setStatus((prev) => (prev === 'streaming' ? 'complete' : prev));
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Inference stream aborted.',
      );
    }
  };

  const shareCard = () => {
    if (!content || !selectedModel) return;
    downloadShareCard({
      title: 'Wattz - live inference',
      model: selectedModel.label,
      body: content,
      region: region || selectedModel.region,
      latencyMs: latencyMs || selectedModel.avgLatencyMs,
    });
  };

  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Chip tone="cyan">Live playground</Chip>
              <Chip tone="wire">OpenAI-compatible SSE</Chip>
              <Chip tone="gold">TEE attested</Chip>
            </div>
            <h1 className="font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
              Route a prompt through the substation.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-cluster-white/70">
              Every response streams token by token from a live GPU node.
              Latency, region, cost, and TEE attestation surface on the right.
              When you like the answer, download a share card for X.
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
                  <ModelSelector
                    models={models}
                    value={selected}
                    onSelect={setSelected}
                  />
                )}
              </div>
            </aside>

            <div className="flex flex-col gap-4 lg:col-span-5">
              <ResponseStream
                content={content}
                status={status}
                errorMessage={errorMessage}
              />
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={submit}
                disabled={!selected || status === 'streaming'}
                isStreaming={status === 'streaming'}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={shareCard}
                  disabled={!content}
                  className="ghost rounded-md px-4 py-2 font-mono-tech text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  Download share card
                </button>
                <button
                  type="button"
                  onClick={() => setPrompt(DEFAULT_PROMPT)}
                  className="ghost rounded-md px-4 py-2 font-mono-tech text-xs uppercase tracking-widest"
                >
                  Reset prompt
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-3">
              <PricePanel
                model={selectedModel}
                latencyMs={latencyMs}
                region={region}
                costUsd={costUsd}
                tokensIn={tokensIn}
                tokensOut={tokensOut}
              />
              <AttestationBadge attestation={attestation} />
            </div>
          </div>
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
  model,
  body,
  region,
  latencyMs,
}: {
  title: string;
  model: string;
  body: string;
  region: string;
  latencyMs: number;
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
  ctx.font = 'bold 64px "Space Mono", monospace';
  ctx.fillText(title, 60, 130);

  ctx.font = '28px "JetBrains Mono", monospace';
  ctx.fillStyle = '#5BC0EB';
  ctx.fillText(`model: ${model}`, 60, 190);
  ctx.fillStyle = '#D4AF37';
  ctx.fillText(`region: ${region} - latency: ${Math.round(latencyMs)} ms`, 60, 230);

  ctx.fillStyle = '#F0EAD6';
  ctx.font = '26px "JetBrains Mono", monospace';
  const wrapped = wrap(body, 60);
  const startY = 320;
  wrapped.slice(0, 8).forEach((line, i) => {
    ctx.fillText(line, 60, startY + i * 34);
  });

  ctx.fillStyle = '#5BC0EB';
  ctx.font = '22px "Space Mono", monospace';
  ctx.fillText('wattz.fi - Power the inference.', 60, canvas.height - 60);

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
