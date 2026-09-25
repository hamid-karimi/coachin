"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ShareCardSheet } from "@/components/design-system/share-card-sheet";
import { Button } from "@/components/ui/button";
import { progressShareCard } from "@/lib/share-card";
import { photoUrl, type PhotoItem } from "../lib/photos";

async function photoBlob(photo: PhotoItem): Promise<Blob> {
  const response = await fetch(photoUrl(photo.id));
  if (!response.ok) throw new Error(`photo ${response.status}`);
  return response.blob();
}

/** "Share progress" for a compared pair (oldest first): loads both photos, then the card sheet. */
export function ProgressShare({ pair }: { pair: [PhotoItem, PhotoItem] }) {
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<[Blob, Blob] | null>(null);

  const open = async () => {
    setLoading(true);
    try {
      setPhotos(await Promise.all([photoBlob(pair[0]), photoBlob(pair[1])]));
    } catch {
      toast.error("Couldn't load the photos — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='space-y-1.5'>
      <Button type='button' variant='brand' size='sm' disabled={loading} onClick={open}>
        {loading ? <Loader2 className='animate-spin' aria-hidden /> : <Share2 aria-hidden />}
        Share progress
      </Button>
      <p className='text-muted-foreground text-xs'>The shared image contains your photos — you choose where it goes.</p>
      {photos && (
        <ShareCardSheet
          open
          onClose={() => setPhotos(null)}
          comparePhotos={photos}
          data={progressShareCard(pair[0].createdAt, pair[1].createdAt)}
        />
      )}
    </div>
  );
}
