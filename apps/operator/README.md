# Wattz Operator Dashboard

Next.js 14 dashboard for Wattz GPU node operators. Live uptime, revenue,
model roster, reward claiming, and stake management. Same palette as the
public site (industrial dark steel + cyan glow) so operators feel they are
still inside the substation.

## Runtime

- Next.js 14 App Router
- Solana Wallet Adapter (Phantom, Solflare) with public RPC only for the browser
- React Query for background data fetching
- Recharts for uptime + revenue charts
- Route handlers proxy the Wattz gateway server-side; no API keys reach the browser

## Local development

```bash
pnpm install
pnpm --filter @wattz/sdk build
pnpm --filter @wattz/operator dev
# open http://localhost:3001
```

## Environment

Server-only:

```
INFERENCE_GATEWAY_URL=https://api.wattz.fi/v1
WATTZ_API_KEY=<optional bearer token, only if backend requires auth>
```

Client-safe:

```
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_API_URL=https://api.wattz.fi/v1
NEXT_PUBLIC_2_PROGRAM_ID=<Anchor settlement program id>
NEXT_PUBLIC_TWITTER=wattzfi
NEXT_PUBLIC_GITHUB=wattz-compute/wattz
NEXT_PUBLIC_YOUTUBE_BGM_ID=<11-char YouTube video id, optional>
```

## Routes

| Path                | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `/`                 | Overview: aggregate stats + node grid        |
| `/nodes/[id]`       | Node detail with uptime + revenue charts     |
| `/models`           | Registered model table                       |
| `/rewards`          | Pending rewards + `claim_reward` transaction |
| `/stake`            | Stake SOL to the Anchor program              |
| `/api/nodes`        | Server-side proxy to gateway                 |
| `/api/nodes/[id]`   | Server-side proxy                            |
| `/api/stats`        | Aggregate + operator stats                   |
| `/api/models`       | Model registry                               |
| `/api/rewards`      | Rewards snapshot                             |
