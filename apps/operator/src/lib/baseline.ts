/**
 * Network-preview data for the operator dashboard. Served when the inference
 * gateway is unreachable or has no registered nodes yet, so the UI shows a
 * coherent preview instead of empty error panels on a cold Vercel deploy or
 * during gateway warm-up. Once a real node registers, the proxy layer prefers
 * the upstream payload.
 *
 * Every payload is tagged `source: 'network-preview'` so the UI can label it
 * plainly. All aggregate figures derive from the single node roster below, so
 * online counts, per-model node counts, aggregate TFLOPS, and revenue can never
 * diverge from the fleet.
 */

import type { AttestationKind, ModelListResponse, NodeInfo } from '@/types/wattz';
import type {
  NodeDetail,
  NodeEvent,
  OperatorStats,
  RevenuePoint,
  RewardsSnapshot,
  StatsHistoryResponse,
  UptimePoint,
} from '@/lib/api';
const NOW = () => Math.floor(Date.now() / 1000);
const HOUR = 3600;
const DAY = 24 * HOUR;
const LAMPORTS = 1_000_000_000;
const PREVIEW = 'network-preview' as const;
// Every roster stake sits at or above PROTOCOL_MIN_STAKE_WATTZ (see lib/constants),
// so the fleet preview never undercuts the minimum shown on the stake page.

// Canonical model ids. Chat models are served today through the Groq relay
// path; the two media models are listed but await their first registered node.
const L31 = 'llama-3.1-8b-instant';
const L33 = 'llama-3.3-70b-versatile';
const OSS = 'gpt-oss-20b';
const WHISPER = 'whisper-large-v3';
const SDXL = 'stable-diffusion-xl-1.0';
const RELAY_MODELS = [L31, L33, OSS] as const;

const MODEL_PRICES: Record<string, { prompt: number; completion: number }> = {
  [L31]: { prompt: 0.00042, completion: 0.00066 },
  [L33]: { prompt: 0.00081, completion: 0.00119 },
  [OSS]: { prompt: 0.00055, completion: 0.0009 },
  [WHISPER]: { prompt: 0.0002, completion: 0.0006 },
  [SDXL]: { prompt: 0.019, completion: 0 },
};

// Revenue cross-foots from a single set of anchors:
//   daily_tokens = daily_inferences x avg tokens/inference
//   daily_revenue = daily_tokens/1k x blended posted price ($WATTZ/1k)
const DAILY_INFERENCES = 42_130;
const AVG_TOKENS_PER_INFERENCE = 1661;
const DAILY_TOKENS = DAILY_INFERENCES * AVG_TOKENS_PER_INFERENCE;
const BLENDED_PRICE_PER_1K_WATTZ =
  RELAY_MODELS.reduce(
    (sum, id) => sum + (MODEL_PRICES[id].prompt + MODEL_PRICES[id].completion) / 2,
    0,
  ) / RELAY_MODELS.length;
const DAILY_REVENUE_LAMPORTS = Math.round(
  (DAILY_TOKENS / 1000) * BLENDED_PRICE_PER_1K_WATTZ * LAMPORTS,
);
const NETWORK_AGE_DAYS = 45;
const CUMULATIVE_REVENUE_LAMPORTS = DAILY_REVENUE_LAMPORTS * NETWORK_AGE_DAYS;
const PENDING_FRACTION = 0.085;

interface PreviewNode extends NodeInfo {
  first_seen: number;
  price_multiplier: number;
}

interface RosterEntry {
  pubkey: string;
  operator: string;
  region: string;
  online: boolean;
  uptime_pct: number;
  tflops_active: number;
  stake_wattz: number;
  reputation: number;
  attestation_kind: AttestationKind;
  gpus: string[];
  supported_models: string[];
  heartbeat_secs_ago: number;
  first_seen_days_ago: number;
}

const OPERATORS = [
  '4dps2JSkJbq75Nh2cDLVNHD29W2ZuY5GhCDopsXN3kVT',
  'FaVyhjSpH8oJXvgLt9by15SVjsLhhJnbE8hnrTQf1idW',
  'HfXP7v8xBicMa2Q7EvvwzTQrAVSb34xYi4MyD8fiAWrB',
  'XdV6VMX8rNLXu3kXh4Yqi2t3rRfXzn8byPx3QDYrTtT',
];

