"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { compressImage } from "@/lib/client-image";

export interface PendingPhoto {
  file: File;
  url: string;
}

/** Picked-but-not-uploaded photos: compressed on the device, previewed, capped at max. */
export function usePendingPhotos(max: number) {
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const latest = useRef(pending);

  useEffect(() => {
    latest.current = pending;
  }, [pending]);
  // Release the previews still held when the section unmounts.
  useEffect(() => () => latest.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const add = async (list: FileList | null) => {
    const room = max - pending.length;
    const files = Array.from(list ?? []);
    if (files.length > room) toast.info(`Only ${max} images per upload — extra files skipped`);
    if (files.length === 0 || room <= 0) return;
    setPreparing(true);
    try {
      const compressed = await Promise.all(files.slice(0, room).map(compressImage));
      setPending((current) => [...current, ...compressed.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    } catch {
      toast.error("Could not read that image");
    } finally {
      setPreparing(false);
    }
  };

  const remove = (url: string) => {
    URL.revokeObjectURL(url);
    setPending((current) => current.filter((item) => item.url !== url));
  };

  const clear = () => {
    pending.forEach((item) => URL.revokeObjectURL(item.url));
    setPending([]);
  };

  return { pending, preparing, add, remove, clear };
}
