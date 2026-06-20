import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SafeLink } from '@/components/layout/SafeLink';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="relative min-h-[70vh] pt-32 pb-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
          <div className="font-mono-tech text-[10px] uppercase tracking-[0.32em] text-cyan-glow">
            404 - offline busbar
          </div>
          <h1 className="mt-6 font-display text-4xl text-cluster-white sm:text-5xl">
            This wire is not routed.
          </h1>
          <p className="mt-4 max-w-lg text-cluster-white/70">
            The substation could not find that endpoint. Head back to the
            landing page or try the playground.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SafeLink href="/">
              <Button>Return to landing</Button>
            </SafeLink>
            <SafeLink href="/playground">
              <Button variant="ghost">Open playground</Button>
            </SafeLink>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
