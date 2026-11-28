import { PenLine } from "lucide-react";
import { cn } from "@inkloom/ui";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-brand-700 shadow-xs",
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
              "block truncate font-display text-[1.0625rem] font-semibold tracking-[-0.02em]",
              inverse ? "text-white" : "text-ink-950"
            )}
          >
            InkLoom
          </strong>
          <span
            className={cn(
              "mt-0.5 block truncate text-[0.68rem] font-medium tracking-[0.08em]",
              inverse ? "text-brand-100/65" : "text-ink-500"
            )}
          >
            Writing studio
          </span>
        </span>
      )}
    </span>
  );
}
