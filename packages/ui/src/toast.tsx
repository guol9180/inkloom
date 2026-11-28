import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

export function AppToaster() {
  return (
    <SonnerToaster
      closeButton
      position="bottom-right"
      theme="light"
      toastOptions={{
        className: "app-toast",
        classNames: {
          toast:
            "border border-line bg-white text-ink-900 shadow-popover rounded-xl",
          title: "text-sm font-semibold",
          description: "text-xs text-ink-500",
          actionButton: "bg-brand-700 text-white",
          cancelButton: "bg-surface-subtle text-ink-700",
          closeButton: "border-line bg-white text-ink-500"
        }
      }}
    />
  );
}
