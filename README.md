🔐 VLMRS Tool

Secure client-side multi-file encoder & decoder dengan enkripsi AES-256-GCM. Seluruh proses dilakukan di browser, tanpa mengunggah file ke server.

✨ Fitur Utama

- 🛡️ AES-256-GCM dengan PBKDF2-HMAC-SHA-256
- 📁 Multi-file support untuk encode & decode
- 🔒 Encrypted metadata — nama file, MIME, dan informasi lainnya
- 🔐 Per-chunk encryption dengan nonce unik
- ✅ SHA-256 integrity verification
- 📦 ZIP & individual download
- 👁️ File preview — gambar, video, audio, PDF, dan teks
- 💾 Direct-to-disk streaming untuk file besar pada browser yang mendukung
- 🎨 Responsive modern UI
- 🔄 Drag & drop
- 📜 Operation history

🚀 Cara Pakai

Encode

1. Buka Encoder
2. Pilih atau drop file
3. Masukkan password
4. Klik Encode All Files
5. Simpan file ".vlmrs"

Decode

1. Buka Decoder
2. Pilih file ".vlmrs"
3. Masukkan password
4. Klik Decode & Preview All
5. Preview atau simpan file hasil decode

📐 Format VLMRS

VLMRS menggunakan container binary dengan metadata terenkripsi dan payload file yang diproses secara authenticated streaming.

VLMRS Container
├── Header
├── Salt
├── Encrypted Metadata
└── Encrypted File Chunks
    ├── Chunk 0
    ├── Chunk 1
    ├── Chunk 2
    └── ...

V3 menggunakan AES-256-GCM per chunk, nonce acak 12-byte, dan authenticated data untuk mengikat setiap chunk dengan header serta indeksnya.

🛡️ Keamanan

- AES-256-GCM untuk confidentiality dan authentication
- PBKDF2-HMAC-SHA-256 dengan 100.000 iterasi
- Random salt untuk setiap file
- Unique nonce untuk setiap encrypted chunk
- Encrypted metadata menyembunyikan informasi file
- SHA-256 untuk verifikasi integritas
- Seluruh proses enkripsi dan dekripsi dilakukan client-side

«⚠️ Password tidak disimpan oleh aplikasi. Kehilangan password berarti file tidak dapat didekripsi.»

💾 Streaming & Browser

V3 mendukung streaming untuk mengurangi penggunaan RAM saat memproses file besar.

Direct-to-disk streaming tersedia untuk single-file pada browser yang mendukung File System Access API. Browser lain menggunakan fallback Blob.

V1/V2 hanya didukung untuk kompatibilitas legacy dan memiliki batas ukuran 250 MB.

🛠️ Instalasi

Tidak membutuhkan Node.js atau backend.

git clone https://github.com/valmortheos/VlmrsTool.git
cd VlmrsTool

Kemudian buka "index.html" di browser modern.

Local server juga dapat digunakan:

python -m http.server 8080

📁 Struktur

VlmrsTool/
├── index.html
├── style.css
├── script.js
├── vlmrs-streaming.js
└── README.md

🌐 Browser Support

Browser| Support
Chrome| ✅
Edge| ✅
Firefox| ✅
Safari| ✅

📦 Dependencies

- JSZip — bulk ZIP download
- Web Crypto API — cryptographic operations
- Vanilla JavaScript

📄 Lisensi

MIT — bebas digunakan, dimodifikasi, dan didistribusikan.

---

<div align="center">
  <sub>Dibuat dengan ❤️ oleh <a href="https://github.com/valmortheos">@valmortheos</a></sub>
</div>
