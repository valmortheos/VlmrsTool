# 🔐 VLMRS Tool

Secure client-side multi-file encoder & decoder dengan enkripsi AES-256-GCM. Semua proses berjalan di browser, file Anda tidak pernah meninggalkan perangkat.

## ✨ Fitur Utama

- 🛡️ **Enkripsi AES-256-GCM** dengan PBKDF2 key derivation (100.000 iterasi)
- 📁 **Multi-file support** — encode/decode banyak file sekaligus
- 🔒 **Metadata terenkripsi** — nama file, timestamp, dan hash tersembunyi dari mata-mata
- ✅ **Integritas terverifikasi** — SHA-256 hash memastikan file tidak korup
- 📦 **Bulk download** — simpan semua file sebagai ZIP atau unduh satu per satu
- 👁️ **Preview file** — lihat gambar, video, audio, PDF, dan teks sebelum download
- 📊 **History operasi** — lacak aktivitas encode/decode (tersimpan di IndexedDB)
- 🎨 **UI modern** — dark-mode friendly, responsive, dan intuitif
- 🔄 **Drag & drop** — cukup seret file ke halaman

## 🚀 Cara Pakai

### Encode
1. Buka tab **Encoder**
2. Drop file (atau klik untuk browse) — bisa multiple
3. Masukkan password kuat
4. Klik **Encode All Files**
5. Download hasilnya — individual atau ZIP

### Decode
1. Buka tab **Decoder**
2. Drop file `.vlmrs`
3. Masukkan password yang sama
4. Klik **Decode & Preview All**
5. Preview dan download file asli

## 🔧 Struktur File

```
vlmrs-tool/
├── index.html      # Markup utama
├── style.css       # Styling
├── script.js       # Logika encode/decode
└── README.md
```

## 📐 Format VLMRS

```
Header (15 bytes)
├── Magic: "VLMR" (4 bytes)
├── Version: 1 (1 byte)
├── Salt Length: 16 (1 byte)
├── IV Length: 12 (1 byte)
├── Encrypted Meta Length (4 bytes, LE)
└── Iterations (4 bytes, LE)

Payload
├── Salt (16 bytes)
├── IV (12 bytes)
├── Encrypted Metadata (AES-GCM)
└── File Ciphertext (AES-GCM)
```

## 🛡️ Keamanan

- **AES-256-GCM** menyediakan enkripsi + autentikasi
- **PBKDF2-HMAC-SHA-256** dengan 100.000 iterasi + salt unik per file
- **AAD terpisah** untuk metadata dan file mencegah tampering
- **Semua proses client-side** — zero upload, zero server
- **Metadata tersembunyi** — nama file, ukuran, dan info lainnya terenkripsi

> ⚠️ **Peringatan**: File > 200 MB dapat menyebabkan lag browser karena keterbatasan memori.

## 📦 Dependencies

- [JSZip](https://stuk.github.io/jszip/) — untuk bulk download ZIP (CDN)
- Sisanya vanilla JavaScript + Web Crypto API

## 🖥️ Browser Support

| Browser | Support |
|---------|---------|
| Chrome  | ✅      |
| Firefox | ✅      |
| Safari  | ✅      |
| Edge    | ✅      |

## 🤝 Kontribusi

Pull request selalu diterima! Untuk perubahan besar, buka issue dulu untuk diskusi.

## 📄 Lisensi

MIT — bebas dipakai, dimodifikasi, dan didistribusikan.

---

<div align="center">
  <sub>Dibuat dengan ❤️ oleh <a href="https://github.com/valmortheos">@valmortheos</a></sub>
</div>
