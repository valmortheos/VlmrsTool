/**
 * VLMRS v3 Progressive SHA-256 Engine (Pure JS, O(1) Memory)
 * Standard FIPS 180-4 SHA-256 implementation supporting chunked update() and digest().
 */
export class ProgressiveSHA256 {
    constructor() {
        this.K = new Uint32Array([
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ]);
        this.reset();
    }

    reset() {
        this.H = new Uint32Array([
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        ]);
        this.block = new Uint8Array(64);
        this.blockLen = 0;
        this.totalLen = 0;
        this.W = new Uint32Array(64);
    }

    _processBlock(b) {
        const W = this.W;
        for (let i = 0; i < 16; i++) {
            W[i] = (b[i * 4] << 24) | (b[i * 4 + 1] << 16) | (b[i * 4 + 2] << 8) | (b[i * 4 + 3]);
        }
        for (let i = 16; i < 64; i++) {
            const s0 = (W[i - 15] >>> 7 | W[i - 15] << 25) ^ (W[i - 15] >>> 18 | W[i - 15] << 14) ^ (W[i - 15] >>> 3);
            const s1 = (W[i - 2] >>> 17 | W[i - 2] << 15) ^ (W[i - 2] >>> 19 | W[i - 2] << 13) ^ (W[i - 2] >>> 10);
            W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
        }

        let a = this.H[0], b_val = this.H[1], c = this.H[2], d = this.H[3];
        let e = this.H[4], f = this.H[5], g = this.H[6], h = this.H[7];

        for (let i = 0; i < 64; i++) {
            const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
            const ch = (e & f) ^ ((~e) & g);
            const temp1 = (h + S1 + ch + this.K[i] + W[i]) | 0;
            const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
            const maj = (a & b_val) ^ (a & c) ^ (b_val & c);
            const temp2 = (S0 + maj) | 0;

            h = g; g = f; f = e; e = (d + temp1) | 0;
            d = c; c = b_val; b_val = a; a = (temp1 + temp2) | 0;
        }

        this.H[0] = (this.H[0] + a) | 0; this.H[1] = (this.H[1] + b_val) | 0;
        this.H[2] = (this.H[2] + c) | 0; this.H[3] = (this.H[3] + d) | 0;
        this.H[4] = (this.H[4] + e) | 0; this.H[5] = (this.H[5] + f) | 0;
        this.H[6] = (this.H[6] + g) | 0; this.H[7] = (this.H[7] + h) | 0;
    }

    update(chunk) {
        const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        let offset = 0;
        this.totalLen += bytes.length;

        if (this.blockLen > 0) {
            const fill = Math.min(64 - this.blockLen, bytes.length);
            this.block.set(bytes.subarray(0, fill), this.blockLen);
            this.blockLen += fill;
            offset += fill;
            if (this.blockLen === 64) {
                this._processBlock(this.block);
                this.blockLen = 0;
            }
        }

        while (offset + 64 <= bytes.length) {
            this._processBlock(bytes.subarray(offset, offset + 64));
            offset += 64;
        }

        if (offset < bytes.length) {
            const rem = bytes.subarray(offset);
            this.block.set(rem, 0);
            this.blockLen = rem.length;
        }
    }

    digestHex() {
        const bits = this.totalLen * 8;
        const padLen = (this.blockLen < 56) ? (56 - this.blockLen) : (120 - this.blockLen);
        const pad = new Uint8Array(padLen + 8);
        pad[0] = 0x80;

        // Append 64-bit big-endian bit length
        const highBits = Math.floor(bits / 0x100000000);
        const lowBits = bits % 0x100000000;
        pad[padLen] = (highBits >>> 24) & 0xff;
        pad[padLen + 1] = (highBits >>> 16) & 0xff;
        pad[padLen + 2] = (highBits >>> 8) & 0xff;
        pad[padLen + 3] = highBits & 0xff;
        pad[padLen + 4] = (lowBits >>> 24) & 0xff;
        pad[padLen + 5] = (lowBits >>> 16) & 0xff;
        pad[padLen + 6] = (lowBits >>> 8) & 0xff;
        pad[padLen + 7] = lowBits & 0xff;

        this.update(pad);

        let hex = '';
        for (let i = 0; i < 8; i++) {
            hex += this.H[i].toString(16).padStart(8, '0');
        }
        return hex;
    }
}

