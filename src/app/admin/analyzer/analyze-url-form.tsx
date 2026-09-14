"use client";

import { useFormState } from "react-dom";
import { Input, Select, Field, FormError } from "@/components/ui";
import { SubmitButton } from "@/components/ui";
import { analyzeUrlAction, type ActionState } from "./actions";

type CampaignOption = { id: string; title: string };

const initial: ActionState = {};

export function AnalyzeUrlForm({ campaigns }: { campaigns: CampaignOption[] }) {
  const [state, formAction] = useFormState(analyzeUrlAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="URL video (TikTok / Instagram / YouTube)">
          <Input name="url" placeholder="https://..." required />
        </Field>
        <Field label="Campaign (penentu rule set)" hint="Rule diambil dari campaign ini.">
          <Select name="campaignId" defaultValue="">
            <option value="">— tanpa campaign (perlu rule) —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Caption / teks tambahan" hint="Opsional, dibantu detektor teks.">
          <Input name="caption" placeholder="caption video..." />
        </Field>
        <Field label="Platform">
          <Select name="platform" defaultValue="auto">
            <option value="auto">Auto</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
          </Select>
        </Field>
      </div>

      <FormError message={state.error} />
      {state.success ? (
        <p className="rounded-2xl border border-success-line bg-success-soft px-4 py-3 text-sm font-medium text-success">
          {state.success}
        </p>
      ) : null}

      <SubmitButton variant="primary" pendingLabel="Menganalisis...">
        Jalankan analisis otomatis
      </SubmitButton>
    </form>
  );
}
