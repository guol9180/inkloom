import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "./lib/cn";

export function AppProgress({
  value,
  label,
  className
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      aria-label={label}
      className={cn(
        "relative block h-1 overflow-hidden rounded-full bg-line-soft",
        className
      )}
    >
      <ProgressPrimitive.Indicator
        className="block h-full rounded-full bg-brand-500 transition-transform duration-200"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
