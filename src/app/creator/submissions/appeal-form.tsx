"use client";

import { useActionState } from "react";
import { appealAction, type ActionState } from "../actions";
import { SubmitButton } from "@/components/ui";
import { Callout, FormError, Textarea } from "@/components/ui";

export function AppealForm({ submissionId }: { submissionId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    appealAction,
    {},
  );

  if (state.success) {
    return <Callout tone="success">{state.success}</Callout>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <FormError message={state.error} />
      <Textarea
        name="reason"
        rows={3}
        required
        minLength={20}
        placeholder="Contoh: Menu signature muncul di detik 00:14-00:19 lengkap dengan penyebutan nama menu."
      />
      <SubmitButton variant="secondary" pendingLabel="Mengirim banding...">
        Ajukan banding
      </SubmitButton>
    </form>
  );
}
