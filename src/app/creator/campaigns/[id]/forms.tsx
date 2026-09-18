"use client";

import { useState, useActionState } from "react";
import { submitContentAction, type ActionState } from "../../actions";
import { SubmitButton } from "@/components/ui";
import { Callout, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { platformLabel } from "@/lib/labels";
import type { SocialPlatform } from "@/generated/prisma/enums";

export function SubmitContentForm({
  campaignId,
  allowedPlatforms,
  disabled = false,
  disabledReason,
  registeredAccounts = [],
}: {
  campaignId: string;
  allowedPlatforms: SocialPlatform[];
  disabled?: boolean;
  disabledReason?: string;
  registeredAccounts?: Array<{ platform: SocialPlatform; handle: string }>;
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>(
    allowedPlatforms[0],
  );
  const [state, formAction] = useActionState<ActionState, FormData>(
    submitContentAction,
    {},
  );

  if (disabled) {
    return <Callout tone="warning">{disabledReason}</Callout>;
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
