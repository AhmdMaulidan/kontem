import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractInstagramShortcode,
  extractYouTubeVideoId,
  fetchVideoMetrics,
} from "./video-metrics";

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

test("video-metrics: extractInstagramShortcode mengekstrak shortcode dari berbagai format URL", () => {
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/reel/DB0xY_sP1zQ/"),
    "DB0xY_sP1zQ",
  );
  assert.equal(
    extractInstagramShortcode("https://instagram.com/reel/DB0xY_sP1zQ?igsh=MXJ5"),
    "DB0xY_sP1zQ",
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/reels/DB0xY_sP1zQ"),
    "DB0xY_sP1zQ",
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/p/DB0xY_sP1zQ/"),
    "DB0xY_sP1zQ",
  );
  assert.equal(
    extractInstagramShortcode(
      "https://www.instagram.com/kulinerbandung/reel/DB0xY_sP1zQ/",
    ),
    "DB0xY_sP1zQ",
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/share/reel/DB0xY_sP1zQ/"),
    "DB0xY_sP1zQ",
  );
  assert.equal(extractInstagramShortcode("https://example.com/other"), null);
  assert.equal(extractInstagramShortcode("https://instagram.com/explore"), null);
  assert.equal(extractInstagramShortcode(""), null);
});

test("video-metrics: menolak URL Instagram yang tidak memuat kode postingan valid", async () => {
  await assert.rejects(
    () => fetchVideoMetrics("INSTAGRAM", "https://instagram.com/invalid-link"),
    /URL Instagram Reels tidak valid/,
  );
});

test("video-metrics: menolak URL YouTube yang tidak memuat ID video valid", async () => {
  await assert.rejects(
    () => fetchVideoMetrics("YOUTUBE", "https://youtube.com/invalid-video-link"),
    /URL YouTube Shorts tidak valid/,
  );
});

