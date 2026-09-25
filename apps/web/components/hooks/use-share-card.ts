"use client";

import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { compressImage } from "@/lib/client-image";
import type { ShareCardData } from "@/lib/share-card";
import { renderShareCard, type ShareCardFormat } from "@/lib/share-card-canvas";

type State = {
  format: ShareCardFormat;
  photo: File | null;
  /** The last rendered card and its preview URL; they stay up while the next one draws. */
  file: File | null;
  previewUrl: string | null;
  busy: boolean;
};

type Action =
  | { type: "format"; format: ShareCardFormat }
  | { type: "photo"; photo: File }
  | { type: "rendered"; file: File; previewUrl: string }
  | { type: "failed" };

const INITIAL: State = { format: "story", photo: null, file: null, previewUrl: null, busy: true };

/** Each action patches the state; a new format or photo starts a render. */
function reducer(state: State, { type, ...patch }: Action): State {
  return { ...state, ...patch, busy: type === "format" || type === "photo" };
}

/**
 * The share sheet's card: re-rendered while open whenever the data (by content), the
 * format, or the backdrop photo changes. Nothing leaves the device unless the user
 * shares or saves.
 */
export function useShareCard(open: boolean, data: ShareCardData, comparePhotos?: readonly [Blob, Blob] | null) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  // Call sites build `data` inline; keying on its content skips needless re-renders.
  const dataKey = JSON.stringify(data);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    renderShareCard(JSON.parse(dataKey) as ShareCardData, { format: state.format, photo: state.photo, comparePhotos })
      .then((file) => {
        if (!cancelled) dispatch({ type: "rendered", file, previewUrl: URL.createObjectURL(file) });
      })
      .catch(() => {
        if (cancelled) return;
        dispatch({ type: "failed" });
        toast.error("Couldn't build the image — try again");
      });
    return () => {
      cancelled = true;
    };
  }, [open, dataKey, state.format, state.photo, comparePhotos]);

  // Release each preview URL once the next one replaces it, and the last on unmount.
  useEffect(() => {
    const url = state.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.previewUrl]);

  return {
    ...state,
    setFormat: (format: ShareCardFormat) => dispatch({ type: "format", format }),
    pickPhoto: async (picked: File | undefined) => {
      if (!picked) return;
      try {
        dispatch({ type: "photo", photo: await compressImage(picked) });
      } catch {
        toast.error("Could not read that image");
      }
    },
  };
}

/** Whether the OS share sheet takes this file (mobile); otherwise we save it. */
export function canShareFile(file: File | null): boolean {
  return typeof navigator !== "undefined" && file !== null && Boolean(navigator.canShare?.({ files: [file] }));
}

/** The OS share sheet when available (a cancel is not an error), else a download. */
export async function shareOrSave(file: File) {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Sharing failed — saving the image instead");
    }
  }
  saveFile(file);
}

export function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}
