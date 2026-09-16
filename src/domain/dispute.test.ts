import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canUserParticipateInDispute,
  validateDisputeMessage,
  determineDisputeRecipients,
} from "./dispute";

test("dispute: canUserParticipateInDispute mengizinkan Admin, Kreator pemilik, dan Vendor pemilik", () => {
  const creatorId = "creator-123";
  const vendorId = "vendor-456";

  // Admin selalu diizinkan
  assert.equal(
    canUserParticipateInDispute({
      userRole: "ADMIN",
      userId: "admin-999",
      disputeCreatorId: creatorId,
      disputeVendorId: vendorId,
    }),
    true,
  );

  // Kreator pemilik diizinkan
  assert.equal(
    canUserParticipateInDispute({
      userRole: "CREATOR",
      userId: creatorId,
      disputeCreatorId: creatorId,
      disputeVendorId: vendorId,
    }),
    true,
  );

  // Vendor pemilik diizinkan
  assert.equal(
    canUserParticipateInDispute({
      userRole: "VENDOR",
      userId: vendorId,
      disputeCreatorId: creatorId,
      disputeVendorId: vendorId,
    }),
    true,
  );

  // Kreator lain ditolak
  assert.equal(
    canUserParticipateInDispute({
      userRole: "CREATOR",
      userId: "creator-other",
      disputeCreatorId: creatorId,
      disputeVendorId: vendorId,
    }),
    false,
  );

  // Vendor lain ditolak
  assert.equal(
    canUserParticipateInDispute({
      userRole: "VENDOR",
      userId: "vendor-other",
      disputeCreatorId: creatorId,
      disputeVendorId: vendorId,
    }),
    false,
  );
});

test("dispute: validateDisputeMessage memvalidasi status OPEN dan panjang pesan", () => {
  // Pesan valid
  const valid = validateDisputeMessage({
    status: "OPEN",
    body: "Video sudah memuat logo restoran di detik 00:05.",
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.error, undefined);

  // Sengketa sudah diputus ditolak
  const sengketaSelesai = validateDisputeMessage({
    status: "RESOLVED_OVERTURNED",
    body: "Tambahan info",
  });
  assert.equal(sengketaSelesai.isValid, false);
  assert.match(sengketaSelesai.error!, /sudah diputus/);

  // Pesan terlalu pendek
  const pendek = validateDisputeMessage({
    status: "OPEN",
    body: "  ya ",
  });
  assert.equal(pendek.isValid, false);
  assert.match(pendek.error!, /terlalu singkat/);

  // Pesan terlalu panjang
  const panjang = validateDisputeMessage({
    status: "OPEN",
    body: "A".repeat(1005),
  });
  assert.equal(panjang.isValid, false);
  assert.match(panjang.error!, /terlalu panjang/);
});

test("dispute: determineDisputeRecipients mengecualikan pengirim pesan dan menentukan target", () => {
  const creatorId = "creator-1";
  const vendorId = "vendor-1";
  const adminIds = ["admin-1", "admin-2"];

  // Kreator mengirim pesan: targetnya adalah Vendor dan Admin
  const targetDariKreator = determineDisputeRecipients({
    senderId: creatorId,
    creatorId,
    vendorId,
    adminUserIds: adminIds,
  });
  assert.deepEqual(targetDariKreator.sort(), ["admin-1", "admin-2", "vendor-1"]);

  // Vendor mengirim pesan: targetnya adalah Kreator dan Admin
  const targetDariVendor = determineDisputeRecipients({
    senderId: vendorId,
    creatorId,
    vendorId,
    adminUserIds: adminIds,
  });
  assert.deepEqual(targetDariVendor.sort(), ["admin-1", "admin-2", "creator-1"]);

  // Admin-1 mengirim pesan: targetnya adalah Kreator, Vendor, dan Admin-2 (bukan Admin-1)
  const targetDariAdmin = determineDisputeRecipients({
    senderId: "admin-1",
    creatorId,
    vendorId,
    adminUserIds: adminIds,
  });
  assert.deepEqual(targetDariAdmin.sort(), ["admin-2", "creator-1", "vendor-1"]);
});
