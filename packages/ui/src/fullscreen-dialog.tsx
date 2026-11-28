import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./button";

export function FullscreenDialog({
  open,
  title,
  description,
  onClose,
  children,
  showClose = true
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  showClose?: boolean;
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-white text-ink-900 outline-none">
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>
          )}
          {showClose && (
            <DialogPrimitive.Close asChild>
              <IconButton
                className="absolute top-3 right-3 z-10"
                aria-label={`关闭${title}`}
              >
                <X size={18} />
              </IconButton>
            </DialogPrimitive.Close>
          )}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
