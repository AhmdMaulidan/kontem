import assert from "node:assert/strict";
import { test } from "node:test";
import { extractYouTubeVideoId, fetchVideoMetrics } from "./video-metrics";

test("video-metrics: extractYouTubeVideoId mengekstrak video ID dari berbagai format URL", () => {
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/shorts/jNQXAC9IVRw"),
    "jNQXAC9IVRw",
  );
  assert.equal(
    extractYouTubeVideoId("https://youtube.com/shorts/jNQXAC9IVRw?feature=share"),
    "jNQXAC9IVRw",
  );
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/@jawed/shorts/jNQXAC9IVRw"),
    "jNQXAC9IVRw",
  );
  assert.equal(
    extractYouTubeVideoId("https://youtu.be/jNQXAC9IVRw"),
    "jNQXAC9IVRw",
  );
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/watch?v=jNQXAC9IVRw"),
    "jNQXAC9IVRw",
  );
  assert.equal(extractYouTubeVideoId("https://example.com/other"), null);
  assert.equal(extractYouTubeVideoId(""), null);
});

test("video-metrics: menolak platform Instagram dengan pesan konfigurasi", async () => {
  await assert.rejects(
    () => fetchVideoMetrics("INSTAGRAM", "https://instagram.com/p/123"),
    /Instagram belum dikonfigurasi/,
  );
});

test("video-metrics: menolak URL YouTube yang tidak memuat ID video valid", async () => {
  await assert.rejects(
    () => fetchVideoMetrics("YOUTUBE", "https://youtube.com/invalid-video-link"),
    /URL YouTube Shorts tidak valid/,
  );
});
