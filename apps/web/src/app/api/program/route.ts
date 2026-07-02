import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Live inspector for the Anchor settlement program on Solana devnet. Reads
// straight from the public devnet RPC so the docs page reflects on-chain
// reality rather than a hand-written claim. getAccountInfo confirms the
// program is deployed and executable; getSignaturesForAddress surfaces the
// most recent transactions touching the program address.
const PROGRAM_ID =
  process.env.NEXT_PUBLIC_2_PROGRAM_ID?.trim() ||
  'GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU';
const DEVNET_RPC = process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';

// Module-scoped memo of the assembled response. The CDN cache key is the full
// URL, so cache-busting query strings (?x=random) skip the edge cache and would
// otherwise re-POST to the shared devnet RPC on every request. Reusing the last
// upstream result for a short TTL caps that amplification regardless of the URL.
const PROGRAM_TTL_MS = 30 * 1000;
type ProgramBody = {
  programId: string;
  cluster: 'devnet';
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
    confirmationStatus: string | null;
  }[];
  reachable: boolean;
};
const programCache = globalThis as unknown as {
  __wattzProgram?: { at: number; body: ProgramBody };
};

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(DEVNET_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`rpc ${method} ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`rpc ${method}: ${json.error.message}`);
  return json.result;
}

export async function GET() {
  const cached = programCache.__wattzProgram;
  if (cached && Date.now() - cached.at < PROGRAM_TTL_MS) {
    return NextResponse.json(cached.body, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      },
    });
  }

  const [accountResult, signaturesResult] = await Promise.allSettled([
    rpc('getAccountInfo', [PROGRAM_ID, { encoding: 'base64' }]),
    rpc('getSignaturesForAddress', [PROGRAM_ID, { limit: 3 }]),
  ]);

  let account: {
    executable: boolean;
    owner: string;
    lamports: number;
    dataLen: number;
  } | null = null;

  if (accountResult.status === 'fulfilled') {
    const value = (accountResult.value as { value?: Record<string, unknown> })?.value;
    if (value) {
      const data = value.data as [string, string] | undefined;
      const dataLen =
        typeof value.space === 'number'
          ? (value.space as number)
          : data
            ? Buffer.from(data[0], 'base64').length
            : 0;
      account = {
        executable: Boolean(value.executable),
        owner: String(value.owner ?? ''),
        lamports: Number(value.lamports ?? 0),
        dataLen,
      };
    }
  }

  const signatures =
    signaturesResult.status === 'fulfilled' && Array.isArray(signaturesResult.value)
      ? (signaturesResult.value as Record<string, unknown>[]).map((s) => ({
          signature: String(s.signature ?? ''),
          slot: Number(s.slot ?? 0),
          blockTime: s.blockTime == null ? null : Number(s.blockTime),
          err: s.err ?? null,
          confirmationStatus: (s.confirmationStatus as string) ?? null,
        }))
      : [];

  const body: ProgramBody = {
    programId: PROGRAM_ID,
    cluster: 'devnet',
    account,
    signatures,
    reachable: account !== null || signatures.length > 0,
  };

  programCache.__wattzProgram = { at: Date.now(), body };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
    },
  });
}
