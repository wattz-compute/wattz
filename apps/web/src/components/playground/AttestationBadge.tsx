'use client';

import type { AttestationSummary, RouteMeta } from '@/lib/api';
import { shortHash } from '@/lib/format';

interface AttestationBadgeProps {
  attestation: AttestationSummary | null;
  meta: RouteMeta | null;
}

const typeLabels: Record<AttestationSummary['attestationType'], string> = {
  sgx: 'Intel SGX',
  sev: 'AMD SEV-SNP',
  'nvidia-cc': 'NVIDIA CC',
  risc0: 'Risc0 zkVM',
  sp1: 'SP1 zkVM',
};

export function AttestationBadge({ attestation, meta }: AttestationBadgeProps) {
  return (
    <div className="playground-panel p-5">
      <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
        Attestation
      </div>

      {attestation ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="chip warn text-[10px]">
              <span className="dot" /> verified
            </span>
            <span className="font-mono-tech text-[11px] uppercase tracking-widest text-cluster-white/80">
              {typeLabels[attestation.attestationType]}
            </span>
          </div>
          <div className="font-mono-tech text-[11px] text-cluster-white/70">
            <span className="text-cluster-white/50">verifier</span> {attestation.verifier}
          </div>
          <div className="font-mono-tech text-[11px] text-cluster-white/70">
            <span className="text-cluster-white/50">proof</span>{' '}
            {shortHash(attestation.proofHash)}
          </div>
          <div className="font-mono-tech text-[11px] text-cluster-white/70">
            <span className="text-cluster-white/50">timestamp</span>{' '}
            {new Date(attestation.timestamp).toISOString()}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <span className="chip muted text-[10px]">
            <span className="dot" /> relay
          </span>
          <div className="font-mono-tech text-[11px] leading-5 text-cluster-white/60">
            Relay path — TEE attestation activates when the first bare-metal node
            registers.
          </div>
          {meta?.node ? (
            <div className="font-mono-tech text-[11px] text-cluster-white/70">
              <span className="text-cluster-white/50">node</span>{' '}
              {shortHash(meta.node)}
            </div>
          ) : null}
          {meta?.region ? (
            <div className="font-mono-tech text-[11px] text-cluster-white/70">
              <span className="text-cluster-white/50">region</span> {meta.region}
            </div>
          ) : null}
          {meta?.requestId ? (
            <div className="font-mono-tech text-[11px] text-cluster-white/70">
              <span className="text-cluster-white/50">request</span>{' '}
              {shortHash(meta.requestId)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
