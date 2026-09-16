import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeViewGrowth,
  evaluateViewFraud,
  validateViewUpdateThrottle,
  VIEW_SYNC_COOLDOWN_MS,
} from "./views";
import { checkRateLimit, checkThrottle, clearRateLimitStores } from "../lib/rate-limit";

test("throttling views: mengizinkan konten yang belum pernah disinkronkan", () => {
  const result = validateViewUpdateThrottle(null);
  assert.equal(result.allowed, true);
  assert.equal(result.remainingSeconds, 0);
});

test("throttling views: menolak pembaruan jika jeda belum mencapai 5 menit", () => {
  const now = new Date();
  const lastSynced = new Date(now.getTime() - 2 * 60 * 1000); // 2 menit lalu

  const result = validateViewUpdateThrottle(lastSynced, false, now);
  assert.equal(result.allowed, false);
  assert.equal(result.remainingSeconds, 180); // 3 menit sisa
  assert.match(result.message!, /dibatasi jeda 5 menit/);
});

test("throttling views: mengizinkan pembaruan jika jeda sudah melebihi 5 menit", () => {
  const now = new Date();
  const lastSynced = new Date(now.getTime() - (VIEW_SYNC_COOLDOWN_MS + 1000));

  const result = validateViewUpdateThrottle(lastSynced, false, now);
  assert.equal(result.allowed, true);
  assert.equal(result.remainingSeconds, 0);
});

test("throttling views: bypass jeda jika mode koreksi (isCorrection) aktif", () => {
  const now = new Date();
  const lastSynced = new Date(now.getTime() - 30 * 1000); // baru 30 detik lalu

  const result = validateViewUpdateThrottle(lastSynced, true, now);
  assert.equal(result.allowed, true);
  assert.equal(result.remainingSeconds, 0);
});

test("analisis views: mendeteksi penurunan views yang mencurigakan", () => {
  const result = analyzeViewGrowth(10_000, 8_000);
  assert.equal(result.isSuspiciousDecrease, true);
  assert.equal(result.deltaViews, -2_000);

  const fraud = evaluateViewFraud(10_000, 8_000);
  assert.ok(fraud);
  assert.equal(fraud?.type, "INFLATED_VIEWS");
  assert.equal(fraud?.severity, 2);
  assert.match(fraud?.reason ?? "", /Penurunan views tidak wajar/);
});

test("analisis views: mendeteksi lonjakan views ekstrem (velocity spike)", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const prevTime = new Date("2026-09-16T11:00:00Z"); // 1 jam lalu

  // Melonjak 60.000 views dalam 1 jam
  const fraud = evaluateViewFraud(5_000, 65_000, prevTime, now);
  assert.ok(fraud);
  assert.equal(fraud?.type, "INFLATED_VIEWS");
  assert.equal(fraud?.severity, 3);
  assert.match(fraud?.reason ?? "", /Lonjakan views ekstrem/);
});

test("analisis views: mendeteksi anomali keterlibatan (views tinggi 0 likes/comments)", () => {
  // Views 25.000 tapi 0 likes dan 0 comments
  const fraud = evaluateViewFraud(20_000, 25_000, null, new Date(), 0, 0);
  assert.ok(fraud);
  assert.equal(fraud?.type, "INFLATED_VIEWS");
  assert.equal(fraud?.severity, 1);
  assert.match(fraud?.reason ?? "", /Anomali interaksi/);
});

test("analisis views: pertumbuhan normal tidak menghasilkan flag fraud", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const prevTime = new Date("2026-09-16T10:00:00Z"); // 2 jam lalu

  const fraud = evaluateViewFraud(10_000, 15_000, prevTime, now, 120, 15);
  assert.equal(fraud, null);
});

test("rate limiter: membatasi aksi saat kuota per jendela waktu terlampaui", () => {
  clearRateLimitStores();
  const key = "test-admin";
  const limit = 3;
  const windowMs = 10_000;
  const t0 = 100_000;

  assert.equal(checkRateLimit(key, limit, windowMs, t0).allowed, true);
  assert.equal(checkRateLimit(key, limit, windowMs, t0 + 1000).allowed, true);
  assert.equal(checkRateLimit(key, limit, windowMs, t0 + 2000).allowed, true);

  // Request ke-4 harus ditolak
  const blocked = checkRateLimit(key, limit, windowMs, t0 + 3000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterMs, 7000);

  // Setelah jendela waktu berlalu, harus diizinkan kembali
  const afterWindow = checkRateLimit(key, limit, windowMs, t0 + 11000);
  assert.equal(afterWindow.allowed, true);
});

test("throttling util: membatasi frekuensi aksi berulang", () => {
  clearRateLimitStores();
  const key = "test-item";
  const cooldown = 5000;
  const t0 = 100_000;

  assert.equal(checkThrottle(key, cooldown, t0).allowed, true);

  // Terlalu cepat
  const fast = checkThrottle(key, cooldown, t0 + 2000);
  assert.equal(fast.allowed, false);
  assert.equal(fast.retryAfterMs, 3000);

  // Setelah cooldown selesai
  const allowed = checkThrottle(key, cooldown, t0 + 6000);
  assert.equal(allowed.allowed, true);
});
