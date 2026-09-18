"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  IconAlert,
  IconTrash,
  IconX,
} from "@/components/ui";
import { deleteCampaignAction } from "../../actions";

export function DeleteCampaignCard({
  campaignId,
  campaignTitle,
}: {
  campaignId: string;
  campaignTitle: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const handleDelete = () => {
    setError(null);
    startDelete(async () => {
      const formData = new FormData();
      formData.append("campaignId", campaignId);
      const res = await deleteCampaignAction({}, formData);
      // Aksi yang berhasil langsung redirect dari server; kalau kode ini
      // sempat jalan berarti ada error yang dikembalikan, bukan redirect.
      if (res?.error) setError(res.error);
    });
  };

  return (
    <>
      <Card className="border-danger/30">
        <CardHeader
          title="Zona berbahaya"
          description="Campaign ini belum disetujui admin, jadi masih bisa dihapus."
        />
        <Button
          type="button"
          variant="danger"
          size="sm"
          shape="block"
          onClick={() => {
            setError(null);
            setShowModal(true);
          }}
        >
          <IconTrash className="h-4 w-4" />
          Hapus Campaign
        </Button>
      </Card>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => !isDeleting && setShowModal(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi Hapus Campaign"
            className="relative flex w-[460px] max-w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-danger/10 text-danger">
                  <IconAlert className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-foreground">
                    Hapus Campaign
                  </h2>
                  <p className="text-xs text-muted">
                    Tindakan ini tidak dapat dibatalkan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isDeleting}
                aria-label="Tutup"
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
              >
                <IconX className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-4 px-5 py-5 text-sm">
              {error && <Callout tone="danger">{error}</Callout>}

              <p className="text-body leading-relaxed">
                Apakah kamu yakin ingin menghapus campaign{" "}
                <strong className="font-semibold text-foreground">
                  {campaignTitle}
                </strong>
                ? Seluruh data brief dan pengaturannya akan hilang permanen.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowModal(false)}
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
                  {isDeleting ? "Menghapus..." : "Ya, Hapus Campaign"}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
