import { NextRequest, NextResponse } from 'next/server';

// Launch gating. Closed surfaces return a real 404 before any rendering
// starts (page-level notFound() cannot set the status once the streaming
// shell has flushed). Flags are read from the deployment's env, so flipping
// one requires a redeploy.
const GATES = [
  { prefix: '/playground', open: process.env.NEXT_PUBLIC_1_PLAYGROUND === 'true' },
  { prefix: '/docs', open: process.env.NEXT_PUBLIC_2_SDK === 'true' },
  { prefix: '/operator', open: process.env.NEXT_PUBLIC_3_OPERATOR === 'true' },
];

const CLOSED_BODY = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>404 — wattz</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0A0E27; color: #F0EAD6; font-family: ui-monospace, 'JetBrains Mono', monospace; }
  main { text-align: center; padding: 24px; }
  .code { font-size: 40px; letter-spacing: 0.2em; color: #5BC0EB; }
  .line { margin-top: 12px; font-size: 13px; color: rgba(240, 234, 214, 0.6); }
  a { color: #D4AF37; text-decoration: none; }
</style>
</head>
<body>
<main>
  <div class="code">404</div>
  <p class="line">This bus is not energized. <a href="/">Back to the substation</a></p>
</main>
</body>
</html>`;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  for (const gate of GATES) {
    if (!gate.open && (pathname === gate.prefix || pathname.startsWith(`${gate.prefix}/`))) {
      return new NextResponse(CLOSED_BODY, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/playground/:path*', '/docs/:path*', '/operator/:path*'],
};
