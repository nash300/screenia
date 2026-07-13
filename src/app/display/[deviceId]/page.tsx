"use client";

import { use, useCallback, useEffect, useState } from "react";

type PlaylistItem = {
  id: string;
  src: string;
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
        title="Loading..."
        subtitle="Preparing display content."
        deviceId={deviceId}
      />
    );
  }

  if (error) {
    return (
      <DisplayMessage
        title="Display inactive"
        subtitle="Please contact Screenia."
        deviceId={deviceId}
      />
    );
  }

  if (!currentItem) {
    return (
      <DisplayMessage
        title="No content assigned"
        subtitle="This device has no playlist yet."
        deviceId={deviceId}
      />
    );
  }

  return (
    <main className="fixed inset-0 z-[9999] overflow-hidden bg-black">
      <video
        key={currentItem.src}
        src={currentItem.src}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={goToNextItem}
        onError={goToNextItem}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute left-2 top-2 text-sm text-white opacity-40">
        Device: {deviceId}
      </div>
    </main>
  );
}

function DisplayMessage({
  title,
  subtitle,
  deviceId,
}: {
  title: string;
  subtitle: string;
  deviceId: string;
}) {
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-black text-center text-white">
      <div>
        <p className="mb-2 text-xl">{title}</p>
        <p className="text-sm opacity-70">{subtitle}</p>
        <p className="mt-2 text-sm opacity-50">Device: {deviceId}</p>
      </div>
    </main>
  );
}
