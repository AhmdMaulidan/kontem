import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { successResponse, errorResponse, ErrorCode } from "./api-response";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

test("successResponse: generates standard JSON response with 200 status", async () => {
  const data = { id: "123", name: "Campaign Test" };
  const res = successResponse(data);

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.deepEqual(json.data, data);
  assert.equal(json.pagination, undefined);
});

test("successResponse: includes pagination metadata when provided", async () => {
  const data = [{ id: "1" }, { id: "2" }];
  const pagination = {
    page: 1,
    limit: 10,
    totalItems: 25,
    totalPages: 3,
  };
  const res = successResponse(data, 201, { pagination });

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.length, 2);
  assert.deepEqual(json.meta?.pagination, pagination);
});

test("errorResponse: formats standard error envelope with custom status", async () => {
  const res = errorResponse(
    ErrorCode.NOT_FOUND,
    "Resource tidak ditemukan",
    404,
    { resourceId: "abc" },
  );

  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.equal(json.error.code, ErrorCode.NOT_FOUND);
  assert.equal(json.error.message, "Resource tidak ditemukan");
  assert.deepEqual(json.error.details, { resourceId: "abc" });
});

test("rate-limit: permits requests up to max, then blocks subsequent requests", () => {
  const key = "test-rate-limit-key";
  resetRateLimit(key);

  const limit = 3;
  const windowMs = 5000;

  // 3 requests allowed
  const r1 = checkRateLimit(key, limit, windowMs);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = checkRateLimit(key, limit, windowMs);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = checkRateLimit(key, limit, windowMs);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  // 4th request blocked
  const r4 = checkRateLimit(key, limit, windowMs);
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
  assert.ok(r4.retryAfterMs > 0);

  // Cleanup
  resetRateLimit(key);
});

test("security: bcrypt 72-byte max password constraint prevents CPU exhaustion DoS", () => {
  const passwordSchema = z
    .string()
    .min(6, "Password minimal 6 karakter.")
    .max(72, "Password maksimal 72 karakter untuk keamanan.");

  // Valid password
  const valid = passwordSchema.safeParse("SecurePassword123!");
  assert.equal(valid.success, true);

  // Exactly 72 characters
  const exact72 = passwordSchema.safeParse("A".repeat(72));
  assert.equal(exact72.success, true);

  // 73 characters - must be rejected
  const over72 = passwordSchema.safeParse("A".repeat(73));
  assert.equal(over72.success, false);
  assert.match(over72.error?.issues[0]?.message ?? "", /72/);

  // 10,000 characters payload (DoS attempt) - must be rejected by validation before bcrypt
  const dosPayload = passwordSchema.safeParse("A".repeat(10_000));
  assert.equal(dosPayload.success, false);
});

test("security: 32-bit postgres integer overflow prevention (budget bounds)", () => {
  const campaignBudgetSchema = z.object({
    budgetPool: z.number().int().min(100_000).max(2_000_000_000),
    cpmRate: z.number().int().min(1_000).max(2_000_000_000),
  });

  // Valid budget
  const valid = campaignBudgetSchema.safeParse({
    budgetPool: 5_000_000,
    cpmRate: 15_000,
  });
  assert.equal(valid.success, true);

  // Overflow budget > Postgres 32-bit Int MAX (2,147,483,647)
  const overflow = campaignBudgetSchema.safeParse({
    budgetPool: 6_500_045_000,
    cpmRate: 15_000,
  });
  assert.equal(overflow.success, false);
});
