import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { photoUrl } from "../lib/photos";

interface PhotoTileProps {
  id: string;
  alt: string;
  selected?: boolean;
  /** Overlay controls (delete button). */
  children?: ReactNode;
  className?: string;
}

/** A stored photo in a 3:4 frame, streamed from the API. */
export function PhotoTile({ id, alt, selected, children, className }: PhotoTileProps) {
  return (
    <div
      className={cn(
        "border-border bg-secondary relative aspect-3/4 overflow-hidden rounded-xl border",
        selected && "ring-brand ring-3",
        className,
      )}>
      {/* The API streams private photos; next/image would proxy them through the web server. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl(id)} alt={alt} loading='lazy' className='size-full object-cover' />
      {children}
    </div>
  );
}

/** The round ✕ in a tile's corner. */
export function TileRemoveButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type='button'
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className='bg-background/80 text-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full backdrop-blur-sm disabled:opacity-50'>
      <X className='size-3.5' aria-hidden />
    </button>
  );
}
