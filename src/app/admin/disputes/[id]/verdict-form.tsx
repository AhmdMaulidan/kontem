"use client";

import { useActionState } from "react";
import {
  Callout,
  Field,
  FormError,
  IconCheck,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import { resolveDisputeAction, type ActionState } from "../../actions";

/**
 * Putusan sengketa dipilih lewat radio, bukan dua tombol berdampingan.
 *
 * Keputusannya final dan mengikat kedua pihak: memilih dulu lalu menekan satu
 * tombol simpan memberi jeda untuk berpikir, sedangkan dua tombol aksi membuat
 * putusan sejauh ini hanya berjarak satu klik salah sasaran.
 */
export function VerdictForm({ disputeId }: { disputeId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    resolveDisputeAction,
    {},
  );

  if (state.success) {
    return <Callout tone="success">{state.success}</Callout>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="disputeId" value={disputeId} />
      <FormError message={state.error} />

      <fieldset className="space-y-2">
        <legend className="sr-only">Putusan</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-line-brand">
          <input
            type="radio"
            name="decision"
            value="overturn"
            required
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium">Menangkan creator</span>
            <span className="mt-0.5 block text-muted">
              Submission disetujui dan kembali ikut hitungan payout.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-line-brand">
          <input type="radio" name="decision" value="uphold" className="mt-1" />
          <span className="text-sm">
            <span className="font-medium">Kuatkan penolakan vendor</span>
            <span className="mt-0.5 block text-muted">
              Penolakan final, submission tidak dibayar, trust score creator turun.
            </span>
          </span>
        </label>
      </fieldset>

      <Field
        label="Alasan putusan"
        hint="Minimal 20 karakter. Dikirim ke kedua pihak dan tercatat permanen."
      >
        {/* Nama fieldnya `resolution`, bukan `note` — itu yang dibaca
            resolveDisputeAction. DecisionForm memakai `note`, sehingga
            putusan sengketa lewat form itu selalu ditolak validasi. */}
        <Textarea name="resolution" rows={4} required minLength={20} />
      </Field>

      <SubmitButton pendingLabel="Menyimpan..." title="Simpan putusan">
        <IconCheck className="h-4 w-4" strokeWidth={2} />
      </SubmitButton>
    </form>
  );
}