/**
 * VLMRS v3 Constant-RAM Chunk Streaming Engine
 */
export const CHUNK_SIZE = 1024 * 1024; // 1 MB plaintext chunk size

export async function calculateSHA256Progressive(file, onProgress) {
    const sha = new ProgressiveSHA256();
    let offset = 0;
    const total = file.size;

    while (offset < total) {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buf = await slice.arrayBuffer();
        sha.update(new Uint8Array(buf));
        offset += buf.byteLength;
        if (onProgress) onProgress(offset, total);
    }

    return sha.digestHex();
}

export async function* encodeV3Stream(file, password, iterations = 100000, onProgress = null) {
    const totalSize = file.size;
    const cryptoObj = (typeof window !== 'undefined' && window.crypto) ? window.crypto : (await import('crypto')).webcrypto;

    // 1. Calculate file SHA-256 progressively
    const fileHash = await calculateSHA256Progressive(file, (done, total) => {
        if (onProgress) onProgress(0.2 * (done / total), `Hashing file...`);
    });

    const lastDot = file.name.lastIndexOf('.');
    const origName = lastDot !== -1 && lastDot !== 0 ? file.name.substring(0, lastDot) : file.name;
    const origExt = lastDot !== -1 && lastDot !== 0 ? file.name.substring(lastDot) : '';

    const meta = {
        filename: origName,
        extension: origExt,
        mimeType: file.type || 'application/octet-stream',
        timestamp: Date.now(),
        vlmrsVersion: 3,
        chunkSize: CHUNK_SIZE,
        encryption: "AES-256-GCM",
        kdf: { algorithm: "PBKDF2-HMAC-SHA-256", iterations: iterations },
        tool: "VLMRS Encoder",
        credit: "@valmortheos",
        fileHash: fileHash
    };

    const salt = cryptoObj.getRandomValues(new Uint8Array(16));
    const metaIv = cryptoObj.getRandomValues(new Uint8Array(12));

    const passBytes = new TextEncoder().encode(password);
    const keyMaterial = await cryptoObj.subtle.importKey("raw", passBytes, "PBKDF2", false, ["deriveKey"]);
    passBytes.fill(0);

    const key = await cryptoObj.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

    const metaString = JSON.stringify(meta);
    const metaBytes = new TextEncoder().encode(metaString);

    // Header (15B)
    const headerBuf = new ArrayBuffer(15);
    const headerView = new DataView(headerBuf);
    const header8 = new Uint8Array(headerBuf);
    header8[0] = 86; header8[1] = 76; header8[2] = 77; header8[3] = 82; // "VLMR"
    header8[4] = 3; // Version 3
    header8[5] = 16; // Salt Len
    header8[6] = 12; // IV Len
    headerView.setUint32(7, 0, true);
    headerView.setUint32(11, iterations, true);

    const metadataAAD = new Uint8Array(headerBuf.slice(0));
    const encryptedMeta = await cryptoObj.subtle.encrypt(
        { name: "AES-GCM", iv: metaIv, additionalData: metadataAAD },
        key,
        metaBytes
    );
    metaBytes.fill(0);

    headerView.setUint32(7, encryptedMeta.byteLength, true);

    // Yield initial metadata header
    // Header(15) + Salt(16) + MetaIV(12) + EncryptedMeta
    const initPart = new Uint8Array(15 + 16 + 12 + encryptedMeta.byteLength);
    let off = 0;
    initPart.set(new Uint8Array(headerBuf), off); off += 15;
    initPart.set(salt, off); off += 16;
    initPart.set(metaIv, off); off += 12;
    initPart.set(new Uint8Array(encryptedMeta), off);

    yield initPart;

    // 2. Stream chunk encryption
    let readOffset = 0;
    let chunkIndex = 0;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE) || 1;

    const fileAAD = new Uint8Array(headerBuf);

    while (readOffset < totalSize || (totalSize === 0 && chunkIndex === 0)) {
        const slice = file.slice(readOffset, readOffset + CHUNK_SIZE);
        const chunkBuf = await slice.arrayBuffer();
        const chunkBytes = new Uint8Array(chunkBuf);

        const chunkIv = cryptoObj.getRandomValues(new Uint8Array(12));
        const isLast = (readOffset + CHUNK_SIZE >= totalSize);

        // Chunk AAD: File AAD (15B) + ChunkIndex (4B, LE) + IsLast (1B)
        const chunkAADBuf = new Uint8Array(15 + 4 + 1);
        chunkAADBuf.set(fileAAD, 0);
        const chunkAADView = new DataView(chunkAADBuf.buffer);
        chunkAADView.setUint32(15, chunkIndex, true);
        chunkAADBuf[19] = isLast ? 1 : 0;

        const encryptedChunk = await cryptoObj.subtle.encrypt(
            { name: "AES-GCM", iv: chunkIv, additionalData: chunkAADBuf },
            key,
            chunkBytes.buffer
        );
        try { chunkBytes.fill(0); } catch(e){}

        // Chunk wire format: ChunkIV (12B) + PayloadLength (4B, LE) + EncryptedChunkPayload
        const encryptedChunkBytes = new Uint8Array(encryptedChunk);
        const chunkWire = new Uint8Array(12 + 4 + encryptedChunkBytes.byteLength);
        chunkWire.set(chunkIv, 0);
        const wireView = new DataView(chunkWire.buffer);
        wireView.setUint32(12, encryptedChunkBytes.byteLength, true);
        chunkWire.set(encryptedChunkBytes, 16);

        yield chunkWire;

        readOffset += CHUNK_SIZE;
        chunkIndex++;

        if (onProgress) {
            onProgress(0.2 + 0.8 * (Math.min(readOffset, totalSize) / Math.max(totalSize, 1)), `Encrypting chunk ${chunkIndex}/${totalChunks}...`);
        }
    }
}

