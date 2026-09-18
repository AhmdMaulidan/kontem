"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Button,
  Callout,
  IconEye,
  IconMore,
  IconRefresh,
  IconTrash,
  IconX,
  cn,
} from "@/components/ui";
import { isWithinCooldown } from "@/domain/views";
import { AppealForm } from "./appeal-form";
import {
  deleteSubmissionAction,
  refreshCreatorSubmissionViewsAction,
} from "../actions";

interface DisputeData {
  id: string;
  reason: string;
  status: string;
}

export function SubmissionActionMenu({
  submissionId,
  campaignTitle,
  contentUrl,
  status,
  reviewNote,
  dispute,
  canDelete,
  deleteDisabledReason,
}: {
  submissionId: string;
  campaignTitle: string;
  contentUrl: string;
  status: string;
  reviewNote?: string | null;
  dispute?: DisputeData | null;
  canDelete: boolean;
  deleteDisabledReason?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleRefresh = () => {
    setMenuOpen(false);
    setFeedback(null);
    startRefresh(async () => {
      const formData = new FormData();
      formData.append("submissionId", submissionId);
      const res = await refreshCreatorSubmissionViewsAction({}, formData);
      if (res?.error) {
        setFeedback({ type: "error", message: res.error });
      } else if (res?.success) {
        setFeedback({ type: "success", message: res.success });
      }
    });
  };

  const handleDelete = () => {
    setDeleteError(null);
    startDelete(async () => {
      const formData = new FormData();
      formData.append("submissionId", submissionId);
      const res = await deleteSubmissionAction({}, formData);
      if (res?.error) {
        setDeleteError(res.error);
      } else {
        setShowDeleteModal(false);
      }
    });
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-body transition-colors hover:border-brand/50 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
        aria-expanded={menuOpen}
        aria-haspopup="true"
        title="Opsi aksi submission"
      >
        <span>Aksi</span>
        <IconMore className="h-3.5 w-3.5 text-muted" />
      </button>

      {/* Floating feedback toast */}
      {feedback && (
        <div
          role="status"
          className={cn(
            "absolute right-0 top-full z-50 mt-1.5 min-w-[220px] max-w-xs rounded-xl p-2.5 text-xs shadow-float border backdrop-blur-sm",
            feedback.type === "error"
              ? "border-danger/30 bg-surface text-danger"
              : "border-emerald-500/30 bg-surface text-emerald-700",
          )}
        >
          {feedback.message}
        </div>
      )}

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-48 origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-float focus:outline-none"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setShowNotesModal(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-body transition-colors hover:bg-surface-muted hover:text-brand"
          >
            <IconEye className="h-4 w-4 text-muted" />
            <span>Lihat Catatan</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-body transition-colors hover:bg-surface-muted hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconRefresh
              className={cn(
                "h-4 w-4 text-muted",
                isRefreshing && "animate-spin text-brand",
              )}
            />
            <span>{isRefreshing ? "Menyegarkan..." : "Segarkan Views"}</span>
          </button>

          <div className="my-1 border-t border-line" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (!canDelete) return;
              setMenuOpen(false);
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            disabled={!canDelete}
            title={!canDelete ? deleteDisabledReason : "Hapus submission"}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors",
              canDelete
                ? "text-danger hover:bg-danger/10 hover:text-danger-strong"
                : "cursor-not-allowed text-muted/40",
            )}
          >
            <IconTrash className="h-4 w-4" />
            <span>Hapus Submission</span>
          </button>
        </div>
      )}

      {/* Modal Lihat Catatan / Banding */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setShowNotesModal(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Catatan reviewer"
            className="relative flex max-h-[85vh] w-[480px] max-w-full flex-col overflow-y-auto rounded-3xl bg-surface shadow-float"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-3xl border-b border-line bg-surface px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold">
                  Catatan reviewer
                </h2>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {campaignTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                aria-label="Tutup panel"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <IconX className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-5 px-5 py-5">
              {dispute ? (
                <Callout tone="warning" title="Banding diproses">
                  {dispute.reason}
                </Callout>
              ) : null}

              {reviewNote ? (
                <Callout
                  tone={
                    status === "APPROVED" || status === "ADMIN_APPROVED"
                      ? "success"
                      : "danger"
                  }
                  title="Catatan reviewer"
                >
                  {reviewNote}
                </Callout>
              ) : null}

              {status === "REJECTED" && !dispute ? (
                <div className="rounded-xl bg-surface-muted p-3">
                  <p className="mb-2 text-xs text-muted">
                    Jelaskan bagian konten yang sudah memenuhi brief.
                  </p>
                  <AppealForm submissionId={submissionId} />
                </div>
              ) : null}

              {!reviewNote && !dispute && status !== "REJECTED" ? (
                <p className="text-sm text-muted">
                  Belum ada catatan dari reviewer.
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Submission */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi Hapus Submission"
            className="relative flex w-[460px] max-w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-danger/10 text-danger">
                  <IconTrash className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-foreground">
                    Hapus Submission
                  </h2>
                  <p className="text-xs text-muted">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                aria-label="Tutup"
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
              >
                <IconX className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-4 px-5 py-5 text-sm">
              {deleteError && <Callout tone="danger">{deleteError}</Callout>}

              <p className="text-body leading-relaxed">
                Apakah kamu yakin ingin menghapus submission untuk campaign{" "}
                <strong className="font-semibold text-foreground">
                  {campaignTitle}
                </strong>
                ?
              </p>

              <div className="rounded-xl border border-line bg-surface-muted p-3 text-xs text-muted">
                <p className="font-mono truncate">{contentUrl}</p>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Data views dan riwayat review konten ini akan dihapus. Jika campaign masih aktif, kamu dapat mengirimkan ulang link konten baru.
              </p>

              <div className="mt-4 flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Menghapus..." : "Ya, Hapus Submission"}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/**
 * Tombol cepat untuk memperbarui views langsung di kolom Views tabel submission.
 */
export function RefreshViewsButton({
  submissionId,
  lastSyncedAt,
}: {
  submissionId: string;
  lastSyncedAt?: Date | string | null;
}) {
  const [isRefreshing, startRefresh] = useTransition();
  const [feedback, setFeedback] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFeedback(null);
    startRefresh(async () => {
      const formData = new FormData();
      formData.append("submissionId", submissionId);
      const res = await refreshCreatorSubmissionViewsAction({}, formData);
      if (res?.error) {
        setFeedback({ text: res.error, isError: true });
      } else if (res?.success) {
        setFeedback({ text: res.success, isError: false });
      }
    });
  };

  const inCooldown = isWithinCooldown(lastSyncedAt);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        title={
          inCooldown
            ? "Views baru saja diperbarui (cooldown 5 menit)"
            : "Segarkan views konten ini sekarang"
        }
        className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconRefresh
          className={cn(
            "h-3.5 w-3.5",
            isRefreshing && "animate-spin text-brand",
          )}
          strokeWidth={2}
        />
        <span className="sr-only">Segarkan views</span>
      </button>

      {feedback && (
        <div
          role="status"
          className={cn(
            "absolute right-0 top-full z-40 mt-1 min-w-[220px] max-w-xs rounded-xl p-2 text-xs shadow-float border backdrop-blur-sm",
            feedback.isError
              ? "border-danger/30 bg-surface text-danger"
              : "border-emerald-500/30 bg-surface text-emerald-700",
          )}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
