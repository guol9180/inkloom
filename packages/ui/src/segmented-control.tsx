import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";
import { cn } from "./lib/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
  itemClassName
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={ariaLabel}
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-surface-subtle p-1",
        className
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "flex min-h-9 items-center justify-center gap-2 rounded-md px-2.5 text-xs font-semibold text-ink-500 outline-none transition hover:text-ink-800 focus-visible:ring-4 focus-visible:ring-brand-200/55 data-[state=on]:bg-white data-[state=on]:text-ink-950 data-[state=on]:shadow-sm",
            itemClassName
          )}
        >
          {option.icon}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
