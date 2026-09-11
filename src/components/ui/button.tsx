import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./utils";

// Pill style sesuai design.md bagian 6.1.
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

export const buttonVariants = {
  primary:
    "bg-brand text-white shadow-brand hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98]",
  secondary:
    "bg-surface text-body border border-line shadow-card hover:bg-surface-muted hover:border-line-brand",
  accent:
    "bg-accent text-white shadow-[0_4px_14px_-4px_rgba(245,158,11,0.4)] hover:bg-accent-600 hover:scale-[1.02] active:scale-[0.98]",
  danger:
    "bg-danger text-white hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]",
  ghost: "text-muted hover:bg-brand-soft hover:text-brand-600",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cn(buttonBase, buttonVariants[variant], className)}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      {...props}
      className={cn(buttonBase, buttonVariants[variant], className)}
    />
  );
}
