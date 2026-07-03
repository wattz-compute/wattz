import { notFound } from 'next/navigation';

// force-dynamic so a closed flag returns a real request-time 404, not a
// prerendered 200 shell.
export const dynamic = 'force-dynamic';
import { FLAGS } from '@/lib/flags';
import { DocsView } from './view';

// Launch gating happens server-side so closed surfaces return a real 404.
export default function Page() {
  if (!FLAGS.sdk) notFound();
  return <DocsView />;
}
