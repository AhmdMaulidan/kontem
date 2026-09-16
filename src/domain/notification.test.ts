import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNearbyCampaignNotification,
  filterCreatorsForCity,
  broadcastNewCampaignToNearbyCreators,
  type CreatorTarget,
} from "./notification";

test("notification: buildNearbyCampaignNotification membentuk payload yang valid", () => {
  const payload = buildNearbyCampaignNotification({
    campaignId: "c123",
    campaignTitle: "Review Kopi Susu Aren",
    businessName: "Kopi Kenangan Senopati",
    city: "Jakarta Selatan",
  });

  assert.equal(payload.type, "CAMPAIGN_NEW_NEARBY");
  assert.equal(payload.title, "Campaign baru di Jakarta Selatan!");
  assert.match(payload.body, /Review Kopi Susu Aren/);
  assert.match(payload.body, /Kopi Kenangan Senopati/);
  assert.equal(payload.link, "/creator/campaigns/c123");
});

test("notification: filterCreatorsForCity mencocokkan kota case-insensitive dan menyaring hanya akun terverifikasi", () => {
  const mockCreators: CreatorTarget[] = [
    { userId: "u1", city: "Bandung", status: "VERIFIED" },
    { userId: "u2", city: "bandung", status: "VERIFIED" },
    { userId: "u3", city: " BANDUNG ", status: "VERIFIED" },
    { userId: "u4", city: "Bandung", status: "PENDING" }, // Belum verified
    { userId: "u5", city: "Jakarta", status: "VERIFIED" }, // Beda kota
    { userId: "u6", city: "Surabaya", status: "VERIFIED" }, // Beda kota
  ];

  const hasil = filterCreatorsForCity(mockCreators, "bandung");
  assert.equal(hasil.length, 3);
  assert.deepEqual(
    hasil.map((c) => c.userId),
    ["u1", "u2", "u3"],
  );
});

test("notification: filterCreatorsForCity mengembalikan array kosong jika kota target kosong", () => {
  const mockCreators: CreatorTarget[] = [
    { userId: "u1", city: "Bandung", status: "VERIFIED" },
  ];
  assert.deepEqual(filterCreatorsForCity(mockCreators, "  "), []);
});

test("notification: broadcastNewCampaignToNearbyCreators berhasil memicu bulk insert notifikasi", async () => {
  type NotificationRecord = {
    userId: string;
    type: string;
    title: string;
    body: string;
    link: string;
  };
  const createdRecords: NotificationRecord[] = [];

  const mockPrisma = {
    creatorProfile: {
      findMany: async (args: {
        where: {
          city: { equals: string; mode: string };
          user: { status: string };
        };
      }) => {
        assert.equal(args.where.city.equals, "Yogyakarta");
        assert.equal(args.where.city.mode, "insensitive");
        assert.equal(args.where.user.status, "VERIFIED");
        return [{ userId: "creator-1" }, { userId: "creator-2" }];
      },
    },
    notification: {
      createMany: async (args: { data: NotificationRecord[] }) => {
        createdRecords.push(...args.data);
        return { count: args.data.length };
      },
    },
  };

  const res = await broadcastNewCampaignToNearbyCreators(mockPrisma, {
    campaignId: "camp-jogja-1",
    campaignTitle: "Promo Gudeg Yu Djum",
    businessName: "Gudeg Yu Djum Wijilan",
    city: "Yogyakarta",
  });

  assert.equal(res.count, 2);
  assert.deepEqual(res.notifiedUserIds, ["creator-1", "creator-2"]);
  assert.equal(createdRecords.length, 2);
  assert.equal(createdRecords[0].userId, "creator-1");
  assert.equal(createdRecords[0].type, "CAMPAIGN_NEW_NEARBY");
  assert.equal(createdRecords[0].title, "Campaign baru di Yogyakarta!");
  assert.equal(createdRecords[1].userId, "creator-2");
});

test("notification: broadcastNewCampaignToNearbyCreators aman saat tidak ada kreator di kota tersebut", async () => {
  let createManyCalled = false;

  const mockPrisma = {
    creatorProfile: {
      findMany: async () => [],
    },
    notification: {
      createMany: async () => {
        createManyCalled = true;
        return { count: 0 };
      },
    },
  };

  const res = await broadcastNewCampaignToNearbyCreators(mockPrisma, {
    campaignId: "camp-solo-1",
    campaignTitle: "Batik Danar Hadi",
    businessName: "Danar Hadi Solo",
    city: "Surakarta",
  });

  assert.equal(res.count, 0);
  assert.deepEqual(res.notifiedUserIds, []);
  assert.equal(createManyCalled, false);
});
