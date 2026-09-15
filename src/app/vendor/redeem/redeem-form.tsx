"use client";

import { useActionState, useRef } from "react";
import { verifyRedeemCodeAction } from "../actions";
import {
  Callout,
  Field,
  FormError,
  Input,
  SubmitButton,
} from "@/components/ui";
import type { ActionState } from "../actions";

export function RedeemForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    verifyRedeemCodeAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        if (state.success) {
          formRef.current?.reset();
        }
      }}
      className="space-y-4"
    >
      <FormError message={state.error} />
      {state.success ? (
        <Callout tone="success" title="Berhasil">
          {state.success}
        </Callout>
      ) : null}

      <Field
        label="Kode Redeem Creator"
        hint="Contoh: KTM-7H4Q-B2XP (huruf kapital otomatis)."
      >
        <div className="flex gap-2">
          <Input
            name="code"
            required
            autoFocus
            autoComplete="off"
            placeholder="KTM-XXXX-XXXX"
            className="font-mono text-base tracking-wider uppercase"
          />
          <SubmitButton pendingLabel="Memverifikasi...">
            Verifikasi
          </SubmitButton>
        </div>
      </Field>
    </form>
  );
}
