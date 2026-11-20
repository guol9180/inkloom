import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { IconButton } from "./button";

export function AppDialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = "regular"
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "regular" | "wide";
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="app-dialog-overlay fixed inset-0 z-50 bg-ink-950/28 backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          className={cn(
            "app-dialog fixed top-1/2 left-1/2 z-50 max-h-[min(88dvh,860px)] w-[min(calc(100vw-1.25rem),36rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-dialog border border-white/80 bg-paper text-ink-950 shadow-dialog outline-none",
            size === "wide" && "w-[min(calc(100vw-1.25rem),52rem)]"
          )}
        >
          <header className="flex items-start justify-between gap-5 border-b border-line-soft px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-xl font-semibold tracking-[-0.025em] text-ink-950">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1.5 max-w-[58ch] text-sm leading-6 text-ink-500">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="关闭弹窗">
                <X size={18} />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          <div className="max-h-[calc(88dvh-8.5rem)] overflow-y-auto px-5 py-5 sm:px-6">
            {children}
          </div>
          {footer && (
            <footer className="flex flex-col-reverse gap-2 border-t border-line-soft bg-paper-warm/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
