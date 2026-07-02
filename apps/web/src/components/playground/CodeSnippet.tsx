'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

const ENDPOINT = 'https://api.wattz.fi/v1/chat/completions';
const BASE_URL = 'https://api.wattz.fi/v1';

interface CodeSnippetProps {
  model: string;
  systemPrompt: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
}

type Lang = 'curl' | 'typescript' | 'python';

const TABS: { id: Lang; label: string }[] = [
  { id: 'curl', label: 'curl' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
];

function messages(systemPrompt: string, prompt: string) {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];
}

function buildCurl(p: CodeSnippetProps): string {
  const body = JSON.stringify(
    {
      model: p.model,
      messages: messages(p.systemPrompt, p.prompt),
      temperature: p.temperature,
      max_tokens: p.maxTokens,
      stream: true,
    },
    null,
    2,
  );
  // Wrap in single quotes for the shell; escape any embedded single quotes.
  const shellBody = body.replace(/'/g, `'\\''`);
  return `curl ${ENDPOINT} \\\n  -H "content-type: application/json" \\\n  -d '${shellBody}'`;
}

function buildTypeScript(p: CodeSnippetProps): string {
  const msgs = JSON.stringify(messages(p.systemPrompt, p.prompt), null, 2)
    .split('\n')
    .join('\n  ');
  return `import OpenAI from 'openai';

// The relay path needs no key; any non-empty string is accepted.
const client = new OpenAI({ baseURL: '${BASE_URL}', apiKey: 'wattz' });

const stream = await client.chat.completions.create({
  model: '${p.model}',
  messages: ${msgs},
  temperature: ${p.temperature},
  max_tokens: ${p.maxTokens},
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}`;
}

function buildPython(p: CodeSnippetProps): string {
  const msgs = JSON.stringify(messages(p.systemPrompt, p.prompt), null, 4)
    .split('\n')
    .join('\n    ');
  return `from openai import OpenAI

# The relay path needs no key; any non-empty string is accepted.
client = OpenAI(base_url="${BASE_URL}", api_key="wattz")

stream = client.chat.completions.create(
    model="${p.model}",
    messages=${msgs},
    temperature=${p.temperature},
    max_tokens=${p.maxTokens},
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`;
}

export function CodeSnippet(props: CodeSnippetProps) {
  const [tab, setTab] = useState<Lang>('curl');
  const [copied, setCopied] = useState(false);

  const snippets = useMemo(
    () => ({
      curl: buildCurl(props),
      typescript: buildTypeScript(props),
      python: buildPython(props),
    }),
    [props],
  );

  const current = snippets[tab];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked; ignore.
    }
  };

  return (
    <div className="playground-panel">
      <div className="flex items-center justify-between border-b border-cyan-glow/10 px-3 py-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Code examples">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded px-3 py-1 font-mono-tech text-[10px] uppercase tracking-widest transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/70',
                tab === t.id
                  ? 'bg-night-deep/80 text-cyan-glow'
                  : 'text-cluster-white/50 hover:text-cluster-white/80',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded px-2 py-1 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60 transition hover:text-cluster-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/70"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="stream-box max-h-72 overflow-auto px-4 py-3 text-[12px] text-cluster-white/85">
        {current}
      </pre>
    </div>
  );
}
