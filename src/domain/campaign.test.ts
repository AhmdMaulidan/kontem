import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateCampaignSettlementSummary,
  validateCampaignQuota,
} from "./campaign";

test("settlement summary: menghitung total reach, serapan budget, dan refund normal", () => {
  const summary = calculateCampaignSettlementSummary({
    campaign: {
      id: "camp-1",
      title: "Promosi Resto Enak",
      budgetPool: 2_500_000,
      cpmRate: 15_000,
      platformFeeRate: 15,
      status: "SETTLED",
      settledAt: new Date("2026-09-16T12:00:00Z"),
    },
    submissions: [
      {
        id: "sub-1",
        creatorId: "cr-1",
        creatorName: "Ahmad Foodie",
        status: "APPROVED",
        platform: "TIKTOK",
        contentUrl: "https://tiktok.com/@ahmad/video/1",
        lastViews: 50_000,
      },
      {
        id: "sub-2",
        creatorId: "cr-2",
        creatorName: "Budi Kuliner",
        status: "APPROVED",
        platform: "TIKTOK",
        contentUrl: "https://tiktok.com/@budi/video/2",
        lastViews: 30_000,
      },
      {
        id: "sub-3",
        creatorId: "cr-3",
        creatorName: "Cindy Travel",
        status: "REJECTED",
        platform: "INSTAGRAM",
        contentUrl: "https://instagram.com/p/3",
        lastViews: 10_000,
      },
    ],
  });

  assert.equal(summary.isSettled, true);
  assert.equal(summary.totalReach, 80_000);
  assert.equal(summary.totalSubmissions, 3);
  assert.equal(summary.approvedSubmissions, 2);
  assert.equal(summary.rejectedSubmissions, 1);
  assert.equal(summary.creatorsCount, 2);

  // 80.000 / 1.000 * 15.000 = 1.200.000
  assert.equal(summary.budgetSpent, 1_200_000);
  assert.equal(summary.refundAmount, 1_300_000);
  assert.equal(summary.budgetAbsorptionRate, 48.0);
  assert.equal(summary.realizedCpm, 15_000);
  assert.equal(summary.cpmEfficiencyPercent, 0);

  assert.equal(summary.topPerformers.length, 2);
  assert.equal(summary.topPerformers[0].creatorName, "Ahmad Foodie");
  assert.equal(summary.topPerformers[0].rank, 1);
  assert.equal(summary.topPerformers[0].views, 50_000);
  assert.equal(summary.topPerformers[1].creatorName, "Budi Kuliner");
  assert.equal(summary.topPerformers[1].rank, 2);
  assert.equal(summary.topPerformers[1].views, 30_000);
});

test("settlement summary: menghitung efisiensi Realized CPM saat kampanye viral melampaui pool", () => {
  const summary = calculateCampaignSettlementSummary({
    campaign: {
      id: "camp-viral",
      title: "Wisata Alam Viral",
      budgetPool: 2_500_000,
      cpmRate: 15_000,
      platformFeeRate: 15,
      status: "SETTLED",
    },
    submissions: [
      {
        id: "sub-1",
        creatorId: "cr-1",
        creatorName: "Kreator Viral",
        status: "APPROVED",
        platform: "TIKTOK",
        contentUrl: "https://tiktok.com/@v/1",
        lastViews: 150_000,
      },
      {
        id: "sub-2",
        creatorId: "cr-2",
        creatorName: "Kreator Pendukung",
        status: "APPROVED",
        platform: "INSTAGRAM",
        contentUrl: "https://instagram.com/p/2",
        lastViews: 100_000,
      },
    ],
  });

  assert.equal(summary.totalReach, 250_000);
  // Pool habis, vendor hanya membayar 2.500.000
  assert.equal(summary.budgetSpent, 2_500_000);
  assert.equal(summary.refundAmount, 0);
  assert.equal(summary.budgetAbsorptionRate, 100.0);

  // Realized CPM = (2.500.000 / 250.000) * 1.000 = 10.000
  assert.equal(summary.realizedCpm, 10_000);
  // Hemat 33.3% vs target 15.000
  assert.equal(summary.cpmEfficiencyPercent, 33.3);
});

