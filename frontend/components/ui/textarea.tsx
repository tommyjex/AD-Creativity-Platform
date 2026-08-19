import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-28 w-full rounded-lg border border-input bg-card px-3 py-2 text-base shadow-sm transition-all placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
