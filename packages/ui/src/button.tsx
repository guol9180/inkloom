import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold outline-none transition-[background-color,color,border-color,box-shadow,transform] duration-150 focus-visible:ring-4 focus-visible:ring-brand-300/45 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "border border-brand-700 bg-brand-700 px-4 text-white shadow-[0_7px_18px_rgb(36_82_62_/_0.18)] hover:bg-brand-800",
        secondary:
          "border border-line bg-white px-4 text-ink-800 shadow-xs hover:border-brand-300 hover:bg-brand-50",
        quiet:
          "border border-transparent bg-transparent px-3 text-ink-600 hover:bg-brand-50 hover:text-ink-950",
        danger:
          "border border-danger-700 bg-danger-700 px-4 text-white hover:bg-danger-800",
        "danger-quiet":
          "border border-danger-200 bg-danger-50 px-3 text-danger-700 hover:bg-danger-100"
      },
      size: {
        sm: "min-h-9 rounded-lg px-3 text-xs",
        md: "",
        icon: "size-10 min-h-10 p-0"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "md"
    }
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export function IconButton({
  className,
  variant = "quiet",
  ...props
}: ButtonProps) {
  return (
    <Button
      variant={variant}
      size="icon"
      className={cn("shrink-0 rounded-xl", className)}
      {...props}
    />
  );
}
