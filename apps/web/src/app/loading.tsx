export default function Loading() {
  return (
    <div className="wattz-loader">
      <div className="relative flex items-center justify-center">
        <div className="ring">
          <div className="core" />
        </div>
        <div className="orbital-arc absolute h-40 w-40" />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="font-display text-lg tracking-widest text-cluster-white">
          wattz
        </div>
        <div className="font-mono-tech text-[10px] uppercase tracking-[0.32em] text-cyan-glow">
          substation booting
        </div>
        <div className="font-mono-tech text-[10px] uppercase tracking-[0.32em] text-cluster-white/50">
          warming transformers - streaming attestation - opening busbars
        </div>
      </div>
    </div>
  );
}