const ROSTER: RosterEntry[] = [
  {
    pubkey: '4EQZPQrF2M6cw65SGPqAe6kNKAzfAcVdCrFkB3uA2rda',
    operator: OPERATORS[0],
    region: 'us-east-1',
    online: true,
    uptime_pct: 99.62,
    tflops_active: 82,
    stake_wattz: 1200,
    reputation: 4.82,
    attestation_kind: 'nvidia_cc',
    gpus: ['H100 80GB', 'H100 80GB'],
    supported_models: [L31, L33, OSS],
    heartbeat_secs_ago: 12,
    first_seen_days_ago: 180,
  },
  {
    pubkey: 'zJ3M3NxtxPHFvVMJPV1GHXg6TSQWuYkpW7zXCEsqJ6m',
    operator: OPERATORS[0],
    region: 'eu-west-1',
    online: true,
    uptime_pct: 98.15,
    tflops_active: 41,
    stake_wattz: 650,
    reputation: 4.56,
    attestation_kind: 'sev',
    gpus: ['A100 40GB'],
    supported_models: [L31, OSS],
    heartbeat_secs_ago: 26,
    first_seen_days_ago: 132,
  },
  {
    pubkey: '7wMD45o8TEFs8xoVJsQmRN4uYXVxab58YdQVfwLMfFL',
    operator: OPERATORS[1],
    region: 'ap-northeast-1',
    online: true,
    uptime_pct: 97.88,
    tflops_active: 66,
    stake_wattz: 880,
    reputation: 4.41,
    attestation_kind: 'sgx',
    gpus: ['L40S', 'L40S'],
    supported_models: [L33],
    heartbeat_secs_ago: 44,
    first_seen_days_ago: 96,
  },
  {
    pubkey: '6owsgJ275zxYphyNXQDbXPPkiMBU8m2JNKyDn8neDPob',
    operator: OPERATORS[2],
    region: 'us-west-2',
    online: true,
    uptime_pct: 96.24,
    tflops_active: 54,
    stake_wattz: 410,
    reputation: 4.11,
    attestation_kind: 'risc0',
    gpus: ['A100 80GB'],
    supported_models: [L31, L33],
    heartbeat_secs_ago: 60,
    first_seen_days_ago: 71,
  },
  {
    pubkey: '3199cpsXsyPPazZ6gKHupzUszdERi7xhcLYYhuNmMebm',
    operator: OPERATORS[0],
    region: 'sa-east-1',
    online: false,
    uptime_pct: 88.03,
    tflops_active: 0,
    stake_wattz: 230,
    reputation: 3.44,
    attestation_kind: 'none',
    gpus: ['RTX 4090'],
    supported_models: [OSS],
    heartbeat_secs_ago: 12 * HOUR,
    first_seen_days_ago: 54,
  },
  {
    pubkey: 'BKE2B4Sqc3SkWUT479bdp4hfn8Szjn8chA1yQQqFgXiN',
    operator: OPERATORS[3],
    region: 'ap-southeast-1',
    online: true,
    uptime_pct: 99.11,
    tflops_active: 25,
    stake_wattz: 340,
    reputation: 4.28,
    attestation_kind: 'sp1',
    gpus: ['H100 80GB'],
    supported_models: [L31],
    heartbeat_secs_ago: 8,
    first_seen_days_ago: 38,
  },
];

function priceMultiplier(reputation: number): number {
  // Reputation-correlated so the drill-down multiplier tracks the card values.
  const raw = 0.85 + (reputation - 3.4) * 0.22;
  return Number(Math.min(1.4, Math.max(0.8, raw)).toFixed(2));
}

function previewNodes(): PreviewNode[] {
  const now = NOW();
  return ROSTER.map((r) => ({
    pubkey: r.pubkey,
    operator: r.operator,
    region: r.region,
    online: r.online,
    uptime_pct: r.uptime_pct,
    tflops_active: r.tflops_active,
    stake_lamports: Math.round(r.stake_wattz * LAMPORTS),
    reputation: r.reputation,
    attestation_kind: r.attestation_kind,
    gpus: r.gpus,
    supported_models: r.supported_models,
    last_heartbeat: now - r.heartbeat_secs_ago,
    first_seen: now - r.first_seen_days_ago * DAY,
    price_multiplier: priceMultiplier(r.reputation),
  }));
}

function totalOnlineTflops(nodes: PreviewNode[]): number {
  return nodes.filter((n) => n.online).reduce((sum, n) => sum + n.tflops_active, 0);
}

