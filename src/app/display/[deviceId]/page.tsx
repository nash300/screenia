"use client";

import { use, useCallback, useEffect, useState } from "react";

type PlaylistItem = {
  id: string;
  src: string;
  type?: string | null;
  contentType?: string | null;
};

type DisplayPlaylistResponse = {
  playlist?: PlaylistItem[];
  error?: string;
};

const DISPLAY_CACHE_NAMES = ["screenia-video-cache-v1", "screenia-cache-v1"];

export default function DisplayPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = use(params);

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentItem = playlist[index];

  const goToNextItem = () => {
    setIndex((prev) => {
      if (playlist.length === 0) return 0;
      return (prev + 1) % playlist.length;
    });
  };

  const saveCachedPlaylist = useCallback((items: PlaylistItem[]) => {
    localStorage.setItem(`playlist-${deviceId}`, JSON.stringify(items));
  }, [deviceId]);

  const clearCachedPlaylist = useCallback(async () => {
    localStorage.removeItem(`playlist-${deviceId}`);

    if ("caches" in window) {
      await Promise.all(DISPLAY_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)));
    }
  }, [deviceId]);

  useEffect(() => {
    const fetchPlaylist = async () => {
      setError("");

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      let response: Response;
      try {
        response = await fetch(`/api/display/${deviceId}/playlist`, {
          cache: "no-store",
        });
      } catch (error) {
        console.error("Display playlist request failed:", error);
        await clearCachedPlaylist();
        setPlaylist([]);
        setIndex(0);
        setError("This display is not active.");
        setLoading(false);
        return;
      }

      const data = (await response.json()) as DisplayPlaylistResponse;

      if (!response.ok) {
        console.error("Display playlist denied:", data.error);
        await clearCachedPlaylist();
        setPlaylist([]);
        setIndex(0);
        setError(data.error || "This display is not active.");
        setLoading(false);
        return;
      }

      const freshPlaylist = data.playlist || [];

      setPlaylist(freshPlaylist);
      saveCachedPlaylist(freshPlaylist);

      setIndex((currentIndex) => {
        if (freshPlaylist.length === 0) return 0;
        if (currentIndex >= freshPlaylist.length) return 0;
        return currentIndex;
      });

      setLoading(false);
    };

    fetchPlaylist();

    const interval = setInterval(fetchPlaylist, 3000);

    return () => clearInterval(interval);
  }, [clearCachedPlaylist, deviceId, saveCachedPlaylist]);

  if (loading) {
    return (
      <DisplayMessage
        tone="loading"
        title="Preparing display"
        subtitle="Screenia is checking this device and loading approved content."
        deviceId={deviceId}
      />
    );
  }

  if (error) {
    return <BlankDisplay reason="inactive" />;
  }

  if (!currentItem) {
    return (
      <DisplayMessage
        tone="empty"
        title="No content assigned"
        subtitle="This device is active, but no playlist has been published yet."
        deviceId={deviceId}
      />
    );
  }

  const isImage = currentItem.type === "image" || currentItem.contentType?.startsWith("image/");

  return (
    <main
      className="screenia-display-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={currentItem.src}
          src={currentItem.src}
          alt=""
          className="screenia-display-media"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={goToNextItem}
        />
      ) : (
        <video
          key={currentItem.src}
          src={currentItem.src}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={goToNextItem}
          onError={goToNextItem}
          className="screenia-display-media"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

    </main>
  );
}

function BlankDisplay({ reason }: { reason: string }) {
  return (
    <main
      aria-label={`Screenia display ${reason}`}
      className="fixed inset-0 z-[9999] overflow-hidden bg-black"
    />
  );
}

function DisplayMessage({
  tone = "loading",
  title,
  subtitle,
  deviceId,
}: {
  tone?: "loading" | "blocked" | "empty";
  title: string;
  subtitle: string;
  deviceId: string;
}) {
  return (
    <main className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#050b18] p-6 text-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(47,125,246,0.28),transparent_32%),radial-gradient(circle_at_70%_80%,rgba(244,122,32,0.12),transparent_28%)]" />
      <div className="relative grid w-full max-w-md gap-4 rounded-[24px] border border-white/10 bg-white/[0.08] p-8 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur">
        <span
          className={`mx-auto h-3 w-16 rounded-full ${
            tone === "blocked"
              ? "bg-[#ef4444]"
              : tone === "empty"
                ? "bg-[#f59e0b]"
                : "bg-[#2f7df6]"
          }`}
          aria-hidden="true"
        />
        <div>
          <p className="mb-2 text-2xl font-black tracking-tight">{title}</p>
          <p className="text-sm leading-6 text-white/72">{subtitle}</p>
        </div>
        <p className="mx-auto w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-white/56">
          Device: {deviceId}
        </p>
      </div>
    </main>
  );
}
