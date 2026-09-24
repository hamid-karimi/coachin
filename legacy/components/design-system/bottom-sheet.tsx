"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional muted line under the title. */
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Responsive modal: a bottom sheet on mobile (slides up from the edge, rounded
 * top, grab handle) and a centered dialog on sm+ screens. Hand-rolled to match
 * ConfirmDialog — the app has no Radix dialog dependency. Closes on overlay
 * click or Escape.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "bg-popover border-border flex max-h-[85vh] w-full flex-col overflow-hidden border shadow-2xl",
          "rounded-t-2xl sm:max-w-md sm:rounded-2xl",
          "animate-in fade-in slide-in-from-bottom-4 duration-200",
          className,
        )}
      >
        {/* Grab handle — signals the sheet is dismissible on touch. */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="bg-border h-1 w-9 rounded-full" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-foreground text-base font-bold break-words">
              {title}
            </h2>
            {description ? (
              <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 rounded-md p-1"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
