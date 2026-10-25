"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function IconButton({ label, children, className, tooltip = true, ...props }) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      aria-label={label}
      className={cn(
        "size-11 rounded-full bg-transparent text-foreground hover:bg-surface-container-high",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
