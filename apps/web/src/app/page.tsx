import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroCopy } from '@/components/hero/HeroCopy';
import { TrustBar } from '@/components/hero/TrustBar';
import { ProblemSection } from '@/components/sections/Problem';
import { SolutionSection } from '@/components/sections/Solution';
import { FeaturesSection } from '@/components/sections/Features';
import { QuickstartSection } from '@/components/sections/Quickstart';
import { TokenSection } from '@/components/sections/Token';
import { CtaSection } from '@/components/sections/CTA';

const SubstationScene = dynamic(() => import('@/components/hero/SubstationScene'), {
  ssr: false,
  loading: () => <HeroFallback />,
});

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <section id="hero" className="relative">
          <HeroCopy />
          <SubstationScene />
          <TrustBar />
        </section>

        <ProblemSection />
        <div className="mx-auto max-w-6xl px-6">
          <div className="wire-divider" />
        </div>
        <SolutionSection />
        <div className="mx-auto max-w-6xl px-6">
          <div className="wire-divider" />
        </div>
        <FeaturesSection />
        <div className="mx-auto max-w-6xl px-6">
          <div className="wire-divider" />
        </div>
        <QuickstartSection />
        <div className="mx-auto max-w-6xl px-6">
          <div className="wire-divider" />
        </div>
        <TokenSection />
        <div className="mx-auto max-w-6xl px-6">
          <div className="wire-divider" />
        </div>
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}

function HeroFallback() {
  return (
    <div className="relative flex h-[55vh] min-h-[380px] w-full items-center justify-center bg-night-deep md:h-[92vh] md:min-h-[620px]">
      <div className="grid-floor absolute inset-0" />
      <div className="relative flex flex-col items-center gap-3 text-cluster-white/70">
        <div className="relative h-40 w-40">
          <div className="orbital-arc" />
        </div>
        <div className="font-mono-tech text-[10px] uppercase tracking-widest">
          substation booting
        </div>
      </div>
    </div>
  );
}
