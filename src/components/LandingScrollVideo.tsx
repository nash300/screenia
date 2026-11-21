"use client";

import { useEffect, useRef, useState } from "react";

type LandingScrollVideoProps = {
  videoSrc: string;
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
};

export function LandingScrollVideo({ videoSrc }: LandingScrollVideoProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    const playWhenVisible = () => {
      void video.play().catch(() => setIsPlaying(false));
    };
    const pauseWhenHidden = () => video.pause();
    const syncPlayback = () => {
      if (section.classList.contains("landing-reveal-visible")) {
        playWhenVisible();
      } else {
        pauseWhenHidden();
      }
    };
    const observer = new MutationObserver(syncPlayback);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);

    observer.observe(section, { attributeFilter: ["class"], attributes: true });
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    syncPlayback();

    return () => {
      observer.disconnect();
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      pauseWhenHidden();
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === mediaRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    };
  }, []);

  const handleTogglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSeek = (value: string) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Number(value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const revealControls = () => {
    setControlsVisible(true);
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2800);
  };

  const handleToggleFullscreen = () => {
    const media = mediaRef.current;
    if (!media) return;

    if (document.fullscreenElement === media) {
      void document.exitFullscreen();
      return;
    }

    if (media.requestFullscreen) void media.requestFullscreen();
  };

  return (
    <section
      ref={sectionRef}
      id="workflow"
      className="landing-screen-demo"
      aria-labelledby="screen-demo-title"
    >
      <div className="landing-screen-demo-orbit landing-screen-demo-orbit-one" aria-hidden="true" />
      <div className="landing-screen-demo-orbit landing-screen-demo-orbit-two" aria-hidden="true" />
      <div className="landing-screen-demo-grid-lines" aria-hidden="true" />

      <div className="landing-screen-demo-inner">
        <div className="landing-screen-demo-copy">
          <p className="landing-section-kicker">Vårt koncept</p>
          <h2 id="screen-demo-title">Digital skyltning som gör vardagen enklare.</h2>
          <p>
            Screenia hjälper er att göra en vanlig TV till en levande kanal för
            ert budskap. Ni berättar vad kunderna ska se, och vi hjälper er att
            få rätt innehåll på rätt plats – tydligt, snyggt och enkelt att hålla
            uppdaterat.
          </p>

          <div className="landing-screen-demo-points" aria-label="Så fungerar Screenia">
            <span><i aria-hidden="true">01</i>Visa det som betyder mest</span>
            <span><i aria-hidden="true">02</i>Få hjälp från idé till färdig skärm</span>
            <span><i aria-hidden="true">03</i>Ändra enkelt när verksamheten växer</span>
          </div>
        </div>

        <div
          ref={mediaRef}
          className={`landing-screen-demo-media${isPlaying ? " landing-screen-demo-media-playing" : ""}${controlsVisible ? " landing-screen-demo-media-controls-visible" : ""}`}
          onMouseEnter={() => setControlsVisible(true)}
          onMouseLeave={() => setControlsVisible(false)}
          onTouchStart={revealControls}
          onFocusCapture={() => setControlsVisible(true)}
        >
          <video
            ref={videoRef}
            className="landing-screen-demo-video"
            src={videoSrc}
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
            aria-label="Exempel på digital skyltning från Screenia"
            disablePictureInPicture
            disableRemotePlayback
          />
          <div className="landing-screen-demo-controls" aria-label="Videospelare">
            <button
              type="button"
              className="landing-screen-demo-control-button"
              onClick={handleTogglePlayback}
              aria-label={isPlaying ? "Pausa video" : "Spela video"}
            >
              <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            </button>
            <label className="landing-screen-demo-timeline">
              <span className="sr-only">Videotidslinje</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => handleSeek(event.target.value)}
                aria-label="Videotidslinje"
              />
            </label>
            <span className="landing-screen-demo-time" aria-live="off">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <button
              type="button"
              className="landing-screen-demo-control-button"
              onClick={handleToggleMute}
              aria-label={isMuted ? "Slå på ljudet" : "Stäng av ljudet"}
            >
              <span aria-hidden="true">{isMuted ? "🔇" : "🔊"}</span>
            </button>
            <button
              type="button"
              className="landing-screen-demo-control-button"
              onClick={handleToggleFullscreen}
              aria-label={isFullscreen ? "Avsluta helskärm" : "Visa i helskärm"}
            >
              <span aria-hidden="true">⛶</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
