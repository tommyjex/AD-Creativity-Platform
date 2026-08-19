import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/[0.08] text-primary hover:bg-primary/[0.12]",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-destructive/30 bg-destructive/[0.12] text-destructive shadow hover:bg-destructive/[0.16]",
        outline: "border-border bg-card text-foreground",
        signal:
          "border-primary/20 bg-primary/[0.07] text-primary",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/[0.35] bg-warning/10 text-warning",
        info: "border-info/[0.35] bg-info/10 text-info"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
