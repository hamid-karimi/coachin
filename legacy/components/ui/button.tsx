import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        /* One volt-filled button per screen, max. */
        brand: "bg-brand text-brand-foreground font-bold hover:brightness-105",
        default: "bg-primary text-primary-foreground font-bold hover:brightness-105",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        success:
          "bg-success font-bold text-white hover:brightness-105 dark:text-[#17161A]",
        "destructive-outline":
          "border border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:border-muted-foreground/40",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "text-brand-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-sm px-3",
        lg: "h-12 rounded-lg px-6 text-[15px]",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "brand",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
