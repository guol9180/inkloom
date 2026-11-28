import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactElement } from "react";

export const TooltipProvider = TooltipPrimitive.Provider;

export function AppTooltip({
  label,
  children,
  side = "top",
  shortcut
}: {
  label: string;
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={7}
          className="z-[130] flex items-center gap-2 rounded-lg border border-line-soft bg-ink-950 px-2.5 py-1.5 text-[0.7rem] font-medium text-white shadow-popover"
        >
          {label}
          {shortcut && (
            <kbd className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[0.75rem] text-white/75">
              {shortcut}
            </kbd>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
