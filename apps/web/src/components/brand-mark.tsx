import { PenLine } from "lucide-react";
import { cn } from "../lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-9 shrink-0 place-items-center rounded-[0.9rem] border border-brand-200 bg-brand-50 text-brand-700 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9)]",
        className
      )}
      aria-hidden="true"
    >
      <PenLine size={18} strokeWidth={2.1} />
    </span>
  );
}

export function BrandLockup({
  compact = false,
  inverse = false
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      {!compact && (
        <span className="min-w-0 leading-none">
          <strong
            className={cn(
              "block truncate font-display text-[1.0625rem] font-semibold tracking-[-0.025em]",
              inverse ? "text-white" : "text-ink-950"
            )}
          >
            InkLoom
          </strong>
          <span
            className={cn(
              "mt-1 block truncate text-[0.64rem] font-semibold tracking-[0.16em] uppercase",
              inverse ? "text-brand-100/65" : "text-ink-400"
            )}
          >
            writing studio
          </span>
        </span>
      )}
    </span>
  );
}
