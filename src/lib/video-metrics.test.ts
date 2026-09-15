import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchVideoMetrics } from "./video-metrics";

test("video-metrics: menolak platform yang belum didukung dengan pesan deskriptif", async () => {
  await assert.rejects(
    () => fetchVideoMetrics("INSTAGRAM", "https://instagram.com/p/123"),
    /Instagram belum dikonfigurasi/,
  );
  await assert.rejects(
    () => fetchVideoMetrics("YOUTUBE", "https://youtube.com/watch?v=123"),
    /YouTube belum dikonfigurasi/,
  );
});
