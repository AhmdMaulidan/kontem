# Foto demo

Foto tempat untuk **data seed saja**, bukan aset produk. Sumbernya
[Lorem Picsum](https://picsum.photos) — foto Unsplash yang disajikan ulang
dengan [lisensi Unsplash](https://unsplash.com/license): bebas dipakai
termasuk untuk komersial, tanpa kewajiban atribusi.

Jalur berkasnya mengikuti kolom `photos` pada `prisma/seed.ts`. Kalau vendor
demo di seed ditambah atau diganti namanya, berkas di sini ikut disesuaikan —
jalur yang menunjuk berkas tak ada membuat `next/image` mengembalikan 400 dan
kartunya tampil kosong.

| Berkas | Dipakai vendor demo |
| :--- | :--- |
| `kopi-senja-1.jpg` | Bakso Malang Enggal Rawamangun (Kuliner) |
| `kopi-senja-2.jpg` | Kopi Toko Djawa Menteng (Kuliner) |
| `kafe-arsip-1.jpg` | Petak Enam di Gedung Chandra (Kuliner) |
| `coban-1.jpg` | Wisata Alam Coban Rondo & Taman Labirin (Wisata Alam) |
| `mbokdar-1.jpg` | Warung Sego Sambel Marem Malang (Kuliner) |
| `pantai-lestari-1.jpg` | *(belum dipakai)* |
| `danau-tirta-1.jpg` | *(belum dipakai)* |
| `panggung-kota-1.jpg` | *(belum dipakai)* |

Nama berkas mengikuti narasi versi lama seed (Kopi Senja, Kafe Arsip, dst) —
sengaja **tidak diubah namanya** biar tidak perlu re-upload; yang penting
kolom `photos` di atas menunjuk ke berkas yang benar-benar ada. Tiga berkas
terakhir masih tersedia untuk dipakai kalau ada vendor demo baru.

**Jangan pakai berkas di folder ini untuk halaman produk.** Ini foto stok yang
tidak ada hubungannya dengan outlet sungguhan; begitu vendor asli mengunggah
fotonya sendiri, kolom `photos` yang dipakai.
