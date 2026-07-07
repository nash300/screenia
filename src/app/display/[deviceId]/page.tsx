"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PlaylistItem = {
  src: string;
};

type Device = {
  id: string;
  is_active: boolean;
  customers: {
    status: string | null;
  } | null;
};

const CACHE_NAME = "screenia-video-cache-v1";

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

  const cacheVideos = async (items: PlaylistItem[]) => {
    if (!("caches" in window)) return;

    const cache = await caches.open(CACHE_NAME);

    for (const item of items) {
      try {
        const existing = await cache.match(item.src);

        if (!existing) {
          await cache.add(item.src);
          console.log("Cached video:", item.src);
        }
      } catch (error) {
        console.error("Could not cache video:", item.src, error);
      }
    }
  };

  const getCachedPlaylist = async () => {
    if (!("localStorage" in window)) return [];

    const saved = localStorage.getItem(`playlist-${deviceId}`);
    if (!saved) return [];

    try {
      return JSON.parse(saved) as PlaylistItem[];
    } catch {
      return [];
    }
  };

  const saveCachedPlaylist = (items: PlaylistItem[]) => {
    localStorage.setItem(`playlist-${deviceId}`, JSON.stringify(items));
  };

  useEffect(() => {
    const fetchPlaylist = async () => {
      setError("");

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then(() => console.log("Service Worker registered"))
          .catch((err) => console.error("SW error:", err));
      }

      const { data: device, error: deviceError } = await supabase
        .from("devices")
        .select(
          `
          id,
          is_active,
          customers(status)
        `,
        )
        .eq("device_code", deviceId)
        .maybeSingle<Device>();

      if (deviceError || !device) {
        console.error("Device not found:", deviceError);

        const cached = await getCachedPlaylist();
        setPlaylist(cached);
        setLoading(false);
        return;
      }

      if (!device.is_active || device.customers?.status !== "active") {
        setError("This display is not active.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("playlists")
        .select("src")
        .eq("device_id", device.id)
        .order("order_index");

      if (error) {
        console.error("Playlist error:", error);

        const cached = await getCachedPlaylist();
        setPlaylist(cached);
        setLoading(false);
        return;
      }

      const freshPlaylist = data || [];

      setPlaylist(freshPlaylist);
      saveCachedPlaylist(freshPlaylist);
      cacheVideos(freshPlaylist);

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
  }, [deviceId]);

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
