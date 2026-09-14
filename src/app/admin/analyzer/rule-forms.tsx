"use client";

import { useFormState } from "react-dom";
import { Input, Select, Field, Textarea, FormError } from "@/components/ui";
import { SubmitButton } from "@/components/ui";
import { saveCampaignRuleAction, seedDefaultRulesAction, type ActionState } from "./actions";

type DetectorType = string;

const init: ActionState = {};

export function AddRuleForm({
  campaignId,
  detectorTypes,
  meta,
}: {
  campaignId: string;
  detectorTypes: readonly DetectorType[];
  meta: Record<string, { label: string; description: string; paramHints: Record<string, string> }>;
}) {
  const [state, action] = useFormState(saveCampaignRuleAction, init);
  const hintExample = JSON.stringify(
    detectorTypes[0] ? defaultParams(detectorTypes[0] as string, meta) : {},
    null,
    2,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Label rule">
          <Input name="label" placeholder="Mis. Ada wajah" required />
        </Field>
        <Field label="Rule key" hint="Unik dalam campaign, mis. face_present">
          <Input name="ruleKey" placeholder="face_present" required />
        </Field>
      </div>

      <Field label="Tipe detector">
        <Select name="type" defaultValue={detectorTypes[0]}>
          {detectorTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bobot (0-100 skor)" hint="0 = dievaluasi tapi tak dihitung.">
          <Input name="weight" type="number" step="0.1" min="0" defaultValue="1" />
        </Field>
        <Field label="Aktif?" hint="Centang untuk masuk ke laporan.">
          <Select name="enabled" defaultValue="true">
            <option value="true">Ya</option>
            <option value="false">Tidak</option>
          </Select>
        </Field>
      </div>

      <Field
        label="Params (JSON)"
        hint={`Contoh untuk ${detectorTypes[0]}: ${hintExample.replace(/\n/g, " ")}`}
      >
        <Textarea name="params" rows={3} defaultValue={hintExample} />
      </Field>

      <FormError message={state.error} />
      {state.success ? (
        <p className="rounded-2xl border border-success-line bg-success-soft px-4 py-3 text-sm font-medium text-success">
          {state.success}
        </p>
      ) : null}

      <SubmitButton variant="primary" size="sm">
        Tambah rule
      </SubmitButton>
    </form>
  );
}

function defaultParams(type: string, meta: Record<string, { paramHints: Record<string, string> }>): Record<string, unknown> {
  const hints = meta[type]?.paramHints ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(hints)) {
    if (k.includes("min") || k === "value" || k === "weight") out[k] = 1;
    else if (v.startsWith("array")) out[k] = [];
    else if (v.startsWith("true") || v.startsWith("false") || v === "wajib ada?") out[k] = true;
    else out[k] = "";
  }
  return out;
}

export function SeedRulesForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useFormState(seedDefaultRulesAction, init);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <FormError message={state.error} />
      {state.success ? (
        <p className="text-sm font-medium text-success">{state.success}</p>
      ) : null}
      <SubmitButton variant="secondary" size="sm">
        Seed 14 rule GSTMC default
      </SubmitButton>
    </form>
  );
}
