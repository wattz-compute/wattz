'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { extractVideoId } from '@/lib/extractVideoId';

// YouTube IFrame Background Music.
// Validates NEXT_PUBLIC_YOUTUBE_BGM_ID via extractVideoId (11-char [A-Za-z0-9_-]).
// Renders `return null` for missing/invalid IDs so YT.Player never receives
// an "Invalid video id" (which triggers a console throw).

const STORAGE_KEY = 'wattz-bgm-unlocked';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  loadVideoById(id: string): void;
  getPlayerState(): number;
}

export function BackgroundMusic() {
  const rawId = process.env.NEXT_PUBLIC_YOUTUBE_BGM_ID;
  const videoId = extractVideoId(rawId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!videoId) return;
    if (typeof window === 'undefined') return;

    const initPlayer = () => {
      if (!window.YT || !containerRef.current) return;
      playerRef.current = new window.YT.Player('wattz-bgm-frame', {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          loop: 1,
          playlist: videoId,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(35);
            event.target.mute();
            event.target.playVideo();
            setReady(true);
            try {
              const persisted = sessionStorage.getItem(STORAGE_KEY);
              if (persisted === '1') {
                event.target.unMute();
                setMuted(false);
              }
            } catch {
              // sessionStorage may throw in privacy modes; ignore.
            }
          },
          onStateChange: (event) => {
            if (event.data === 0 && playerRef.current) {
              // Ensure loop on ended.
              playerRef.current.playVideo();
            }
          },
        },
      });
    };

    const existing = document.getElementById('wattz-yt-iframe-script');
    if (existing) {
      if (window.YT && window.YT.Player) initPlayer();
      else window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.id = 'wattz-yt-iframe-script';
      tag.async = true;
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      playerRef.current = null;
    };
  }, [videoId]);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (playerRef.current.isMuted()) {
      playerRef.current.unMute();
      playerRef.current.playVideo();
      setMuted(false);
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // ignore storage failures
      }
    } else {
      playerRef.current.mute();
      setMuted(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, '0');
      } catch {
        // ignore storage failures
      }
    }
  }, []);

  if (!videoId) return null;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: -400,
          right: -400,
          width: 320,
          height: 180,
          opacity: 0,
          pointerEvents: 'none',
        }}
        ref={containerRef}
      >
        <div id="wattz-bgm-frame" />
      </div>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute background hum' : 'Mute background hum'}
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-glow/25 bg-night/80 text-cluster-white shadow-substation backdrop-blur transition hover:border-cyan-glow/60"
        style={{ opacity: ready ? 1 : 0.5 }}
      >
        <SpeakerIcon muted={muted} />
      </button>
    </>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10v4h4l5 4V6L7 10H3z" strokeLinejoin="round" />
      {muted ? (
        <>
          <line x1="17" y1="9" x2="22" y2="14" strokeLinecap="round" />
          <line x1="22" y1="9" x2="17" y2="14" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M16 8c1.6 1 2.6 2.4 2.6 4S17.6 15 16 16" strokeLinecap="round" />
          <path d="M18.5 5.5C21 7 22.5 9.4 22.5 12s-1.5 5-4 6.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
