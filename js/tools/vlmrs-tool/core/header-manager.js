import { VLMRS_CONSTANTS } from '../../../shared/constants.js';

export class HeaderManager {
    static MAGIC_STRING = VLMRS_CONSTANTS.MAGIC_STRING;
    static VERSION_1 = VLMRS_CONSTANTS.VERSION_1;
    static VERSION_2 = VLMRS_CONSTANTS.VERSION_2;

    /**
     * Build Version 1 Header (15 bytes)
     */
    static buildHeaderV1({ saltLength = 16, ivLength = 12, encMetaLength, iterations = 100000 }) {
        const buffer = new ArrayBuffer(VLMRS_CONSTANTS.HEADER_V1_SIZE);
        const view = new DataView(buffer);
        const uint8 = new Uint8Array(buffer);

        // Magic "VLMR"
        uint8.set(VLMRS_CONSTANTS.MAGIC_BYTES, 0);
        // Version 1
        uint8[4] = VLMRS_CONSTANTS.VERSION_1;
        // Salt & IV Lengths
        uint8[5] = saltLength;
        uint8[6] = ivLength;
        // Encrypted Meta Length (Uint32 Little Endian)
        view.setUint32(7, encMetaLength, true);
        // Iterations (Uint32 Little Endian)
        view.setUint32(11, iterations, true);

        return buffer;
    }

    /**
     * Build Version 2 Header (24 bytes)
     */
    static buildHeaderV2({ mode, saltLength = 16, ivLength = 12, encMetaLength = 0, plainMetaLength = 0, iterations = 50000 }) {
        const buffer = new ArrayBuffer(VLMRS_CONSTANTS.HEADER_V2_SIZE);
        const view = new DataView(buffer);
        const uint8 = new Uint8Array(buffer);

        // Magic "VLMR"
        uint8.set(VLMRS_CONSTANTS.MAGIC_BYTES, 0);
        // Version 2
        uint8[4] = VLMRS_CONSTANTS.VERSION_2;
        // Mode (0x00 = Full, 0x01 = Transparent)
        uint8[5] = mode;
        // Salt & IV Lengths
        uint8[6] = saltLength;
        uint8[7] = ivLength;

        // Encrypted Meta Length (4 bytes LE)
        view.setUint32(8, encMetaLength, true);
        // Plain Meta Length (4 bytes LE)
        view.setUint32(12, plainMetaLength, true);
        // Iterations (4 bytes LE)
        view.setUint32(16, iterations, true);
        // Padding/Reserved (4 bytes LE, set to 0)
        view.setUint32(20, 0, true);

        return buffer;
    }

    /**
     * Parse header from file ArrayBuffer (supports auto-detecting V1 and V2)
     */
    static parseHeader(buffer) {
        if (buffer.byteLength < VLMRS_CONSTANTS.HEADER_V1_SIZE) {
            throw new Error('File buffer is too short to contain a valid header');
        }

        const uint8 = new Uint8Array(buffer);

        // Validate Magic "VLMR"
        if (uint8[0] !== 86 || uint8[1] !== 76 || uint8[2] !== 77 || uint8[3] !== 82) {
            throw new Error('Invalid magic bytes. Not a VLMRS file.');
        }

        const version = uint8[4];
        const view = new DataView(buffer);

        if (version === VLMRS_CONSTANTS.VERSION_1) {
            const saltLength = uint8[5];
            const ivLength = uint8[6];
            const encryptedMetaLength = view.getUint32(7, true);
            const iterations = view.getUint32(11, true);

            return {
                version: 1,
                headerLength: VLMRS_CONSTANTS.HEADER_V1_SIZE,
                mode: VLMRS_CONSTANTS.MODE_FULL, // V1 is always Full
                saltLength,
                ivLength,
                encryptedMetaLength,
                plainMetaLength: 0,
                iterations,
                payloadOffset: VLMRS_CONSTANTS.HEADER_V1_SIZE
            };
        } else if (version === VLMRS_CONSTANTS.VERSION_2) {
            if (buffer.byteLength < VLMRS_CONSTANTS.HEADER_V2_SIZE) {
                throw new Error('File buffer is too short to contain a valid V2 header');
            }

            const mode = uint8[5];
            const saltLength = uint8[6];
            const ivLength = uint8[7];
            const encryptedMetaLength = view.getUint32(8, true);
            const plainMetaLength = view.getUint32(12, true);
            const iterations = view.getUint32(16, true);

            return {
                version: 2,
                headerLength: VLMRS_CONSTANTS.HEADER_V2_SIZE,
                mode,
                saltLength,
                ivLength,
                encryptedMetaLength,
                plainMetaLength,
                iterations,
                payloadOffset: VLMRS_CONSTANTS.HEADER_V2_SIZE
            };
        } else {
            throw new Error(`Unsupported VLMRS version: ${version}`);
        }
    }

    /**
     * Generates AAD for Metadata encryption (V1 or V2 with encMetaLen = 0)
     */
    static getMetadataAAD(headerBuffer, version = VLMRS_CONSTANTS.VERSION_2) {
        const aadBuffer = headerBuffer.slice(0);
        const view = new DataView(aadBuffer);

        if (version === VLMRS_CONSTANTS.VERSION_1) {
            view.setUint32(7, 0, true);
        } else if (version === VLMRS_CONSTANTS.VERSION_2) {
            view.setUint32(8, 0, true);
        }
        return new Uint8Array(aadBuffer);
    }

    /**
     * Generates AAD for File Ciphertext encryption
     * Mode A: Header V2
     * Mode B: Header V2 + Plain Metadata bytes
     */
    static getFileAAD(headerBuffer, plainMetadataBytes = null) {
        if (!plainMetadataBytes || plainMetadataBytes.length === 0) {
            return new Uint8Array(headerBuffer);
        }

        const aad = new Uint8Array(headerBuffer.byteLength + plainMetadataBytes.length);
        aad.set(new Uint8Array(headerBuffer), 0);
        aad.set(plainMetadataBytes, headerBuffer.byteLength);
        return aad;
    }
}
