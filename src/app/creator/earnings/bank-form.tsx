"use client";

import { useActionState } from "react";
import { updateBankAction, type ActionState } from "../actions";
import { SubmitButton } from "@/components/ui";
import { Callout, Field, FormError, Input } from "@/components/ui";

export function BankForm({
  defaultValues,
}: {
  defaultValues: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  };
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateBankAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      {state.success ? <Callout tone="success">{state.success}</Callout> : null}

      <Field label="Nama bank">
        <Input name="bankName" defaultValue={defaultValues.bankName} required />
      </Field>
      <Field label="Nomor rekening">
        <Input
          name="bankAccountNumber"
          defaultValue={defaultValues.bankAccountNumber}
          required
        />
      </Field>
      <Field label="Atas nama">
        <Input
          name="bankAccountName"
          defaultValue={defaultValues.bankAccountName}
          required
        />
      </Field>
      <SubmitButton variant="secondary" className="w-full">
        Simpan rekening
      </SubmitButton>
    </form>
  );
}
