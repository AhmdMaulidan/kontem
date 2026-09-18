"use client";

import { useState, useActionState } from "react";
import {
  joinCampaignAction,
  submitContentAction,
  type ActionState,
} from "../../actions";
import { SubmitButton } from "@/components/ui";
import { Callout, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { platformLabel } from "@/lib/labels";
import type { SocialPlatform } from "@/generated/prisma/enums";

export function JoinForm({
  campaignId,
  disabled,
  disabledReason,
}: {
  campaignId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    joinCampaignAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <FormError message={state.error} />
      <SubmitButton
        className="w-full"
        disabled={disabled}
        pendingLabel="Memproses slot..."
      >
        Klaim slot campaign
      </SubmitButton>
      {disabledReason ? (
        <p className="text-xs text-muted">{disabledReason}</p>
      ) : null}
    </form>
  );
}

export function SubmitContentForm({
  campaignId,
  allowedPlatforms,
  locked = false,
  lockedReason,
  registeredAccounts = [],
}: {
  campaignId: string;
  allowedPlatforms: SocialPlatform[];
  locked?: boolean;
  lockedReason?: string;
  registeredAccounts?: Array<{ platform: SocialPlatform; handle: string }>;
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>(
    allowedPlatforms[0],
  );
  const [state, formAction] = useActionState<ActionState, FormData>(
    submitContentAction,
    {},
  );

  if (locked) {
    return <Callout tone="warning">{lockedReason}</Callout>;
  }

  const currentAccount = registeredAccounts.find(
    (a) => a.platform === selectedPlatform,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="campaignId" value={campaignId} />
      <FormError message={state.error} />
      {state.success ? <Callout tone="success">{state.success}</Callout> : null}

      <Field label="Platform">
        <Select
          name="platform"
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value as SocialPlatform)}
        >
          {allowedPlatforms.map((platform) => (
            <option key={platform} value={platform}>
              {platformLabel[platform]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Link konten"
        hint={
          currentAccount
            ? `Akun ${platformLabel[selectedPlatform]} terdaftarmu: @${currentAccount.handle}. Pastikan video berasal dari akun ini.`
            : `Kamu belum menautkan akun ${platformLabel[selectedPlatform]} di profil.`
        }
      >
        <Input
          name="contentUrl"
          type="url"
          required
          placeholder={
            currentAccount
              ? `https://${selectedPlatform === "YOUTUBE" ? "youtube" : selectedPlatform === "TIKTOK" ? "tiktok" : "instagram"}.com/@${currentAccount.handle}/...`
              : "https://tiktok.com/@akunmu/video/..."
          }
        />
      </Field>

      <Field label="Caption (opsional)">
        <Textarea name="caption" rows={2} />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Mengirim...">
        Kirim konten
      </SubmitButton>
    </form>
  );
}
