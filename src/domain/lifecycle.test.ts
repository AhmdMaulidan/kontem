import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateCampaignEndingSoon,
  evaluateCampaignTransitionToEnd,
  evaluateTrackingPeriodFinished,
  runCampaignLifecycleSync,
} from "./lifecycle";


test("lifecycle: campaign aktif sebelum endDate tidak boleh berakhir", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  const endDate = new Date("2026-09-17T10:00:00Z");

  const result = evaluateCampaignTransitionToEnd(
    { status: "ACTIVE", endDate },
    now,
  );

  assert.equal(result.shouldEnd, false);
});

test("lifecycle: campaign aktif setelah endDate harus beralih ke ENDED", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  const endDate = new Date("2026-09-15T10:00:00Z");

  const result = evaluateCampaignTransitionToEnd(
    { status: "ACTIVE", endDate },
    now,
  );

  assert.equal(result.shouldEnd, true);
  assert.match(result.reason!, /telah berakhir/);
});

test("lifecycle: campaign non-aktif tidak dievaluasi transisi ENDED", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  const endDate = new Date("2026-09-15T10:00:00Z");

  const draftResult = evaluateCampaignTransitionToEnd(
    { status: "DRAFT", endDate },
    now,
  );
  assert.equal(draftResult.shouldEnd, false);

  const endedResult = evaluateCampaignTransitionToEnd(
    { status: "ENDED", endDate },
    now,
  );
  assert.equal(endedResult.shouldEnd, false);
});

test("lifecycle: campaign ENDED sebelum trackingEndsAt masih dalam masa pelacakan", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  const trackingEndsAt = new Date("2026-09-20T10:00:00Z");

  const result = evaluateTrackingPeriodFinished(
    { status: "ENDED", trackingEndsAt },
    now,
  );

  assert.equal(result.isTrackingOver, false);
});

test("lifecycle: campaign ENDED setelah trackingEndsAt siap diselesaikan (settle)", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  const trackingEndsAt = new Date("2026-09-15T10:00:00Z");

  const result = evaluateTrackingPeriodFinished(
    { status: "ENDED", trackingEndsAt },
    now,
  );

  assert.equal(result.isTrackingOver, true);
  assert.match(result.reason!, /Masa pelacakan views berakhir/);
});

test("lifecycle: campaign ACTIVE dalam 48 jam sebelum endDate dievaluasi ending soon", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  const endDate = new Date("2026-09-17T10:00:00Z"); // 24 jam lagi

  const result = evaluateCampaignEndingSoon(
    { status: "ACTIVE", endDate },
    now,
    48,
  );

  assert.equal(result.isEndingSoon, true);
  assert.equal(result.hoursLeft, 24);
  assert.match(result.reason!, /segera berakhir/);
});

test("lifecycle: campaign ACTIVE lebih dari 48 jam sebelum endDate tidak dievaluasi ending soon", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  const endDate = new Date("2026-09-20T10:00:00Z"); // 96 jam lagi

  const result = evaluateCampaignEndingSoon(
    { status: "ACTIVE", endDate },
    now,
    48,
  );

  assert.equal(result.isEndingSoon, false);
  assert.equal(result.hoursLeft, 96);
  assert.match(result.reason!, /masih berlangsung/);
});

test("lifecycle: campaign non-ACTIVE atau sudah berakhir tidak dievaluasi ending soon", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  const pastEndDate = new Date("2026-09-15T10:00:00Z");

  const pastResult = evaluateCampaignEndingSoon(
    { status: "ACTIVE", endDate: pastEndDate },
    now,
    48,
  );
  assert.equal(pastResult.isEndingSoon, false);

  const draftResult = evaluateCampaignEndingSoon(
    { status: "DRAFT", endDate: new Date("2026-09-17T10:00:00Z") },
    now,
    48,
  );
  assert.equal(draftResult.isEndingSoon, false);
});

test("lifecycle: runCampaignLifecycleSync menjalankan transisi campaign dan notifikasi", async () => {
  const updates: Array<{ model: string; id: string; data: Record<string, unknown> }> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const auditLogs: Array<Record<string, unknown>> = [];

  const mockDb = {
    campaign: {
      findMany: async (query: {
        where: { status?: string; endDate?: Record<string, unknown> };
      }) => {
        if (query.where.status === "ACTIVE") {
          if (query.where.endDate && "gt" in query.where.endDate) {
            return [
              {
                id: "camp-soon",
                title: "Kafe Estetik",
                endDate: new Date("2026-09-17T10:00:00Z"),
                status: "ACTIVE",
              },
            ];
          }
          return [
            {
              id: "camp-1",
              title: "Bakso Viral",
              vendorId: "vendor-1",
              endDate: new Date("2026-09-15T00:00:00Z"),
            },
          ];
        }
        if (query.where.status === "ENDED") {
          return [
            {
              id: "camp-2",
              title: "Kafe Kopi",
              trackingEndsAt: new Date("2026-09-15T00:00:00Z"),
              budgetPool: 1_000_000,
              cpmRate: 15_000,
              platformFeeRate: 3,
              maxViewsPerCreator: null,
            },
          ];
        }
        return [];
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ model: "campaign", id: args.where.id, data: args.data });
        return {};
      },
    },
    campaignParticipation: {
      findMany: async () => [{ creatorId: "creator-soon" }],
    },
    withdrawal: {
      count: async () => 0, // tidak ada penarikan dini yang menahan settlement
    },
    submission: {
      findMany: async () => [], // tidak ada submission approved di campaign ini
    },
    payout: {
      create: async () => ({}),
    },
    escrowTransaction: {
      create: async () => ({}),
    },
    user: {
      findMany: async () => [{ id: "admin-1" }],
    },
    notification: {
      findMany: async () => [], // creator-soon belum pernah dinotifikasi
      create: async (args: { data: Record<string, unknown> }) => {
        notifications.push(args.data);
        return {};
      },
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        notifications.push(...args.data);
        return { count: args.data.length };
      },
    },
    auditLog: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        auditLogs.push(args.data);
        return {};
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      return fn(mockDb);
    },
  };

  const result = await runCampaignLifecycleSync(
    mockDb as unknown as Parameters<typeof runCampaignLifecycleSync>[0],
    new Date("2026-09-16T10:00:00Z"),
  );

  assert.equal(result.campaignsEnded, 1);
  assert.equal(result.campaignsSettled, 1);
  assert.equal(result.endingSoonAlertsSent, 1);

  // Pastikan campaign status diubah jadi ENDED
  const campUpdate = updates.find((u) => u.model === "campaign" && u.id === "camp-1");
  assert.equal(campUpdate?.data.status, "ENDED");

  // Pastikan campaign yang tracking-nya selesai langsung disettle otomatis
  const settleUpdate = updates.find((u) => u.model === "campaign" && u.id === "camp-2");
  assert.equal(settleUpdate?.data.status, "SETTLED");

  // Pastikan audit logs tercatat
  assert.ok(auditLogs.some((a) => a.action === "campaign.lifecycle.ended"));
  assert.ok(auditLogs.some((a) => a.action === "campaign.auto_settle"));
});