export function baselineStats(operator?: string): OperatorStats {
  const now = NOW();
  if (operator) {
    // A connected wallet has no registered node in the preview: honest zeros.
    return {
      operator,
      online_nodes: 0,
      total_nodes: 0,
      aggregate_tflops: 0,
      daily_inferences: 0,
      daily_tokens: 0,
      daily_revenue_lamports: 0,
      cumulative_revenue_lamports: 0,
      pending_rewards_lamports: 0,
      updated_at: now,
      source: PREVIEW,
    };
  }
  const nodes = previewNodes();
  const online = nodes.filter((n) => n.online);
  return {
    online_nodes: online.length,
    total_nodes: nodes.length,
    aggregate_tflops: nodes.reduce((sum, n) => sum + n.tflops_active, 0),
    daily_inferences: DAILY_INFERENCES,
    daily_tokens: DAILY_TOKENS,
    daily_revenue_lamports: DAILY_REVENUE_LAMPORTS,
    cumulative_revenue_lamports: CUMULATIVE_REVENUE_LAMPORTS,
    pending_rewards_lamports: Math.round(DAILY_REVENUE_LAMPORTS * PENDING_FRACTION),
    updated_at: now,
    source: PREVIEW,
  };
}

export function baselineNodeList(operator?: string) {
  if (operator) {
    return { object: 'list' as const, data: [] as NodeInfo[], source: PREVIEW };
  }
  return { object: 'list' as const, data: previewNodes() as NodeInfo[], source: PREVIEW };
}

export function baselineModelList(): ModelListResponse {
  const now = NOW();
  const online = previewNodes().filter((n) => n.online);
  const nodesFor = (id: string) =>
    online.filter((n) => n.supported_models.includes(id)).length;
  return {
    object: 'list',
    source: PREVIEW,
    data: [
      {
        id: L31,
        object: 'model',
        created: now - 40 * DAY,
        owned_by: 'Meta',
        family: 'llama-3.1',
        version: '8b-instant',
        publisher: 'meta',
        modality: 'text',
        license: { name: 'Llama 3.1 Community License', kyc_required: false },
        context_window: 131072,
        price_per_1k_prompt: MODEL_PRICES[L31].prompt,
        price_per_1k_completion: MODEL_PRICES[L31].completion,
        min_gpu_vram_gb: 16,
        nodes_online: nodesFor(L31),
        status: 'relay',
      },
      {
        id: L33,
        object: 'model',
        created: now - 34 * DAY,
        owned_by: 'Meta',
        family: 'llama-3.3',
        version: '70b-versatile',
        publisher: 'meta',
        modality: 'text',
        license: { name: 'Llama 3.3 Community License', kyc_required: false },
        context_window: 131072,
        price_per_1k_prompt: MODEL_PRICES[L33].prompt,
        price_per_1k_completion: MODEL_PRICES[L33].completion,
        min_gpu_vram_gb: 80,
        nodes_online: nodesFor(L33),
        status: 'relay',
      },
      {
        id: OSS,
        object: 'model',
        created: now - 21 * DAY,
        owned_by: 'OpenAI',
        family: 'gpt-oss',
        version: '20b',
        publisher: 'openai',
        modality: 'text',
        license: { name: 'Apache 2.0', kyc_required: false },
        context_window: 131072,
        price_per_1k_prompt: MODEL_PRICES[OSS].prompt,
        price_per_1k_completion: MODEL_PRICES[OSS].completion,
        min_gpu_vram_gb: 24,
        nodes_online: nodesFor(OSS),
        status: 'relay',
      },
      {
        id: WHISPER,
        object: 'model',
        created: now - 150 * DAY,
        owned_by: 'OpenAI',
        family: 'whisper',
        version: 'large-v3',
        publisher: 'openai',
        modality: 'audio',
        license: { name: 'MIT', kyc_required: false },
        context_window: 3000,
        price_per_1k_prompt: MODEL_PRICES[WHISPER].prompt,
        price_per_1k_completion: MODEL_PRICES[WHISPER].completion,
        min_gpu_vram_gb: 10,
        nodes_online: 0,
        status: 'awaiting node',
      },
      {
        id: SDXL,
        object: 'model',
        created: now - 200 * DAY,
        owned_by: 'Stability AI',
        family: 'stable-diffusion',
        version: 'xl-1.0',
        publisher: 'stabilityai',
        modality: 'image',
        license: { name: 'CreativeML OpenRAIL-M', kyc_required: true },
        context_window: 77,
        price_per_1k_prompt: MODEL_PRICES[SDXL].prompt,
        price_per_1k_completion: MODEL_PRICES[SDXL].completion,
        min_gpu_vram_gb: 12,
        nodes_online: 0,
        status: 'awaiting node',
      },
    ],
  };
}

export function baselineRewards(operator: string): RewardsSnapshot {
  // A connected wallet has no registered node in the preview, so there is
  // nothing accrued. The rewards page renders an honest empty state.
  return {
    operator,
    pending_lamports: 0,
    claimed_lamports: 0,
    revenue_series: [],
    source: PREVIEW,
  };
}

