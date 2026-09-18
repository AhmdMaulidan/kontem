"use client";

import { useState, useTransition } from "react";
import { requestWithdrawalAction } from "../actions";
import { Button, IconSpinner } from "@/components/ui";
import { triggerWithdrawalModal } from "./withdrawal-modal";

/**
 * Tombol "Tarik Dana" untuk satu video.
 * Saat diklik, memicu server action dan membuka modal notifikasi di level halaman.
 */
export function WithdrawalForm({
  submissionId,
  disabledReason,
}: {
  submissionId: string;
  disabledReason?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const res = await requestWithdrawalAction({}, formData);
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          // Buka modal notifikasi di level halaman (tidak akan ter-unmount)
          triggerWithdrawalModal(res.data);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses penarikan.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="flex flex-col items-end text-right space-y-1.5"
    >
      <input type="hidden" name="submissionId" value={submissionId} />
      {error ? (
        <p className="text-xs font-medium text-danger text-right max-w-xs">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={Boolean(disabledReason) || isPending}
        className="shrink-0 cursor-pointer"
      >
        {isPending ? (
          <>
            <IconSpinner className="h-3.5 w-3.5 animate-spin" />
            <span>Mentransfer...</span>
          </>
        ) : (
          "Tarik Dana"
        )}
      </Button>

      {disabledReason ? (
        <p className="text-xs text-muted text-right max-w-xs">
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}
