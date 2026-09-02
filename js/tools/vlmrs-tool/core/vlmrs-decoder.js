import { VLMRS_CONSTANTS } from '../../../shared/constants.js';
import { CryptoUtils } from '../../../shared/crypto-utils.js';
import { UIUtils } from '../../../shared/ui-utils.js';
import { HeaderManager } from './header-manager.js';

export class VLMRSDecoder {
    /**
     * Auto-detects whether file buffer is wrapped Base64 text (.txt) or binary (.vlmrs)
     */
    static async detectAndNormalizeBuffer(buffer) {
        const uint8 = new Uint8Array(buffer);
        const textDecoder = new TextDecoder();
        const textStart = textDecoder.decode(uint8.subarray(0, 50));

        if (textStart.includes('-----BEGIN VLMRS')) {
            const textContent = textDecoder.decode(uint8);
            return VLMRSDecoder.parseBase64Text(textContent);
        }

        // Check binary magic bytes "VLMR"
        if (uint8[0] === 86 && uint8[1] === 76 && uint8[2] === 77 && uint8[3] === 82) {
            return buffer;
        }

        // Check if raw base64 string
        if (/^[A-Za-z0-9+/=\s]+$/.test(textStart)) {
            const textContent = textDecoder.decode(uint8);
            return VLMRSDecoder.parseBase64Text(textContent);
        }

        throw new Error('Unknown or corrupted VLMRS file format');
    }

    /**
     * Parses Base64 wrapped text content into ArrayBuffer
     */
    static parseBase64Text(text) {
        let base64String = text;
        const match = text.match(/-----BEGIN VLMRS v2-----\s*([\s\S]+?)\s*-----END VLMRS v2-----/);

        if (match) {
            base64String = match[1];
        }

        // Remove all whitespaces and line breaks
        base64String = base64String.replace(/\s+/g, '');
        const bytes = CryptoUtils.base64ToBuffer(base64String);
        return bytes.buffer;
    }

    /**
     * Extracts header info and plain metadata (if Mode B or V2) without requiring password
     */
    static extractMetadata(buffer) {
        const headerInfo = HeaderManager.parseHeader(buffer);
        let plainMetadata = null;

        if (headerInfo.version === 2 && headerInfo.plainMetaLength > 0) {
            const plainMetaOffset = headerInfo.payloadOffset + headerInfo.saltLength + headerInfo.ivLength + headerInfo.encryptedMetaLength;
            const plainMetaBytes = new Uint8Array(buffer, plainMetaOffset, headerInfo.plainMetaLength);
            const jsonStr = new TextDecoder().decode(plainMetaBytes);
            try {
                plainMetadata = JSON.parse(jsonStr);
            } catch (e) {
                console.warn("Failed to parse plain metadata:", e);
            }
        }

        return {
            headerInfo,
            plainMetadata
        };
    }

