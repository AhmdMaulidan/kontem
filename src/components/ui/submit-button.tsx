"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

/**
 * Tombol submit yang mengunci dirinya selama server action berjalan.
 * Mencegah double-submit pada aksi yang tidak idempoten (join slot,
 * approve submission, cairkan payout).
 */
export function SubmitButton({
  children,
  pendingLabel = "Memproses...",
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
