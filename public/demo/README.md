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
| `kopi-senja-1.jpg`, `kopi-senja-2.jpg` | Kopi Senja Malang (Kuliner) |
| `coban-1.jpg` | Wisata Coban Tirta (Wisata Alam) |
| `mbokdar-1.jpg` | Sambal Mbok Dar (Kuliner) |
| `kafe-arsip-1.jpg` | Kafe Arsip Surabaya (Kuliner) |
| `pantai-lestari-1.jpg` | Pantai Lestari Gunungkidul (Wisata Alam) |
| `danau-tirta-1.jpg` | Danau Tirta Recreation Park (Wisata Buatan) |
| `panggung-kota-1.jpg` | Panggung Kota Semarang (Lainnya) |

**Jangan pakai berkas di folder ini untuk halaman produk.** Ini foto stok yang
tidak ada hubungannya dengan outlet sungguhan; begitu vendor asli mengunggah
fotonya sendiri, kolom `photos` yang dipakai.