    /**
     * Decrypts a .vlmrs or .txt file buffer (supports V1 and V2 Full/Transparent, Binary and Base64)
     * @param {ArrayBuffer} rawBuffer
     * @param {string} password
     * @param {Object} options - { customBaseName?: string, index?: number, totalFiles?: number, progressCallback?: function }
     */
    static async decryptFile(rawBuffer, password = '', options = {}) {
        const { customBaseName = '', index = 0, totalFiles = 1, progressCallback = null } = (typeof options === 'function')
            ? { progressCallback: options }
            : options;

        if (progressCallback) progressCallback(5, "Detecting format & parsing header...");
        const buffer = await VLMRSDecoder.detectAndNormalizeBuffer(rawBuffer);
        const headerInfo = HeaderManager.parseHeader(buffer);

        let offset = headerInfo.payloadOffset;
        const salt = new Uint8Array(buffer, offset, headerInfo.saltLength); offset += headerInfo.saltLength;
        const iv = new Uint8Array(buffer, offset, headerInfo.ivLength); offset += headerInfo.ivLength;

        const encMetaOffset = offset;
        offset += headerInfo.encryptedMetaLength;

        const plainMetaOffset = offset;
        const plainMetaLength = headerInfo.plainMetaLength;
        offset += plainMetaLength;

        const fileCiphertextOffset = offset;
        const fileCiphertextLength = buffer.byteLength - fileCiphertextOffset;

        // Key Derivation
        if (progressCallback) progressCallback(30, "Deriving decryption key...");
        let derivedKey;

        if (headerInfo.version === 1) {
            derivedKey = await CryptoUtils.deriveKeyPBKDF2(password, salt, headerInfo.iterations);
        } else {
            if (headerInfo.mode === VLMRS_CONSTANTS.MODE_FULL) {
                derivedKey = await CryptoUtils.deriveKeyPBKDF2(password, salt, headerInfo.iterations);
            } else {
                // MODE B: TRANSPARENT
                const plainMetaBytes = new Uint8Array(buffer, plainMetaOffset, plainMetaLength);
                const jsonStr = new TextDecoder().decode(plainMetaBytes);
                const plainMeta = JSON.parse(jsonStr);

                if (plainMeta.encryption && plainMeta.encryption.passwordProtected) {
                    if (!password) {
                        throw new Error('Password required to decrypt content of this transparent file');
                    }
                    derivedKey = await CryptoUtils.deriveKeyPBKDF2(password, salt, headerInfo.iterations);
                } else {
                    // Deterministic key from salt
                    const detSalt = (plainMeta.encryption && plainMeta.encryption.keyDerivation && plainMeta.encryption.keyDerivation.salt)
                        ? CryptoUtils.base64ToBuffer(plainMeta.encryption.keyDerivation.salt)
                        : salt;
                    derivedKey = await CryptoUtils.deriveDeterministicKey(
                        detSalt,
                        headerInfo.iterations,
                        VLMRS_CONSTANTS.DETERMINISTIC_KEY_IDENTIFIER
                    );
                }
            }
        }

        // Decrypt Metadata (If present in V1 or V2 Full Mode)
        let decryptedMeta = null;
        if (headerInfo.encryptedMetaLength > 0) {
            if (progressCallback) progressCallback(50, "Decrypting metadata...");
            const encMetaBytes = new Uint8Array(buffer, encMetaOffset, headerInfo.encryptedMetaLength);

            let metaHeaderBuffer;
            if (headerInfo.version === 1) {
                metaHeaderBuffer = HeaderManager.buildHeaderV1({
                    saltLength: headerInfo.saltLength,
                    ivLength: headerInfo.ivLength,
                    encMetaLength: 0,
                    iterations: headerInfo.iterations
                });
            } else {
                metaHeaderBuffer = HeaderManager.buildHeaderV2({
                    mode: headerInfo.mode,
                    saltLength: headerInfo.saltLength,
                    ivLength: headerInfo.ivLength,
                    encMetaLength: 0,
                    plainMetaLength: 0,
                    iterations: headerInfo.iterations
                });
            }

            const metaAAD = HeaderManager.getMetadataAAD(metaHeaderBuffer, headerInfo.version);
            try {
                const metaPlaintextBuffer = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: iv, additionalData: metaAAD },
                    derivedKey,
                    encMetaBytes
                );
                const metaJsonStr = new TextDecoder().decode(metaPlaintextBuffer);
                decryptedMeta = JSON.parse(metaJsonStr);
            } catch (e) {
                throw new Error("Invalid password or corrupted file metadata");
            }
        }

        // Decrypt File Content
        if (progressCallback) progressCallback(75, "Decrypting file content...");
        const fileCiphertextBytes = new Uint8Array(buffer, fileCiphertextOffset, fileCiphertextLength);

        let fileAAD;
        if (headerInfo.version === 1) {
            const v1HeaderBuffer = HeaderManager.buildHeaderV1({
                saltLength: headerInfo.saltLength,
                ivLength: headerInfo.ivLength,
                encMetaLength: headerInfo.encryptedMetaLength,
                iterations: headerInfo.iterations
            });
            fileAAD = new Uint8Array(v1HeaderBuffer);
        } else {
            const v2HeaderBuffer = HeaderManager.buildHeaderV2({
                mode: headerInfo.mode,
                saltLength: headerInfo.saltLength,
                ivLength: headerInfo.ivLength,
                encMetaLength: headerInfo.encryptedMetaLength,
                plainMetaLength: headerInfo.plainMetaLength,
                iterations: headerInfo.iterations
            });
            const plainMetaBytes = plainMetaLength > 0
                ? new Uint8Array(buffer, plainMetaOffset, plainMetaLength)
                : null;
            fileAAD = HeaderManager.getFileAAD(v2HeaderBuffer, plainMetaBytes);
        }

        let decryptedFileBuffer;
        try {
            decryptedFileBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv, additionalData: fileAAD },
                derivedKey,
                fileCiphertextBytes
            );
        } catch (e) {
            throw new Error("Invalid password or corrupted file content");
        }

        if (progressCallback) progressCallback(95, "Verifying checksum...");

        // Determine original filename & type from metadata
        const activeMeta = decryptedMeta || VLMRSDecoder.extractMetadata(buffer).plainMetadata || {};

        let origBase = activeMeta.filename || "decrypted_file";
        let origExt = activeMeta.extension || "";
        let mimeType = activeMeta.mimeType || activeMeta.type || "application/octet-stream";

        if (!origExt && origBase.includes('.')) {
            const parsed = UIUtils.getBaseAndExt(origBase);
            origBase = parsed.base;
            origExt = parsed.ext;
        }

        const fullOriginalName = `${origBase}${origExt}`;
        const outputFilename = UIUtils.computeOutputFilename(fullOriginalName, customBaseName, index, totalFiles, origExt);

        if (activeMeta.hash) {
            const calculatedHash = await CryptoUtils.calculateSHA256Hex(decryptedFileBuffer);
            if (calculatedHash !== activeMeta.hash) {
                console.warn("SHA-256 hash mismatch! File might be corrupted.");
            }
        }

        if (progressCallback) progressCallback(100, "Decryption Complete!");

        return {
            decryptedBuffer: decryptedFileBuffer,
            filename: outputFilename,
            originalFilename: fullOriginalName,
            mimeType,
            size: decryptedFileBuffer.byteLength,
            metadata: activeMeta,
            headerInfo
        };
    }
}
