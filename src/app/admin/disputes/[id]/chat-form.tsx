"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendDisputeMessageAction, type ActionState } from "@/app/_actions/dispute";
import { Callout, Field, FormError, SubmitButton, Textarea } from "@/components/ui";

export function DisputeChatForm({ disputeId }: { disputeId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    sendDisputeMessageAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="disputeId" value={disputeId} />
      <FormError message={state.error} />
      {state.success ? <Callout tone="success">{state.success}</Callout> : null}

      <Field label="Kirim pesan / klarifikasi baru">
        <Textarea
          name="message"
          rows={3}
          required
          placeholder="Tulis tanggapan atau bukti klarifikasi terkait sengketa ini..."
        />
      </Field>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Mengirim pesan...">Kirim tanggapan</SubmitButton>
      </div>
    </form>
  );
}
