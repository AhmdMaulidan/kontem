"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui";
import { Button, Callout, Field, FormError, Textarea } from "@/components/ui";

type ActionState = { error?: string; success?: string };
type ServerAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Pola keputusan admin yang dipakai berulang: setujui langsung, atau tolak
 * dengan alasan yang wajib diisi. Alasan selalu masuk audit trail.
 */
export function DecisionForm({
  action,
  hiddenField,
  hiddenValue,
  approveLabel,
  rejectLabel,
  approveValue = "approve",
  rejectValue = "reject",
  noteLabel = "Alasan penolakan",
  noteHint = "Wajib diisi, dikirim ke pihak terkait dan tercatat di audit trail.",
  requireNoteOnApprove = false,
}: {
  action: ServerAction;
  hiddenField: string;
  hiddenValue: string;
  approveLabel: string;
  rejectLabel: string;
  approveValue?: string;
  rejectValue?: string;
  noteLabel?: string;
  noteHint?: string;
  requireNoteOnApprove?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [mode, setMode] = useState<"idle" | "reject">("idle");

  if (state.success) {
    return <Callout tone="success">{state.success}</Callout>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name={hiddenField} value={hiddenValue} />
      <FormError message={state.error} />

      {mode === "reject" ? (
        <>
          <Field label={noteLabel} hint={noteHint}>
            <Textarea name="note" rows={3} required minLength={10} autoFocus />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value={rejectValue} variant="danger">
              Konfirmasi {rejectLabel.toLowerCase()}
            </SubmitButton>
            <Button type="button" variant="secondary" onClick={() => setMode("idle")}>
              Batal
            </Button>
          </div>
        </>
      ) : (
        <>
          {requireNoteOnApprove ? (
            <Field label="Catatan" hint="Ikut tersimpan di riwayat verifikasi.">
              <Textarea name="note" rows={2} />
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value={approveValue}>
              {approveLabel}
            </SubmitButton>
            <Button type="button" variant="secondary" onClick={() => setMode("reject")}>
              {rejectLabel}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

/** Tombol aksi tunggal tanpa alasan, mis. konfirmasi deposit / cairkan payout. */
export function SimpleActionForm({
  action,
  hiddenField,
  hiddenValue,
  label,
  pendingLabel,
  variant = "primary",
}: {
  action: ServerAction;
  hiddenField: string;
  hiddenValue: string;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name={hiddenField} value={hiddenValue} />
      <FormError message={state.error} />
      {state.success ? <Callout tone="success">{state.success}</Callout> : null}
      {!state.success ? (
        <SubmitButton variant={variant} pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
      ) : null}
    </form>
  );
}
