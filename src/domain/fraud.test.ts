import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateDuplicateCreatorAccount } from "./fraud";

test("fraud: mendeteksi nomor rekening ganda antar-kreator", () => {
  const existing = [
    { userId: "user-1", bankAccountNumber: "1234567890", phone: "08123456789" },
    { userId: "user-2", bankAccountNumber: "0987654321", phone: "08987654321" },
  ];

  const result = evaluateDuplicateCreatorAccount(
    "user-3",
    { bankAccountNumber: "1234567890" },
    existing,
  );

  assert.equal(result.isDuplicate, true);
  assert.equal(result.duplicateField, "bankAccountNumber");
  assert.equal(result.duplicateUserId, "user-1");
  assert.match(result.reason!, /sudah digunakan oleh akun kreator lain/);
});

test("fraud: mendeteksi nomor telepon ganda antar-kreator", () => {
  const existing = [
    { userId: "user-1", bankAccountNumber: "11112222", phone: "08123456789" },
  ];

  const result = evaluateDuplicateCreatorAccount(
    "user-2",
    { phone: "08123456789" },
    existing,
  );

  assert.equal(result.isDuplicate, true);
  assert.equal(result.duplicateField, "phone");
  assert.equal(result.duplicateUserId, "user-1");
});

test("fraud: mengabaikan data milik user yang sama saat update profil", () => {
  const existing = [
    { userId: "user-1", bankAccountNumber: "1234567890", phone: "08123456789" },
  ];

  const result = evaluateDuplicateCreatorAccount(
    "user-1",
    { bankAccountNumber: "1234567890", phone: "08123456789" },
    existing,
  );

  assert.equal(result.isDuplicate, false);
});

test("fraud: tidak mendeteksi fraud jika data unik", () => {
  const existing = [
    { userId: "user-1", bankAccountNumber: "1234567890", phone: "08123456789" },
  ];

  const result = evaluateDuplicateCreatorAccount(
    "user-2",
    { bankAccountNumber: "99998888", phone: "08999888777" },
    existing,
  );

  assert.equal(result.isDuplicate, false);
});
