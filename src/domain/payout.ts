/**
 * Perhitungan payout campaign.
 *
 * Dua aturan yang bekerja bersamaan:
 *  1. CPM rate menentukan tarif — creator dibayar `views / 1000 * cpmRate`.
 *  2. Budget pool adalah plafon keras — vendor tidak pernah membayar lebih
 *     dari yang sudah dikunci di escrow.
 *
 * Selama total tagihan CPM masih di bawah pool, tiap creator menerima penuh
 * sesuai tarif dan sisanya dikembalikan ke vendor. Begitu campaign melampaui
 * pool, seluruh pool dibagi proporsional menurut views — persis mekanika yang
 * dijelaskan di spesifikasi produk.
 *
 * Fungsi ini murni (tanpa akses database) supaya gampang diuji dan dipakai
 * untuk menampilkan estimasi earning ke creator saat campaign masih berjalan.
 */

export type PayoutInput = {
  creatorId: string;
  submissionId: string | null;
  views: number;
};

export type PayoutLine = {
  creatorId: string;
  submissionId: string | null;
  viewsCounted: number;
  totalPoolViews: number;
  /** Porsi views creator ini terhadap total, dalam persen. */
  sharePercent: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
};

export type PayoutResult = {
  lines: PayoutLine[];
  totalViews: number;
  /** Total yang benar-benar keluar dari pool (sebelum fee dipotong). */
  totalDistributed: number;
  totalPlatformFee: number;
  totalNetToCreators: number;
  /** Sisa pool yang dikembalikan ke vendor. */
  refundToVendor: number;
  /** true kalau tagihan CPM melebihi pool sehingga dibagi proporsional. */
  poolExhausted: boolean;
};

export function calculatePayouts(
  entries: PayoutInput[],
  opts: { budgetPool: number; cpmRate: number; platformFeeRate: number },
): PayoutResult {
  const { budgetPool, cpmRate, platformFeeRate } = opts;

  const counted = entries.filter((entry) => entry.views > 0);
  const totalViews = counted.reduce((sum, entry) => sum + entry.views, 0);

  if (totalViews === 0) {
    return {
      lines: [],
      totalViews: 0,
      totalDistributed: 0,
      totalPlatformFee: 0,
      totalNetToCreators: 0,
      refundToVendor: budgetPool,
      poolExhausted: false,
    };
  }

  const cpmTotal = counted.reduce(
    (sum, entry) => sum + (entry.views / 1000) * cpmRate,
    0,
  );
  const poolExhausted = cpmTotal > budgetPool;

  // Nilai ideal (masih pecahan) sebelum dibulatkan ke rupiah penuh.
  const rawAmounts = counted.map((entry) =>
    poolExhausted
      ? (budgetPool * entry.views) / totalViews
      : (entry.views / 1000) * cpmRate,
  );

  const grossAmounts = largestRemainder(
    rawAmounts,
    poolExhausted ? budgetPool : Math.round(sum(rawAmounts)),
  );

  const lines: PayoutLine[] = counted.map((entry, index) => {
    const grossAmount = grossAmounts[index];
    const platformFee = Math.round((grossAmount * platformFeeRate) / 100);
    return {
      creatorId: entry.creatorId,
      submissionId: entry.submissionId,
      viewsCounted: entry.views,
      totalPoolViews: totalViews,
      sharePercent: Number(((entry.views / totalViews) * 100).toFixed(4)),
      grossAmount,
      platformFee,
      netAmount: grossAmount - platformFee,
    };
  });

  const totalDistributed = lines.reduce((s, l) => s + l.grossAmount, 0);
  const totalPlatformFee = lines.reduce((s, l) => s + l.platformFee, 0);

  return {
    lines,
    totalViews,
    totalDistributed,
    totalPlatformFee,
    totalNetToCreators: totalDistributed - totalPlatformFee,
    refundToVendor: Math.max(0, budgetPool - totalDistributed),
    poolExhausted,
  };
}

/**
 * Bagi `total` rupiah mengikuti proporsi `values`, lalu bulatkan sedemikian
 * rupa sehingga jumlah hasilnya tepat sama dengan `total`. Tanpa ini,
 * pembulatan per baris bisa membuat platform membayar lebih besar dari pool.
 */
function largestRemainder(values: number[], total: number): number[] {
  if (values.length === 0) return [];

  const floors = values.map((value) => Math.floor(value));
  let remainder = total - sum(floors);

  // Baris dengan pecahan terbesar mendapat sisa rupiah lebih dulu.
  const order = values
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; remainder > 0 && i < order.length; i += 1) {
    floors[order[i].index] += 1;
    remainder -= 1;
  }

  // Kalau pembulatan justru melebihi total, tarik kembali dari pecahan terkecil.
  for (let i = order.length - 1; remainder < 0 && i >= 0; i -= 1) {
    if (floors[order[i].index] > 0) {
      floors[order[i].index] -= 1;
      remainder += 1;
    }
  }

  return floors;
}

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

/** Estimasi earning satu creator kalau campaign ditutup dengan kondisi saat ini. */
export function estimateEarning(
  myViews: number,
  allEntries: PayoutInput[],
  opts: { budgetPool: number; cpmRate: number; platformFeeRate: number },
  creatorId: string,
) {
  const result = calculatePayouts(allEntries, opts);
  const line = result.lines.find((l) => l.creatorId === creatorId);
  return {
    views: myViews,
    netAmount: line?.netAmount ?? 0,
    sharePercent: line?.sharePercent ?? 0,
    poolExhausted: result.poolExhausted,
  };
}
