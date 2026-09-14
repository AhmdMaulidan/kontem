import { Callout, DetailDrawer, IconEye } from "@/components/ui";
import { AppealForm } from "./appeal-form";

type NoteCellProps = {
  submissionId: string;
  campaignTitle: string;
  disputeReason: string | null;
  reviewNote: string | null;
  reviewNoteTone: "success" | "danger";
  showAppealForm: boolean;
};

/**
 * Catatan reviewer/banding dibuka lewat tombol mata sebagai panel di tengah
 * halaman (bukan disisipkan ke dalam sel tabel) — teksnya bisa panjang dan
 * baris tabel tidak boleh melar karenanya.
 */
export function NoteCell({
  submissionId,
  campaignTitle,
  disputeReason,
  reviewNote,
  reviewNoteTone,
  showAppealForm,
}: NoteCellProps) {
  const hasContent = Boolean(disputeReason || reviewNote || showAppealForm);

  if (!hasContent) {
    return <span className="text-xs text-muted">—</span>;
  }

  return (
    <div className="flex items-center justify-center">
      <DetailDrawer
        label="Lihat catatan"
        title="Catatan reviewer"
        subtitle={campaignTitle}
        trigger="link"
        icon={<IconEye className="h-4 w-4" strokeWidth={2} />}
      >
      {disputeReason ? (
        <Callout tone="warning" title="Banding diproses">
          {disputeReason}
        </Callout>
      ) : (
        <>
          {reviewNote ? (
            <Callout tone={reviewNoteTone} title="Catatan reviewer">
              {reviewNote}
            </Callout>
          ) : null}

          {showAppealForm ? (
            <div className="rounded-xl bg-surface-muted p-3">
              <p className="mb-2 text-[11px] text-muted">
                Jelaskan bagian konten yang sudah memenuhi brief.
              </p>
              <AppealForm submissionId={submissionId} />
            </div>
          ) : null}
        </>
      )}
      </DetailDrawer>
    </div>
  );
}
