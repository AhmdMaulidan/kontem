import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePayouts } from "./payout";

const opts = { budgetPool: 2_500_000, cpmRate: 15_000, platformFeeRate: 15 };

test("tanpa views sama sekali, seluruh pool kembali ke vendor", () => {
  const hasil = calculatePayouts([], opts);
  assert.equal(hasil.refundToVendor, opts.budgetPool);
  assert.equal(hasil.totalDistributed, 0);
  assert.equal(hasil.lines.length, 0);
});

test("di bawah pool, creator dibayar sesuai tarif CPM", () => {
  const hasil = calculatePayouts(
    [{ creatorId: "a", submissionId: "s1", views: 10_000 }],
    opts,
  );
  assert.equal(hasil.poolExhausted, false);
  // 10.000 views / 1.000 * 15.000 = 150.000
  assert.equal(hasil.lines[0].grossAmount, 150_000);
  assert.equal(hasil.lines[0].platformFee, 22_500);
  assert.equal(hasil.lines[0].netAmount, 127_500);
  assert.equal(hasil.refundToVendor, 2_350_000);
});

test("melewati pool, pembagian beralih ke proporsi views", () => {
  const hasil = calculatePayouts(
    [
      { creatorId: "a", submissionId: "s1", views: 150_000 },
      { creatorId: "b", submissionId: "s2", views: 50_000 },
    ],
    opts,
  );
  assert.equal(hasil.poolExhausted, true);
  // Tagihan CPM 3 juta > pool 2,5 juta, jadi dibagi 75% : 25%.
  assert.equal(hasil.lines[0].grossAmount, 1_875_000);
  assert.equal(hasil.lines[1].grossAmount, 625_000);
  assert.equal(hasil.refundToVendor, 0);
});

test("vendor tidak pernah membayar lebih dari pool", () => {
  const hasil = calculatePayouts(
    [
      { creatorId: "a", submissionId: "s1", views: 1_000_000 },
      { creatorId: "b", submissionId: "s2", views: 999_999 },
      { creatorId: "c", submissionId: "s3", views: 1 },
    ],
    opts,
  );
  assert.equal(hasil.totalDistributed, opts.budgetPool);
});

test("pembulatan tidak menghilangkan atau menciptakan rupiah", () => {
  // Tiga bagian yang sama besar dari angka yang tidak habis dibagi tiga.
  const hasil = calculatePayouts(
    [
      { creatorId: "a", submissionId: "s1", views: 100_000 },
      { creatorId: "b", submissionId: "s2", views: 100_000 },
      { creatorId: "c", submissionId: "s3", views: 100_000 },
    ],
    { budgetPool: 1_000_000, cpmRate: 15_000, platformFeeRate: 15 },
  );
  const jumlah = hasil.lines.reduce((sum, line) => sum + line.grossAmount, 0);
  assert.equal(jumlah, 1_000_000);
  assert.equal(hasil.totalNetToCreators + hasil.totalPlatformFee, 1_000_000);
});

test("views nol tidak menghasilkan baris payout", () => {
  const hasil = calculatePayouts(
    [
      { creatorId: "a", submissionId: "s1", views: 5_000 },
      { creatorId: "b", submissionId: "s2", views: 0 },
    ],
    opts,
  );
  assert.equal(hasil.lines.length, 1);
  assert.equal(hasil.lines[0].creatorId, "a");
});

test("porsi semua creator berjumlah 100 persen", () => {
  const hasil = calculatePayouts(
    [
      { creatorId: "a", submissionId: "s1", views: 84_300 },
      { creatorId: "b", submissionId: "s2", views: 21_700 },
      { creatorId: "c", submissionId: "s3", views: 156_200 },
    ],
    opts,
  );
  const totalPersen = hasil.lines.reduce((s, l) => s + l.sharePercent, 0);
  assert.ok(Math.abs(totalPersen - 100) < 0.01);
});
