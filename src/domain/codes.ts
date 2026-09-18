import { randomInt } from "node:crypto";

// Tanpa huruf/angka yang mirip (0/O, 1/I) supaya kasir gampang membacanya
// dari layar HP creator.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Token yang ditempel creator di bio medsos untuk membuktikan kepemilikan akun. */
export function generateSocialVerifyToken() {
  const block = Array.from(
    { length: 6 },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join("");
  return `kontem-${block.toLowerCase()}`;
}
