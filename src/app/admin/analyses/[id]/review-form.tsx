"use client";

import { useActionState } from "react";
import { Button, FormError, SubmitButton } from "@/components/ui";
import { setHumanDecisionAction, type DecisionState } from "../../analyzer/actions";

const initialState: DecisionState = {};

/**
 * Tombol review manual — hanya muncul kalau verdict "perlu_verifikasi"
 * atau status FAILED. Keputusan disimpan ke field humanDecision, tidak
 * pernah menimpa verdict asli dari engine.
 */
export function ReviewForm({
  analysisId,
  decided,
}: {
  analysisId: string;
  decided: boolean;
}) {
  const [state, action] = useActionState(setHumanDecisionAction, initialState);

  if (decided) {
    return (
      <p className="text-sm text-muted">
        Keputusan admin sudah disimpan untuk analisis ini.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="analysisId" value={analysisId} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="decision" value="diterima">
          Terima
        </SubmitButton>
        <Button type="submit" name="decision" value="ditolak" variant="danger">
          Tolak
        </Button>
      </div>
      <FormError message={state.error} />
      {state.success ? (
        <p className="text-sm font-medium text-success">{state.success}</p>
      ) : null}
    </form>
  );
}
