"use client";

import { Toaster } from "sonner";

export function Sonner() {
  return (
    <Toaster
      position='top-right'
      richColors
      closeButton
      duration={3500}
      toastOptions={{
        className: "font-sans",
      }}
    />
  );
}
