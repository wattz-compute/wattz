'use client';

import type { AttestationSummary } from '@/lib/api';
import { shortHash } from '@/lib/format';

interface AttestationBadgeProps {
  attestation: AttestationSummary | null;
}

const typeLabels: Record<AttestationSummary['attestationType'], string> = {
  sgx: 'Intel SGX',
  sev: 'AMD SEV-SNP',
  'nvidia-cc': 'NVIDIA CC',
  risc0: 'Risc0 zkVM',
  sp1: 'SP1 zkVM',
};

export function AttestationBadge({ attestation }: AttestationBadgeProps) {
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
            <span className="text-cluster-white/50">verifier</span>{' '}
            {attestation.verifier}
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
        <div className="mt-3 space-y-2 font-mono-tech text-[11px] text-cluster-white/60">
          <div>Awaiting first response.</div>
          <div className="text-cluster-white/45">
            Every settled call carries a TEE attestation quote. Skeptical
            clients may demand an additional Risc0 or SP1 receipt.
          </div>
        </div>
      )}
    </div>
  );
}
