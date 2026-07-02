'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';

const curlSnippet = `curl https://api.wattz.fi/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{ "role": "user", "content": "Power the inference." }],
    "stream": true
  }'`;

const sdkSnippet = `from openai import OpenAI

client = OpenAI(base_url="https://api.wattz.fi/v1", api_key="wattz")
stream = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[{"role": "user", "content": "Power the inference."}],
    stream=True,
)`;

const tabs = [
  { id: 'curl', label: 'curl', shell: 'bash', code: curlSnippet },
  { id: 'sdk', label: 'openai sdk', shell: 'python', code: sdkSnippet },
] as const;

export function QuickstartSection() {
  const [active, setActive] = useState<(typeof tabs)[number]['id']>('curl');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 700);
    } catch {
      // Clipboard unavailable; the block stays selectable.
    }
  };

  return (
    <section id="quickstart" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-5xl px-6">
        <ScrollReveal>
          <div className="max-w-2xl">
            <Chip tone="cyan">Quickstart</Chip>
            <h2 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
              One request. The same wire as OpenAI.
            </h2>
            <p className="mt-4 text-base leading-7 text-cluster-white/70">
              Send this exact call to the live gateway and watch tokens stream
              back. Swapping an existing OpenAI client is one base URL change.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div className="playground-panel mt-10">
            <div className="flex items-center justify-between border-b border-cyan-glow/10 px-3 py-2">
              <div className="flex items-center gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActive(t.id)}
                    className={cn(
                      'rounded-md px-3 py-1.5 font-mono-tech text-[11px] uppercase tracking-[0.2em] transition-colors',
                      t.id === active
                        ? 'bg-cyan-glow/10 text-cluster-white'
                        : 'text-cluster-white/50 hover:text-cluster-white/80',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cluster-white/40 sm:inline">
                  {current.shell}
                </span>
                <button
                  type="button"
                  onClick={copy}
                  aria-label="Copy snippet"
                  className="rounded border border-cyan-glow/25 bg-night-deep/60 px-2.5 py-1 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/70 transition-colors hover:border-cyan-glow/60 hover:text-cluster-white"
                >
                  {copied ? 'copied' : 'copy'}
                </button>
              </div>
            </div>
            <pre className="scanlines relative overflow-x-auto px-5 py-5 font-mono-tech text-[12.5px] leading-relaxed text-cluster-white/90">
              <code>{current.code}</code>
            </pre>
          </div>
        </ScrollReveal>

        <p className="mt-5 max-w-2xl font-mono-tech text-[11px] leading-6 text-cluster-white/45">
          Inference is relayed through Groq LPU capacity until the first
          bare-metal node registers. The wire protocol does not change.
        </p>
      </div>
    </section>
  );
}
