import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Settlement receipts feed. Every settled inference writes a receipt against
// the Anchor program, so the program's recent signature history is the public
// ledger of settlement activity. Read directly from the public devnet RPC.
const PROGRAM_ID =
  process.env.NEXT_PUBLIC_2_PROGRAM_ID?.trim() ||
  'GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU';
const DEVNET_RPC = process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';

// Module-scoped memo of the upstream devnet result. The CDN key is the full
// URL, so cache-busting query strings (?x=random) skip the edge cache and would
// otherwise re-POST to the shared devnet RPC on every request. Reusing the last
// upstream fetch for a short TTL caps that amplification regardless of the URL.
const RECEIPTS_TTL_MS = 30 * 1000;
type Receipt = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  confirmationStatus: string | null;
};
const receiptsCache = globalThis as unknown as {
  __wattzReceipts?: { at: number; receipts: Receipt[] };
};

export async function GET() {
  try {
    const cached = receiptsCache.__wattzReceipts;
    if (cached && Date.now() - cached.at < RECEIPTS_TTL_MS) {
      return NextResponse.json(
        { programId: PROGRAM_ID, cluster: 'devnet', receipts: cached.receipts },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
          },
        },
      );
    }

    const res = await fetch(DEVNET_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [PROGRAM_ID, { limit: 20 }],
      }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`rpc ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);

    const receipts: Receipt[] = Array.isArray(json.result)
      ? (json.result as Record<string, unknown>[]).map((s) => ({
          signature: String(s.signature ?? ''),
          slot: Number(s.slot ?? 0),
          blockTime: s.blockTime == null ? null : Number(s.blockTime),
          err: s.err ?? null,
          confirmationStatus: (s.confirmationStatus as string) ?? null,
        }))
      : [];

    receiptsCache.__wattzReceipts = { at: Date.now(), receipts };

    return NextResponse.json(
      { programId: PROGRAM_ID, cluster: 'devnet', receipts },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        programId: PROGRAM_ID,
        cluster: 'devnet',
        receipts: [],
        error: err instanceof Error ? err.message : 'unreachable',
      },
      { status: 502 },
    );
  }
}
