import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[-0.01em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/0.18)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_12px_26px_hsl(var(--primary)/0.22)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-card text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 hover:text-primary",
        secondary:
          "bg-secondary/[0.82] text-secondary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        signal:
          "border border-primary/20 bg-primary/[0.07] text-primary hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/10",
        cinematic:
          "bg-primary text-primary-foreground shadow-[0_10px_28px_hsl(var(--primary)/0.20)] hover:-translate-y-0.5 hover:bg-primary/90",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-8",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
