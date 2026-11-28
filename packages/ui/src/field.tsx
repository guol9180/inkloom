import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode
} from "react";
import { cn } from "./lib/cn";

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm text-ink-950 outline-none transition placeholder:text-ink-500 focus:border-brand-500 focus:ring-4 focus:ring-brand-200/55",
        className
      )}
      {...props}
    />
  );
}

export function FieldLabel({
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label
      className={cn("grid gap-2 text-sm font-semibold text-ink-700", className)}
      {...props}
    >
      {children}
    </label>
  );
}
