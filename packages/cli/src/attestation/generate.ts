import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { arch, cpus, platform, totalmem } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';

export type AttestationKind = 'sgx' | 'sev' | 'nvidia_cc' | 'none';

export interface Attestation {
  kind: AttestationKind;
  quote_hash: string;
  cpu_flags: string[];
  gpu_detected: string | null;
  total_memory_gb: number;
  cpu_model: string;
  arch: string;
  platform: string;
  timestamp: number;
}

const SGX_FLAGS = ['sgx', 'sgx_lc', 'sgx1', 'sgx2'];
const SEV_FLAGS = ['sev', 'sev_es', 'sev_snp'];

/**
 * Generate a lightweight local attestation for the operator's machine.
 *
 * On Linux hosts, CPU capabilities are read from /proc/cpuinfo. SGX and
 * SEV instruction set flags are surfaced as the attestation kind if
 * present. NVIDIA H100 / H200 / B200 GPUs (detected via `nvidia-smi`) map
 * to the `nvidia_cc` attestation kind. Machines without any TEE-capable
 * hardware are recorded as `none` with the operator opting into off-TEE
 * routing.
 *
 * The `quote_hash` is deterministic for a given nonce + machine
 * fingerprint. Production deployments replace this with a real SGX / SEV /
 * Confidential Compute report, which is the responsibility of the
 * `packages/compute-verifier` Rust crate.
 */
export function generateAttestation(nonce: string): Attestation {
  const flags = readCpuFlags();
  const gpu = detectGpu();
  const cpuModel = cpus()[0]?.model ?? 'unknown';
  const totalMemoryGb = Math.round(totalmem() / 1024 / 1024 / 1024);

  let kind: AttestationKind = 'none';
  if (SGX_FLAGS.some((f) => flags.includes(f))) kind = 'sgx';
  else if (SEV_FLAGS.some((f) => flags.includes(f))) kind = 'sev';
  else if (gpu && /H100|H200|B200/i.test(gpu)) kind = 'nvidia_cc';

  const machineFingerprint = [
    platform(),
    arch(),
    cpuModel,
    totalMemoryGb.toString(),
    gpu ?? 'no-gpu',
    kind,
  ].join('|');

  const quoteHash = createHash('sha256').update(`${nonce}|${machineFingerprint}`).digest('hex');

  return {
    kind,
    quote_hash: quoteHash,
    cpu_flags: filterInterestingFlags(flags),
    gpu_detected: gpu,
    total_memory_gb: totalMemoryGb,
    cpu_model: cpuModel,
    arch: arch(),
    platform: platform(),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function readCpuFlags(): string[] {
  if (platform() !== 'linux') return [];
  const path = '/proc/cpuinfo';
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf8');
    const line = raw.split('\n').find((l) => l.startsWith('flags'));
    if (!line) return [];
    const idx = line.indexOf(':');
    if (idx === -1) return [];
    return line
      .slice(idx + 1)
      .trim()
      .split(/\s+/);
  } catch {
    return [];
  }
}

function filterInterestingFlags(flags: string[]): string[] {
  const relevant = new Set<string>([
    ...SGX_FLAGS,
    ...SEV_FLAGS,
    'vmx',
    'svm',
    'aes',
    'avx',
    'avx2',
    'avx512f',
    'sha_ni',
  ]);
  return flags.filter((f) => relevant.has(f));
}

function detectGpu(): string | null {
  try {
    const out = execFileSync('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    })
      .toString('utf8')
      .trim();
    if (!out) return null;
    const firstLine = out.split('\n')[0];
    return firstLine ? firstLine.trim() || null : null;
  } catch {
    return null;
  }
}
