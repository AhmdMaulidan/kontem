"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Badge, Input, Select, Field, Textarea, FormError, Td } from "@/components/ui";
import { SubmitButton } from "@/components/ui";
import { saveCampaignRuleAction, type ActionState } from "./actions";

type Meta = { label: string; description: string; paramHints: Record<string, string> } | undefined;

type RuleShape = {
  id: string;
  campaignId: string;
  ruleKey: string;
  label: string;
  type: string;
  enabled: boolean;
  weight: number;
  params: unknown;
  rationale: string | null;
};

export function RuleRow({ rule, meta }: { rule: RuleShape; meta: Meta }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="align-top">
        <Td>
          <div className="font-medium">{rule.label}</div>
          <div className="text-xs text-muted">{rule.ruleKey}</div>
          {meta?.description ? <div className="mt-1 text-xs text-muted">{meta.description}</div> : null}
        </Td>
        <Td>
          <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{rule.type}</code>
        </Td>
        <Td align="right">{rule.weight}</Td>
        <Td align="right">
          <Badge tone={rule.enabled ? "success" : "neutral"} icon>
            {rule.enabled ? "aktif" : "mati"}
          </Badge>
        </Td>
        <Td align="right">
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-brand hover:underline">
            {open ? "Tutup" : "Edit"}
          </button>
        </Td>
      </tr>
      {open ? (
        <tr>
          <Td colSpan={5}>
            <RuleEditForm campaignId={rule.campaignId} rule={rule} onDone={() => setOpen(false)} />
          </Td>
        </tr>
      ) : null}
    </>
  );
}

export function RuleEditForm({
  campaignId,
  rule,
  onDone,
}: {
  campaignId: string;
  rule: RuleShape;
  onDone: () => void;
}) {
  const [state, action] = useFormState(saveCampaignRuleAction, {} as ActionState);
  const paramsStr = JSON.stringify(rule.params ?? {}, null, 2);

  return (
    <form action={action} className="space-y-2 rounded-xl border border-line bg-surface-muted p-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="ruleKey" value={rule.ruleKey} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Label">
          <Input name="label" defaultValue={rule.label} />
        </Field>
        <Field label="Bobot">
          <Input name="weight" type="number" step="0.1" min="0" defaultValue={rule.weight} />
        </Field>
      </div>
      <Field label="Status">
        <Select name="enabled" defaultValue={String(rule.enabled)}>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </Select>
      </Field>
      <Field label="Params (JSON)">
        <Textarea name="params" rows={3} defaultValue={paramsStr} />
      </Field>
      <FormError message={state.error} />
      <div className="flex gap-2">
        <SubmitButton variant="primary" size="sm">
          Simpan
        </SubmitButton>
        <button type="button" onClick={onDone} className="text-sm text-muted hover:underline">
          Batal
        </button>
      </div>
    </form>
  );
}
