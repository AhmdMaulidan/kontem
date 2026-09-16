import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateVendorCollaborators,
  type RawParticipationWithSubmission,
} from "./creator-collaborator";

test("creator collaborator: mengagregasi performa kreator dari berbagai campaign vendor", () => {
  const mockData: RawParticipationWithSubmission[] = [
    {
      id: "part-1",
      joinedAt: new Date("2026-08-01"),
      campaign: { id: "c1", title: "Promo Menu Kopi Senja" },
      creator: {
        id: "creator-ahmad",
        name: "Ahmad Foodie",
        avatarUrl: null,
        creatorProfile: { city: "Bandung", trustScore: 78 },
        socialAccounts: [
          { platform: "TIKTOK", handle: "ahmad.kuliner", profileUrl: "https://tiktok.com/@ahmad.kuliner" },
        ],
      },
      submission: {
        id: "sub-1",
        status: "APPROVED",
        platform: "TIKTOK",
        contentUrl: "https://tiktok.com/@ahmad.kuliner/video/1",
        lastViews: 45_000,
        finalViews: 50_000,
        reviewedAt: new Date("2026-08-05"),
      },
    },
    {
      id: "part-2",
      joinedAt: new Date("2026-08-10"),
      campaign: { id: "c2", title: "Festival Kuliner Merdeka" },
      creator: {
        id: "creator-ahmad", // Kreator yang sama ikut campaign kedua
        name: "Ahmad Foodie",
        avatarUrl: null,
        creatorProfile: { city: "Bandung", trustScore: 82 },
        socialAccounts: [
          { platform: "TIKTOK", handle: "ahmad.kuliner", profileUrl: "https://tiktok.com/@ahmad.kuliner" },
          { platform: "INSTAGRAM", handle: "ahmad.vlog", profileUrl: "https://instagram.com/ahmad.vlog" },
        ],
      },
      submission: {
        id: "sub-2",
        status: "ADMIN_APPROVED",
        platform: "INSTAGRAM",
        contentUrl: "https://instagram.com/ahmad.vlog/reel/2",
        lastViews: 30_000,
        finalViews: null, // Pakai lastViews 30.000
        reviewedAt: new Date("2026-08-15"),
      },
    },
    {
      id: "part-3",
      joinedAt: new Date("2026-08-02"),
      campaign: { id: "c1", title: "Promo Menu Kopi Senja" },
      creator: {
        id: "creator-budi",
        name: "Budi Reviewer",
        avatarUrl: null,
        creatorProfile: { city: "Jakarta", trustScore: 65 },
        socialAccounts: [
          { platform: "TIKTOK", handle: "budi.makan", profileUrl: "https://tiktok.com/@budi.makan" },
        ],
      },
      submission: {
        id: "sub-3",
        status: "APPROVED",
        platform: "TIKTOK",
        contentUrl: "https://tiktok.com/@budi.makan/video/3",
        lastViews: 120_000,
        finalViews: 120_000,
        reviewedAt: new Date("2026-08-04"),
      },
    },
  ];

  const result = aggregateVendorCollaborators(mockData);

  assert.equal(result.length, 2);

  // Budi harus urutan #1 karena total views 120.000 > Ahmad 80.000 (50k + 30k)
  assert.equal(result[0].creatorId, "creator-budi");
  assert.equal(result[0].creatorName, "Budi Reviewer");
  assert.equal(result[0].totalViewsGenerated, 120_000);
  assert.equal(result[0].campaignsCount, 1);
  assert.equal(result[0].approvedSubmissionsCount, 1);

  // Ahmad urutan #2 dengan 2 campaign terakumulasi
  assert.equal(result[1].creatorId, "creator-ahmad");
  assert.equal(result[1].creatorName, "Ahmad Foodie");
  assert.equal(result[1].totalViewsGenerated, 80_000);
  assert.equal(result[1].campaignsCount, 2);
  assert.equal(result[1].approvedSubmissionsCount, 2);
  assert.deepEqual(result[1].campaignTitles.sort(), [
    "Festival Kuliner Merdeka",
    "Promo Menu Kopi Senja",
  ]);
  assert.equal(result[1].socialAccounts.length, 2);
});

test("creator collaborator: mengabaikan submission yang ditolak atau belum selesai", () => {
  const mockData: RawParticipationWithSubmission[] = [
    {
      id: "part-rejected",
      joinedAt: new Date("2026-08-01"),
      campaign: { id: "c1", title: "Promo Menu Kopi Senja" },
      creator: {
        id: "creator-reject",
        name: "Kreator Ditolak",
        avatarUrl: null,
        creatorProfile: { city: "Bandung", trustScore: 40 },
        socialAccounts: [],
      },
      submission: {
        id: "sub-x",
        status: "REJECTED", // Ditolak
        platform: "TIKTOK",
        contentUrl: "https://tiktok.com/@reject/video/1",
        lastViews: 10_000,
        finalViews: null,
        reviewedAt: new Date("2026-08-02"),
      },
    },
    {
      id: "part-null-sub",
      joinedAt: new Date("2026-08-01"),
      campaign: { id: "c1", title: "Promo Menu Kopi Senja" },
      creator: {
        id: "creator-no-sub",
        name: "Kreator Tanpa Sub",
        avatarUrl: null,
        creatorProfile: { city: "Bandung", trustScore: 50 },
        socialAccounts: [],
      },
      submission: null, // Belum submit
    },
  ];

  const result = aggregateVendorCollaborators(mockData);
  assert.equal(result.length, 0);
});

test("creator collaborator: aman menangani array kosong", () => {
  const result = aggregateVendorCollaborators([]);
  assert.deepEqual(result, []);
});
