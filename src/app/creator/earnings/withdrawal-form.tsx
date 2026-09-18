"use client";

import { useActionState } from "react";
import { requestWithdrawalAction, type ActionState } from "../actions";
import { Callout, SubmitButton } from "@/components/ui";

/**
 * Tombol "Tarik Dana" untuk satu video. Disabled kalau belum capai minimum
 * campaign atau rekening bank belum diisi — pesannya ditampilkan langsung di
 * bawah tombol supaya creator tahu apa yang masih kurang.
 */
export function WithdrawalForm({
  submissionId,
  disabledReason,
}: {
  submissionId: string;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    requestWithdrawalAction,
    {},
  );

  if (state.success) {
    return <Callout tone="success">{state.success}</Callout>;
  }

  return (
    <form action={formAction} className="flex flex-col items-end text-right space-y-1.5">
      <input type="hidden" name="submissionId" value={submissionId} />
      {state.error ? (
        <p className="text-xs font-medium text-danger text-right">{state.error}</p>
      ) : null}
      <SubmitButton
        variant="primary"
        size="sm"
        disabled={Boolean(disabledReason)}
        pendingLabel="Memproses..."
        className="shrink-0"
      >
        Tarik Dana
      </SubmitButton>
      {disabledReason ? (
        <p className="text-xs text-muted text-right max-w-xs">{disabledReason}</p>
      ) : null}
    </form>
  );
}
