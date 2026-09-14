"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton, Textarea } from "@/components/ui";
import { saveCampaignBriefAction, type BriefState } from "../analyzer/actions";

const initialState: BriefState = {};

/**
 * Editor brief bebas-format untuk Automated Analyzer. Sengaja hanya
 * textarea — parsing isi brief adalah kerjaan engine, bukan web.
 */
export function BriefForm({
  campaignId,
  currentBrief,
}: {
  campaignId: string;
  currentBrief: string;
}) {
  const [state, action] = useActionState(saveCampaignBriefAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <Field
        label="Brief (dipakai Automated Analyzer)"
        hint="Satu aturan per baris, bebas format. Engine yang menafsirkannya."
      >
        <Textarea
          name="brief"
          rows={5}
          defaultValue={currentBrief}
          placeholder={"1. Ada kata promo\n2. Ada kata diskon\n3. Durasi minimal 30 detik"}
        />
      </Field>
      <FormError message={state.error} />
      {state.success ? (
        <p className="text-sm font-medium text-success">{state.success}</p>
      ) : null}
      <SubmitButton size="sm" pendingLabel="Menyimpan...">
        Simpan Brief
      </SubmitButton>
    </form>
  );
}
