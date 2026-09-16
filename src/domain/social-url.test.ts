import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractHandleFromUrl,
  normalizeHandle,
  verifyAuthorOwnership,
  verifyContentOwnership,
} from "./social-url";

test("social-url: normalizeHandle menghapus @ dan mengonversi ke lowercase", () => {
  assert.equal(normalizeHandle("@Avex.Dex"), "avex.dex");
  assert.equal(normalizeHandle("  @Kreator_Top  "), "kreator_top");
  assert.equal(normalizeHandle("user123"), "user123");
});

test("social-url: ekstraksi handle dari URL TikTok", () => {
  const url1 = "https://www.tiktok.com/@avex.dex/video/7683471563718479137?is_from_webapp=1";
  assert.equal(extractHandleFromUrl(url1, "TIKTOK"), "avex.dex");

  const url2 = "https://tiktok.com/@kuliner_bandung/photo/123456";
  assert.equal(extractHandleFromUrl(url2, "TIKTOK"), "kuliner_bandung");

  const shortUrl = "https://vt.tiktok.com/ZSjXabc12/";
  assert.equal(extractHandleFromUrl(shortUrl, "TIKTOK"), null);
});

test("social-url: ekstraksi handle dari URL YouTube Shorts", () => {
  const url = "https://www.youtube.com/@foodiesurabaya/shorts/abcd123?feature=share";
  assert.equal(extractHandleFromUrl(url, "YOUTUBE"), "foodiesurabaya");

  const urlWithoutHandle = "https://www.youtube.com/shorts/abcd123";
  assert.equal(extractHandleFromUrl(urlWithoutHandle, "YOUTUBE"), null);

  const youtuBe = "https://youtu.be/abcd123";
  assert.equal(extractHandleFromUrl(youtuBe, "YOUTUBE"), null);
});

test("social-url: ekstraksi handle dari URL Instagram", () => {
  const url1 = "https://www.instagram.com/kulinerbandung/reel/C8abc123/";
  assert.equal(extractHandleFromUrl(url1, "INSTAGRAM"), "kulinerbandung");

  const url2 = "https://www.instagram.com/reel/C8abc123/";
  assert.equal(extractHandleFromUrl(url2, "INSTAGRAM"), null);
});

test("social-url: verifyContentOwnership menerima jika handle cocok", () => {
  const result = verifyContentOwnership({
    url: "https://www.tiktok.com/@avex.dex/video/7683471563718479137",
    platform: "TIKTOK",
    registeredHandle: "@Avex.Dex",
  });

  assert.equal(result.isValid, true);
  assert.equal(result.extractedHandle, "avex.dex");
  assert.equal(result.isExplicitMismatch, false);
});

test("social-url: verifyContentOwnership menolak jika handle URL berbeda dengan akun terdaftar", () => {
  const result = verifyContentOwnership({
    url: "https://www.tiktok.com/@avex.dex/video/7683471563718479137",
    platform: "TIKTOK",
    registeredHandle: "@budi_kuliner",
  });

  assert.equal(result.isValid, false);
  assert.equal(result.extractedHandle, "avex.dex");
  assert.equal(result.isExplicitMismatch, true);
  assert.ok(result.error?.includes("@avex.dex"));
  assert.ok(result.error?.includes("@budi_kuliner"));
});

test("social-url: verifyContentOwnership meloloskan shortlink tanpa handle eksplisit", () => {
  const result = verifyContentOwnership({
    url: "https://vt.tiktok.com/ZSjXabc12/",
    platform: "TIKTOK",
    registeredHandle: "avex.dex",
  });

  assert.equal(result.isValid, true);
  assert.equal(result.extractedHandle, null);
  assert.equal(result.isExplicitMismatch, false);
});

test("social-url: verifyAuthorOwnership memeriksa kecocokan author metrik", () => {
  assert.equal(
    verifyAuthorOwnership({ author: "avex.dex", registeredHandle: "@Avex.Dex" }),
    true,
  );
  assert.equal(
    verifyAuthorOwnership({ author: "orang_lain", registeredHandle: "avex.dex" }),
    false,
  );
});
