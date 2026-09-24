"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/client-image";

/** Pick up to 3 photos of one meal (+ an optional hint); they are compressed on the device first. */
export function PhotoCapture({ busy, onPhotos }: { busy: boolean; onPhotos: (photos: File[], hint: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState("");
  const [preparing, setPreparing] = useState(false);
  const working = busy || preparing;

  const picked = async (list: FileList | null) => {
    const files = Array.from(list ?? []).slice(0, 3);
    if (input.current) input.current.value = "";
    if (files.length === 0) return;
    setPreparing(true);
    try {
      onPhotos(await Promise.all(files.map(compressImage)), hint);
    } catch {
      toast.error("Could not read that image");
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className='space-y-2'>
      <input
        ref={input}
        type='file'
        accept='image/jpeg,image/png,image/webp'
        multiple
        className='sr-only'
        aria-label='Meal photos'
        onChange={(e) => picked(e.target.files)}
      />
      <Input
        aria-label='What is it? (optional)'
        maxLength={140}
        placeholder='Optional: what is it? e.g. restaurant pizza, large'
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        disabled={working}
      />
      <Button type='button' variant='brand' disabled={working} onClick={() => input.current?.click()}>
        {working ? <Loader2 className='animate-spin' aria-hidden /> : <Camera aria-hidden />}
        {working ? "Estimating…" : "Snap or choose meal photos"}
      </Button>
      <p className='text-muted-foreground text-xs'>
        Up to 3 photos of the same meal — different angles help with portions, and a shot of the package label beats any
        estimate. You review and adjust everything before it&apos;s saved.
      </p>
    </div>
  );
}
