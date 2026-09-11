"use client";

import { useActionState } from "react";
import { redeemCodeAction, type ActionState } from "../actions";
import { SubmitButton } from "@/components/ui";
import { Callout, Field, FormError, Input } from "@/components/ui";

export function RedeemForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    redeemCodeAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      {state.success ? <Callout tone="success">{state.success}</Callout> : null}

      <Field
        label="Kode redeem creator"
        hint="Minta creator menunjukkan kode di aplikasinya."
      >
        <Input
          name="code"
          required
          autoFocus
          placeholder="KTM-XXXX-XXXX"
          className="py-3.5 text-center font-mono text-xl font-semibold tracking-[0.18em] uppercase"
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Memeriksa...">
        Tandai terpakai
      </SubmitButton>
    </form>
  );
}