export function baselineNodeDetail(id: string): NodeDetail | null {
  const nodes = previewNodes();
  const node = nodes.find((n) => n.pubkey === id);
  if (!node) return null;

  const now = NOW();
  const onlineTflops = totalOnlineTflops(nodes) || 1;
  // Offline nodes still earned historically; weight their series by a nominal
  // capacity so the drill-down shows a taper to zero rather than a flat line.
  const weight = node.online ? node.tflops_active : 30;
  const share = weight / onlineTflops;
  const nodeDailyInferences = Math.round(DAILY_INFERENCES * share);
  const nodeDailyRevenue = Math.round(DAILY_REVENUE_LAMPORTS * share);

  const uptime_series: UptimePoint[] = Array.from({ length: 30 }, (_, i) => {
    const ts = now - (29 - i) * DAY;
    const wobble = Math.sin(i * 0.6) * 0.35 + Math.cos(i * 0.9) * 0.15;
    let uptime = node.uptime_pct + wobble;
    if (!node.online && i >= 27) uptime = node.uptime_pct - (i - 26) * 6;
    return {
      timestamp: ts,
      uptime_pct: Number(Math.min(100, Math.max(0, uptime)).toFixed(2)),
      requests: Math.round(nodeDailyInferences * (0.85 + Math.sin(i * 0.5) * 0.12)),
    };
  });

  const revenue_series: RevenuePoint[] = Array.from({ length: 14 }, (_, i) => {
    const ts = now - (13 - i) * DAY;
    const factor = 0.7 + (i / 13) * 0.3 + Math.sin(i * 0.8) * 0.05;
    let revenue = Math.round(nodeDailyRevenue * factor);
    let requests = Math.round(nodeDailyInferences * factor);
    if (!node.online && i >= 12) {
      revenue = 0;
      requests = 0;
    }
    return {
      timestamp: ts,
      revenue_lamports: revenue,
      requests,
      tokens: requests * AVG_TOKENS_PER_INFERENCE,
    };
  });

  const stakeWattz = (node.stake_lamports / LAMPORTS).toFixed(0);
  const events: NodeEvent[] = node.online
    ? [
        {
          timestamp: node.last_heartbeat,
          kind: 'heartbeat',
          message: `heartbeat ok — ${node.tflops_active} TFLOPS active`,
        },
        {
          timestamp: now - 3 * HOUR,
          kind: 'route',
          message: `served ${nodeDailyInferences.toLocaleString('en-US')} inference requests in 24h`,
        },
        {
          timestamp: now - 9 * HOUR,
          kind: 'model',
          message: `pinned ${node.supported_models[0]}`,
        },
        {
          timestamp: now - 28 * HOUR,
          kind: 'stake',
          message: `stake set to ${stakeWattz} $WATTZ`,
        },
        {
          timestamp: node.first_seen,
          kind: 'register',
          message: `node registered in ${node.region}`,
        },
      ]
    : [
        {
          timestamp: node.last_heartbeat,
          kind: 'offline',
          message: 'missed heartbeat — node marked offline',
        },
        {
          timestamp: node.last_heartbeat - 6 * HOUR,
          kind: 'route',
          message: 'last served inference before going offline',
        },
        {
          timestamp: now - 26 * HOUR,
          kind: 'stake',
          message: `stake set to ${stakeWattz} $WATTZ`,
        },
        {
          timestamp: node.first_seen,
          kind: 'register',
          message: `node registered in ${node.region}`,
        },
      ];

  return {
    ...node,
    models_loaded: node.online ? node.supported_models : [],
    uptime_series,
    revenue_series,
    events,
    source: PREVIEW,
  };
}

export function baselineStatsHistory(): StatsHistoryResponse {
  const now = NOW();
  const data = Array.from({ length: 14 }, (_, i) => {
    const ts = now - (13 - i) * DAY;
    const factor = 0.62 + (i / 13) * 0.38 + Math.sin(i * 0.7) * 0.03;
    const inferences = Math.round(DAILY_INFERENCES * factor);
    const tokens = inferences * AVG_TOKENS_PER_INFERENCE;
    const revenue_lamports = Math.round(
      (tokens / 1000) * BLENDED_PRICE_PER_1K_WATTZ * LAMPORTS,
    );
    return { timestamp: ts, inferences, tokens, revenue_lamports };
  });
  // Reconcile the final point exactly with the Overview daily figures.
  data[data.length - 1] = {
    timestamp: now,
    inferences: DAILY_INFERENCES,
    tokens: DAILY_TOKENS,
    revenue_lamports: DAILY_REVENUE_LAMPORTS,
  };
  return { object: 'list', data, source: PREVIEW };
}
