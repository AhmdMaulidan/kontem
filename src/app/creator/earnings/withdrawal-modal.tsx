"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { WithdrawalResultData } from "../actions";
import {
  IconCheck,
  IconX,
  IconBank,
  IconCard,
} from "@/components/ui";
import { formatIDR } from "@/lib/format";

export const WITHDRAWAL_MODAL_STORAGE_KEY = "kontem_pending_withdrawal_modal";

export function triggerWithdrawalModal(data: WithdrawalResultData) {
  try {
    sessionStorage.setItem(WITHDRAWAL_MODAL_STORAGE_KEY, JSON.stringify(data));
  } catch {}
  window.dispatchEvent(
    new CustomEvent("kontem:withdrawal-success", { detail: data }),
  );
}

/**
 * Modal notifikasi sukses penarikan dana di level halaman.
 * Diletakkan di luar daftar video agar TIDAK ikut ter-unmount saat video
 * selesai ditarik dan dipindahkan Next.js dari daftar 'Video yang bisa ditarik'.
 * Modal ini HANYA ditutup ketika user mengklik tombol close / selesai (bukan klik backdrop).
 */
export function WithdrawalSuccessModal() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [modalData, setModalData] = useState<WithdrawalResultData | null>(null);

  useEffect(() => {
    setMounted(true);

    // Cek apakah ada data modal yang belum ditutup
    try {
      const saved = sessionStorage.getItem(WITHDRAWAL_MODAL_STORAGE_KEY);
      if (saved) {
        setModalData(JSON.parse(saved));
      }
    } catch {}

    function handleEvent(e: Event) {
      const customEvent = e as CustomEvent<WithdrawalResultData>;
      if (customEvent.detail) {
        setModalData(customEvent.detail);
      }
    }

    window.addEventListener("kontem:withdrawal-success", handleEvent);
    return () => {
      window.removeEventListener("kontem:withdrawal-success", handleEvent);
    };
  }, []);

  function handleClose() {
    try {
      sessionStorage.removeItem(WITHDRAWAL_MODAL_STORAGE_KEY);
    } catch {}
    setModalData(null);
    router.refresh();
  }

  if (!mounted || !modalData) return null;

  const modalElement = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      aria-labelledby="modal-withdrawal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop gelap dengan blur — TIDAK menutup modal saat diklik */}
      <div
        className="fixed inset-0 bg-foreground/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        aria-hidden
      />

      {/* Kotak Dialog Modal */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-surface border border-line p-6 sm:p-7 shadow-float text-center animate-in zoom-in-95 duration-200">
        {/* Tombol Tutup Silang (Close Button) */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Tutup modal"
          className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <IconX className="h-4 w-4" />
        </button>

        {/* Icon Sukses dengan Efek Ring */}
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 ring-8 ring-emerald-50 dark:ring-emerald-950/30">
          <IconCheck className="h-8 w-8 stroke-[2.5]" />
        </div>

        {/* Judul & Deskripsi */}
        <h3
          id="modal-withdrawal-title"
          className="font-display text-xl font-bold text-foreground"
        >
          Dana Berhasil Ditarik!
        </h3>
        <p className="mt-1.5 text-xs sm:text-sm text-muted">
          Dana dari campaign{" "}
          <span className="font-semibold text-foreground">
            &ldquo;{modalData.campaignTitle}&rdquo;
          </span>{" "}
          telah berhasil dicairkan dan otomatis masuk ke rekening Anda.
        </p>

        {/* Kartu Rincian Transfer */}
        <div className="mt-5 rounded-2xl bg-surface-muted/80 p-4 border border-line/70 text-left">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <span className="text-xs text-muted font-medium">
              Nominal Masuk Rekening
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular">
              {formatIDR(modalData.netAmount)}
            </span>
          </div>

          {/* Rincian Rekening Bank */}
          <div className="mt-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted flex items-center gap-1.5">
                <IconBank className="h-3.5 w-3.5 text-muted" /> Bank Tujuan
              </span>
              <span className="font-semibold text-foreground uppercase tracking-wide">
                {modalData.bankName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted flex items-center gap-1.5">
                <IconCard className="h-3.5 w-3.5 text-muted" /> Nomor Rekening
              </span>
              <span className="font-semibold text-foreground tabular tracking-wider">
                {modalData.bankAccountNumber}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Atas Nama</span>
              <span className="font-semibold text-foreground uppercase">
                {modalData.bankAccountName}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-line/50 pt-2 text-[11px] text-muted">
              <span>Rincian (Bruto - Fee 5%)</span>
              <span className="tabular">
                {formatIDR(modalData.grossAmount)} - {formatIDR(modalData.feeAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Indikator Status Transaksi */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Transfer instan berhasil via Escrow Kontem
        </div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
}
