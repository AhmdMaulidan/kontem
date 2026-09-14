"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui";
import {
  Button,
  Callout,
  Field,
  FormError,
  Select,
  Textarea,
} from "@/components/ui";

type ActionState = { error?: string; success?: string };
type ServerAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Pola keputusan admin yang dipakai berulang: setujui, atau tolak dengan
 * alasan yang wajib diisi. Alasan selalu masuk audit trail.
 *
 * Keputusannya satu dropdown (bukan dua tombol terpisah), diikuti "Batal"
 * di kiri dan "Simpan" di kanan — supaya bentuknya sama dengan form lain di
 * dasbor, bukan alur dua langkah tersendiri.
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
  const [decision, setDecision] = useState(approveValue);
  const isReject = decision === rejectValue;

  if (state.success) {
    return <Callout tone="success">{state.success}</Callout>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name={hiddenField} value={hiddenValue} />
      <FormError message={state.error} />

      <Field label="Keputusan">
        <Select
          name="decision"
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
        >
          <option value={approveValue}>{approveLabel}</option>
          <option value={rejectValue}>{rejectLabel}</option>
        </Select>
      </Field>

      {isReject ? (
        <Field label={noteLabel} hint={noteHint}>
          <Textarea name="note" rows={3} required minLength={10} />
        </Field>
      ) : requireNoteOnApprove ? (
        <Field label="Catatan" hint="Ikut tersimpan di riwayat verifikasi.">
          <Textarea name="note" rows={2} />
        </Field>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDecision(approveValue)}
        >
          Batal
        </Button>
        <SubmitButton variant={isReject ? "danger" : "primary"}>
          Simpan
        </SubmitButton>
      </div>
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
  size = "md",
  icon,
}: {
  action: ServerAction;
  hiddenField: string;
  hiddenValue: string;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "compact";
  icon?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className={icon ? "" : "space-y-2"}>
      <input type="hidden" name={hiddenField} value={hiddenValue} />
      {icon ? null : <FormError message={state.error} />}
      {!icon && state.success ? <Callout tone="success">{state.success}</Callout> : null}
      {!state.success ? (
        <SubmitButton
          variant={variant}
          size={size}
          pendingLabel={pendingLabel}
          title={icon ? label : undefined}
          className={icon ? "text-brand-600 hover:text-brand-700 transition-colors" : undefined}
        >
          {icon || label}
        </SubmitButton>
      ) : null}
    </form>
  );
}
