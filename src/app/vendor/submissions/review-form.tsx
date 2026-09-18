"use client";

import { useActionState, useState } from "react";
import {
  flagSubmissionAction,
  reviewSubmissionAction,
  type ActionState,
} from "../actions";
import { SubmitButton } from "@/components/ui";
import {
  Button,
  Callout,
  Field,
  FormError,
  Select,
  Textarea,
} from "@/components/ui";
import { fraudFlagLabel } from "@/lib/labels";

export function ReviewForm({ submissionId }: { submissionId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    reviewSubmissionAction,
    {},
  );
  const [mode, setMode] = useState<"idle" | "reject">("idle");

  if (state.success) {
    return <Callout tone="success">{state.success}</Callout>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <FormError message={state.error} />

      {mode === "reject" ? (
        <>
          <Field
            label="Alasan penolakan"
            hint="Wajib diisi dan tercatat di audit trail. Creator bisa mengajukan banding."
          >
            <Textarea name="note" rows={3} required minLength={10} autoFocus />
          </Field>
          <div className="flex gap-2">
            <SubmitButton
              name="decision"
              value="reject"
              variant="danger"
              pendingLabel="Menolak..."
            >
              Konfirmasi tolak
            </SubmitButton>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode("idle")}
            >
              Batal
            </Button>
          </div>
        </>
      ) : (
        <>
          <Field label="Catatan (opsional)">
            <Textarea name="note" rows={2} placeholder="Sesuai brief, angle bagus." />
          </Field>
          <div className="flex gap-2">
            <SubmitButton
              name="decision"
              value="approve"
              pendingLabel="Menyetujui..."
            >
              Setujui
            </SubmitButton>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode("reject")}
            >
              Tolak
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

export function FlagForm({ submissionId }: { submissionId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    flagSubmissionAction,
    {},
  );
  const [open, setOpen] = useState(false);

  if (state.success) {
    return <Callout tone="warning">{state.success}</Callout>;
  }

  if (!open) {
    return (
      <Button variant="ghost" type="button" onClick={() => setOpen(true)}>
        Laporkan ke admin
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 border-t border-line pt-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      <FormError message={state.error} />
      <Field label="Jenis kecurigaan">
        <Select name="type" defaultValue="REUSED_CONTENT">
          {Object.entries(fraudFlagLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Detail">
        <Textarea name="detail" rows={2} required minLength={10} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton variant="secondary" pendingLabel="Mengirim...">
          Kirim laporan
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}
