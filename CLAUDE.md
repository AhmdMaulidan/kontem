@AGENTS.md
@design.md
@CONVENTIONS.md

# Instruksi Pengembangan untuk Claude
- Selalu jadikan `design.md` sebagai acuan utama (single source of truth) untuk visual style, sistem warna, komponen UI, arsitektur role (Creator, Vendor, Admin), serta alur kerja guardrail (Escrow, Redeem Code, Dispute).
- Pertahankan estetika visual modern, cerah, ramah, dan bernilai tinggi sesuai spesifikasi pada `design.md`.
- Patuhi `CONVENTIONS.md` untuk struktur folder, penempatan file baru, pola server action, dan gaya penulisan kode. Sebelum membuat file baru, tentukan dulu lapisannya (`app/`, `components/`, `domain/`, atau `lib/`) memakai tabel pada bagian "Menaruh File Baru".
- Sebelum menyatakan pekerjaan selesai, jalankan `pnpm typecheck`, `pnpm lint`, `pnpm test`, dan `pnpm build`.
