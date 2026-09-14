"use client";

import { useActionState, useState } from "react";
import { flagSubmissionAction, type ActionState } from "../actions";
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
        Tandai fraud
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
          Kirim ke antrean fraud
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}
