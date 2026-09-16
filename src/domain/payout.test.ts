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

test("plafon maxViewsPerCreator membatasi views dan tagihan CPM di bawah pool", () => {
  // Creator punya 100.000 views, tapi plafon disetel 40.000 views
  const hasil = calculatePayouts(
    [{ creatorId: "a", submissionId: "s1", views: 100_000 }],
    { ...opts, maxViewsPerCreator: 40_000 },
  );
  assert.equal(hasil.poolExhausted, false);
  assert.equal(hasil.totalViews, 40_000);
  assert.equal(hasil.lines[0].rawViews, 100_000);
  assert.equal(hasil.lines[0].viewsCounted, 40_000);
  assert.equal(hasil.lines[0].isCapped, true);
  // 40.000 views / 1.000 * 15.000 = 600.000 (bukan 1.500.000)
  assert.equal(hasil.lines[0].grossAmount, 600_000);
  assert.equal(hasil.lines[0].platformFee, 90_000);
  assert.equal(hasil.lines[0].netAmount, 510_000);
  assert.equal(hasil.refundToVendor, 1_900_000);
});

test("plafon maxViewsPerCreator mencegah satu kreator viral memborong seluruh pool", () => {
  // Creator A viral (1.000.000 views), Creator B normal (50.000 views)
  // Dengan plafon 50.000, Creator A dibatasi di 50.000, sehingga pool dibagi 50% : 50%
  const hasil = calculatePayouts(
    [
      { creatorId: "a", submissionId: "s1", views: 1_000_000 },
      { creatorId: "b", submissionId: "s2", views: 50_000 },
    ],
    { budgetPool: 1_000_000, cpmRate: 15_000, platformFeeRate: 15, maxViewsPerCreator: 50_000 },
  );
  assert.equal(hasil.poolExhausted, true);
  assert.equal(hasil.totalViews, 100_000);
  assert.equal(hasil.lines[0].isCapped, true);
  assert.equal(hasil.lines[0].viewsCounted, 50_000);
  assert.equal(hasil.lines[0].sharePercent, 50);
  assert.equal(hasil.lines[0].grossAmount, 500_000);

  assert.equal(hasil.lines[1].isCapped, false);
  assert.equal(hasil.lines[1].viewsCounted, 50_000);
  assert.equal(hasil.lines[1].sharePercent, 50);
  assert.equal(hasil.lines[1].grossAmount, 500_000);
});

test("tanpa plafon maxViewsPerCreator (null/undefined), views dihitung penuh", () => {
  const hasil = calculatePayouts(
    [{ creatorId: "a", submissionId: "s1", views: 100_000 }],
    { ...opts, maxViewsPerCreator: null },
  );
  assert.equal(hasil.lines[0].rawViews, 100_000);
  assert.equal(hasil.lines[0].viewsCounted, 100_000);
  assert.equal(hasil.lines[0].isCapped, false);
  assert.equal(hasil.lines[0].grossAmount, 1_500_000);
});