export async function* decodeV3Stream(fileOrBlob, password, onProgress = null) {
    const cryptoObj = (typeof window !== 'undefined' && window.crypto) ? window.crypto : (await import('crypto')).webcrypto;

    // Read header & encrypted metadata
    const headerSlice = fileOrBlob.slice(0, 15);
    const headerBuf = await headerSlice.arrayBuffer();
    if (headerBuf.byteLength < 15) throw new Error("File too short for VLMRS header");

    const headerView = new DataView(headerBuf);
    const header8 = new Uint8Array(headerBuf);

    if (header8[0] !== 86 || header8[1] !== 76 || header8[2] !== 77 || header8[3] !== 82) {
        throw new Error("Invalid VLMRS magic header");
    }

    const version = header8[4];
    if (version !== 3) {
        throw new Error(`Unsupported stream version ${version}`);
    }

    const saltLen = header8[5];
    const ivLen = header8[6];
    const encryptedMetaLen = headerView.getUint32(7, true);
    const iterations = headerView.getUint32(11, true);

    const initHeaderTotal = 15 + saltLen + ivLen + encryptedMetaLen;
    const initSlice = fileOrBlob.slice(0, initHeaderTotal);
    const initBuf = await initSlice.arrayBuffer();
    if (initBuf.byteLength < initHeaderTotal) throw new Error("Truncated header metadata");

    const salt = new Uint8Array(initBuf.slice(15, 15 + saltLen));
    const metaIv = new Uint8Array(initBuf.slice(15 + saltLen, 15 + saltLen + ivLen));
    const encryptedMeta = initBuf.slice(15 + saltLen + ivLen, initHeaderTotal);

    const metadataAAD = new Uint8Array(initBuf.slice(0, 15));
    const metadataAADView = new DataView(metadataAAD.buffer);
    metadataAADView.setUint32(7, 0, true);

    const passBytes = new TextEncoder().encode(password);
    const keyMaterial = await cryptoObj.subtle.importKey("raw", passBytes, "PBKDF2", false, ["deriveKey"]);
    passBytes.fill(0);

    const key = await cryptoObj.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    let metadata;
    try {
        const decryptedMetaBuf = await cryptoObj.subtle.decrypt(
            { name: "AES-GCM", iv: metaIv, additionalData: metadataAAD },
            key,
            encryptedMeta
        );
        const metaStr = new TextDecoder().decode(decryptedMetaBuf);
        try { new Uint8Array(decryptedMetaBuf).fill(0); } catch(e){}
        metadata = JSON.parse(metaStr);
    } catch(e) {
        throw new Error("Failed to decrypt metadata - incorrect password or corrupted file");
    }

    const fileAAD = new Uint8Array(initBuf.slice(0, 15));
    let fileOffset = initHeaderTotal;
    const totalFileSize = fileOrBlob.size;
    let chunkIndex = 0;
    let isLastChunk = false;

    const sha = new ProgressiveSHA256();

    // Store metadata on generator for caller access
    yield { type: 'metadata', metadata };

    while (fileOffset < totalFileSize) {
        // Read Chunk Header: IV (12B) + PayloadLen (4B) = 16B
        const chunkHeadSlice = fileOrBlob.slice(fileOffset, fileOffset + 16);
        const chunkHeadBuf = await chunkHeadSlice.arrayBuffer();
        if (chunkHeadBuf.byteLength < 16) throw new Error("Truncated chunk header");

        const chunkIv = new Uint8Array(chunkHeadBuf.slice(0, 12));
        const payloadLen = new DataView(chunkHeadBuf).getUint32(12, true);

        const chunkDataStart = fileOffset + 16;
        const chunkDataEnd = chunkDataStart + payloadLen;
        if (chunkDataEnd > totalFileSize) throw new Error("Truncated chunk payload");

        const chunkPayloadSlice = fileOrBlob.slice(chunkDataStart, chunkDataEnd);
        const chunkPayloadBuf = await chunkPayloadSlice.arrayBuffer();

        isLastChunk = (chunkDataEnd === totalFileSize);

        // Reconstruct chunk AAD
        const chunkAADBuf = new Uint8Array(15 + 4 + 1);
        chunkAADBuf.set(fileAAD, 0);
        const chunkAADView = new DataView(chunkAADBuf.buffer);
        chunkAADView.setUint32(15, chunkIndex, true);
        chunkAADBuf[19] = isLastChunk ? 1 : 0;

        let decryptedChunkBuf;
        try {
            decryptedChunkBuf = await cryptoObj.subtle.decrypt(
                { name: "AES-GCM", iv: chunkIv, additionalData: chunkAADBuf },
                key,
                chunkPayloadBuf
            );
        } catch(e) {
            throw new Error(`Failed to decrypt chunk ${chunkIndex} - corrupted ciphertext or wrong key`);
        }

        const decryptedBytes = new Uint8Array(decryptedChunkBuf);
        sha.update(decryptedBytes);

        yield { type: 'chunk', data: decryptedBytes, index: chunkIndex };

        fileOffset = chunkDataEnd;
        chunkIndex++;

        if (onProgress) {
            onProgress(fileOffset / totalFileSize, `Decrypting chunk ${chunkIndex}...`);
        }
    }

    // Verify hash integrity
    if (metadata && metadata.fileHash) {
        const computedHash = sha.digestHex();
        if (computedHash !== metadata.fileHash) {
            throw new Error(`File integrity verification failed for ${metadata.filename || 'file'} - SHA-256 hash mismatch!`);
        }
    }
}