test("settlement summary: memilih Top 3 Creator Performers dan breakdown platform", () => {
  const summary = calculateCampaignSettlementSummary({
    campaign: {
      id: "camp-multi",
      title: "Cafe Hits",
      budgetPool: 5_000_000,
      cpmRate: 20_000,
      platformFeeRate: 15,
      status: "ACTIVE",
    },
    submissions: [
      {
        id: "s1",
        creatorId: "c1",
        creatorName: "Kreator 1",
        status: "APPROVED",
        platform: "TIKTOK",
        contentUrl: "https://tiktok.com/1",
        lastViews: 120_000,
      },
      {
        id: "s2",
        creatorId: "c2",
        creatorName: "Kreator 2",
        status: "APPROVED",
        platform: "TIKTOK",
        contentUrl: "https://tiktok.com/2",
        lastViews: 80_000,
      },
      {
        id: "s3",
        creatorId: "c3",
        creatorName: "Kreator 3",
        status: "APPROVED",
        platform: "INSTAGRAM",
        contentUrl: "https://instagram.com/3",
        lastViews: 50_000,
      },
      {
        id: "s4",
        creatorId: "c4",
        creatorName: "Kreator 4",
        status: "APPROVED",
        platform: "YOUTUBE",
        contentUrl: "https://youtube.com/4",
        lastViews: 10_000,
      },
    ],
  });

  // Hanya mengambil top 3
  assert.equal(summary.topPerformers.length, 3);
  assert.equal(summary.topPerformers[0].rank, 1);
  assert.equal(summary.topPerformers[0].creatorName, "Kreator 1");
  assert.equal(summary.topPerformers[0].rawViews, 120_000);

  assert.equal(summary.topPerformers[1].rank, 2);
  assert.equal(summary.topPerformers[1].creatorName, "Kreator 2");
  assert.equal(summary.topPerformers[1].rawViews, 80_000);

  assert.equal(summary.topPerformers[2].rank, 3);
  assert.equal(summary.topPerformers[2].creatorName, "Kreator 3");
  assert.equal(summary.topPerformers[2].rawViews, 50_000);

  // Platform breakdown
  assert.equal(summary.platforms.length, 3);
  const tiktok = summary.platforms.find((p) => p.platform === "TIKTOK");
  assert.equal(tiktok?.submissionsCount, 2);
  assert.equal(tiktok?.totalViews, 200_000);
});

test("campaign quota: validateCampaignQuota menerima nilai 1 sampai 100", () => {
  assert.equal(validateCampaignQuota(1).isValid, true);
  assert.equal(validateCampaignQuota(10).isValid, true);
  assert.equal(validateCampaignQuota(50).isValid, true);
  assert.equal(validateCampaignQuota(100).isValid, true);
});

test("campaign quota: validateCampaignQuota menolak kuota kurang dari 1 atau lebih dari 100", () => {
  const nol = validateCampaignQuota(0);
  assert.equal(nol.isValid, false);
  assert.match(nol.error!, /minimal 1/i);

  const negatif = validateCampaignQuota(-5);
  assert.equal(negatif.isValid, false);
  assert.match(negatif.error!, /minimal 1/i);

  const lebih = validateCampaignQuota(101);
  assert.equal(lebih.isValid, false);
  assert.match(lebih.error!, /maksimal 100/i);
});

test("campaign quota: validateCampaignQuota menolak angka non-integer (desimal)", () => {
  const desimal = validateCampaignQuota(10.5);
  assert.equal(desimal.isValid, false);
  assert.match(desimal.error!, /bilangan bulat/i);
});
