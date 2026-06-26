'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'wattz-operator-bgm-unlocked';
const SESSION_MUTE_KEY = 'wattz-operator-bgm-muted';

function extractVideoId(input: string | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const v = url.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split('/').filter(Boolean);
    for (const part of parts) {
      if (/^[a-zA-Z0-9_-]{11}$/.test(part)) return part;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Minimal industrial BGM using the YouTube IFrame API. The videoId is
 * validated against `[a-zA-Z0-9_-]{11}`; invalid values render nothing so
 * the console does not throw "Invalid video id".
 */
export function BackgroundMusic() {
  const rawId = process.env.NEXT_PUBLIC_YOUTUBE_BGM_ID;
  const videoId = extractVideoId(rawId);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const playerRef = useRef<YT.Player | null>(null);
  const iframeIdRef = useRef(`wattz-bgm-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!videoId) return;
    try {
      const stored = sessionStorage.getItem(SESSION_MUTE_KEY);
      if (stored === 'false') setMuted(false);
    } catch {
      // sessionStorage may throw in privacy mode
    }
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    const attach = () => {
      if (cancelled) return;
      if (!window.YT || !window.YT.Player) {
        window.setTimeout(attach, 300);
        return;
      }
      playerRef.current = new window.YT.Player(iframeIdRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          loop: 1,
          playlist: videoId,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(24);
            if (muted) event.target.mute();
            else event.target.unMute();
            event.target.playVideo();
            setReady(true);
          },
        },
      });
    };

    if (!document.getElementById('wattz-yt-iframe-api')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.id = 'wattz-yt-iframe-api';
      script.async = true;
      document.body.appendChild(script);
    }
    attach();

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    if (!ready || !playerRef.current) return;
    try {
      if (muted) playerRef.current.mute();
      else playerRef.current.unMute();
      sessionStorage.setItem(SESSION_MUTE_KEY, muted ? 'true' : 'false');
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }, [muted, ready]);

  const toggle = useCallback(() => setMuted((prev) => !prev), []);

  if (!videoId) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-3">
      <div className="hidden" aria-hidden id={iframeIdRef.current} />
      <button
        onClick={toggle}
        className="wattz-card px-3 py-2 text-xs uppercase tracking-widest text-cluster hover:text-cyan"
        aria-label={muted ? 'Unmute background music' : 'Mute background music'}
      >
        {muted ? 'sound: off' : 'sound: on'}
      </button>
    </div>
  );
}

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Minimal YT namespace typing to avoid pulling in @types/youtube.
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace YT {
  interface PlayerOptions {
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: Player }) => void;
    };
  }
  class Player {
    constructor(id: string, options: PlayerOptions);
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    playVideo(): void;
    pauseVideo(): void;
    destroy(): void;
  }
}
