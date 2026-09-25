import * as React from "react";

import { cn } from "@/lib/utils";

/** Native <select> styled like Input (keeps the OS picker on phones). */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot='native-select'
      className={cn(
        "border-input bg-background text-foreground flex h-11 w-full min-w-0 rounded-md border px-3 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[15px]",
        "focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
