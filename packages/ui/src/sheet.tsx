import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "./lib/cn";
import { IconButton } from "./button";

export type AppSheetSide = "bottom" | "left" | "right";

export function AppSheet({
  open,
  onOpenChange,
  title,
  description,
  header,
  children,
  footer,
  side = "right",
  showHeader = true,
  showClose = true,
  className,
  bodyClassName
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: AppSheetSide;
  showHeader?: boolean;
  showClose?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  const sideClassName =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[min(92dvh,56rem)] w-full rounded-t-[1.35rem] border-t"
      : side === "left"
        ? "inset-y-0 left-0 w-[min(88vw,19rem)] border-r"
        : "inset-y-0 right-0 w-[min(96vw,58rem)] border-l";

  return (
    <Drawer.Root
      open={open}
      direction={side}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[90] bg-ink-950/20 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "fixed z-[95] flex flex-col overflow-hidden border-line-soft bg-white text-ink-900 shadow-popover outline-none",
            sideClassName,
            className
          )}
        >
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          {description && (
            <Drawer.Description className="sr-only">
              {description}
            </Drawer.Description>
          )}
          {showHeader &&
            (header ?? (
              <header className="flex min-h-14 items-center gap-3 border-b border-line-soft px-4">
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-semibold text-ink-900">
                    {title}
                  </strong>
                  {description && (
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {description}
                    </p>
                  )}
                </div>
                {showClose && (
                  <Drawer.Close asChild>
                    <IconButton aria-label={`关闭${title}`}>
                      <X size={16} />
                    </IconButton>
                  </Drawer.Close>
                )}
              </header>
            ))}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              side === "bottom" && "overscroll-contain",
              bodyClassName
            )}
          >
            {children}
          </div>
          {footer && (
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-line-soft bg-paper-warm/70 px-5 py-4 sm:flex-row sm:justify-end">
              {footer}
            </footer>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
