"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Slide } from "@/lib/slides";

type Props = { slides: Slide[] };

// Card widths & spacing — MUST match the CSS variables in globals.css
const IDLE_W = 360;
const GAP = 24;
const STEP = IDLE_W + GAP;
const LEFT_PADDING = 96;
const COPIES = 5;
const DURATION = 2000; // ms — must match .ribbon__media transition in globals.css

export function VideoRibbon({ slides }: Props) {
  const count = slides.length;
  // Render slides N times so there's always content before/after the active
  // card. Center the initial index within the rendered copies so the user can
  // go either direction.
  const rendered = useMemo(
    () =>
      Array.from({ length: COPIES }, (_, copy) =>
        slides.map((s) => ({ ...s, _key: `${s.id}-c${copy}` })),
      ).flat(),
    [slides],
  );
  const startIndex = Math.floor(COPIES / 2) * count;

  const [index, setIndex] = useState(startIndex);
  const [jumping, setJumping] = useState(false);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  const offset = LEFT_PADDING - index * STEP;

  const displayIndex = ((index % count) + count) % count;

  // Play active, pause every other. Pause happens FIRST to override any
  // speculative autoplay the browser might have started for preloaded videos.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      video.muted = true;
      video.defaultMuted = true;
      if (i !== index) video.pause();
    });
    const active = videoRefs.current[index];
    if (!active) return;
    active.currentTime = 0;
    const tryPlay = () => active.play().catch(() => {});
    tryPlay();
    if (active.readyState < 2) {
      active.addEventListener("canplay", tryPlay, { once: true });
    }
  }, [index]);

  // When we get close to an edge, silently re-anchor to the equivalent middle
  // position: same modular index, but inside the "safe" middle copies. The
  // jump happens with transitions disabled, so the viewer sees nothing.
  useEffect(() => {
    const low = count;
    const high = (COPIES - 1) * count - 1;
    if (index < low || index > high) {
      setJumping(true);
      // Next tick: update index to mirror position, then re-enable transitions
      const delta = index < low ? count : -count;
      requestAnimationFrame(() => {
        setIndex((i) => i + delta);
        requestAnimationFrame(() => setJumping(false));
      });
    }
  }, [index, count]);

  const goNext = useCallback(() => setIndex((i) => i + 1), []);
  const goPrev = useCallback(() => setIndex((i) => i - 1), []);

  // Auto-advance on video end
  const handleVideoEnded = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const i = Number((e.currentTarget as HTMLVideoElement).dataset.index);
      if (i === index) goNext();
    },
    [index, goNext],
  );

  // Robust autoplay: retry on mount and first user interaction
  useEffect(() => {
    const tryPlay = () => {
      const active = videoRefs.current[index];
      if (active && active.paused) {
        active.muted = true;
        active.play().catch(() => {});
      }
    };
    tryPlay();
    const retry = setTimeout(tryPlay, 400);
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) =>
      document.addEventListener(e, tryPlay, { once: true, passive: true }),
    );
    return () => {
      clearTimeout(retry);
      events.forEach((e) => document.removeEventListener(e, tryPlay));
    };
  }, [index]);

  return (
    <section className="ribbon">
      <div className="ribbon__header">
        <div>
          <h2 className="ribbon__heading">Our work</h2>
          <p className="ribbon__strapline">
            Learn more about the work we do and how it makes a difference to
            clients and communities.
          </p>
        </div>
        <a className="ribbon__cta" href="#">
          <span>See our projects</span>
          <span aria-hidden="true" className="ribbon__cta-arrow">
            →
          </span>
        </a>
      </div>

      <div className="ribbon__controls">
        <span className="ribbon__counter">
          {displayIndex + 1}&mdash;{count}
        </span>
        <div className="ribbon__nav">
          <button type="button" aria-label="Previous slide" onClick={goPrev}>
            ←
          </button>
          <button type="button" aria-label="Next slide" onClick={goNext}>
            →
          </button>
        </div>
      </div>

      <div className="ribbon__viewport">
        <div
          className="ribbon__track"
          style={{
            transform: `translate3d(${offset}px, 0, 0)`,
            transition: jumping
              ? "none"
              : `transform ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        >
          {rendered.map((slide, i) => (
            <article
              key={slide._key}
              className="ribbon__card"
              data-offset={i - index}
              style={
                jumping
                  ? {
                      transition: "none",
                    }
                  : undefined
              }
            >
              <div className="ribbon__media">
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  data-index={i}
                  src={slide.videoUrl}
                  autoPlay={i === index}
                  muted
                  playsInline
                  preload="auto"
                  controls={false}
                  disablePictureInPicture
                  onEnded={handleVideoEnded}
                />
              </div>
              <div className="ribbon__meta">
                <span className="ribbon__subtitle">{slide.subtitle}</span>
                <h3 className="ribbon__title">{slide.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
