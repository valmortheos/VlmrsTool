import { VLMRS_CONSTANTS } from '../../../shared/constants.js';
import { CryptoUtils } from '../../../shared/crypto-utils.js';
import { UIUtils } from '../../../shared/ui-utils.js';
import { HeaderManager } from './header-manager.js';
import { MetadataManager } from './metadata-manager.js';

export class VLMRSEncoder {
    /**
     * Encodes a single file buffer into .vlmrs binary format (Version 2)
     * @param {File} file
     * @param {Object} options - { mode: 'full'|'transparent', password?: string, customBaseName?: string, index?: number, totalFiles?: number, progressCallback?: function }
     */
    static async encodeFile(file, options) {
        const { mode = 'full', password = '', customBaseName = '', index = 0, totalFiles = 1, progressCallback } = options;
        const isTransparent = mode === 'transparent';
        const modeByte = isTransparent ? VLMRS_CONSTANTS.MODE_TRANSPARENT : VLMRS_CONSTANTS.MODE_FULL;
        const iterations = isTransparent ? VLMRS_CONSTANTS.ITERATIONS_TRANSPARENT : VLMRS_CONSTANTS.ITERATIONS_FULL;

        if (progressCallback) progressCallback(10, "Reading file...");
        const fileBuffer = await file.arrayBuffer();

        if (progressCallback) progressCallback(25, "Calculating checksums & keys...");
        const fileHashHex = await CryptoUtils.calculateSHA256Hex(fileBuffer);

        // Compute output filename: original name without original extension + .vlmrs
        const outputFilename = UIUtils.computeOutputFilename(file.name, customBaseName, index, totalFiles, '.vlmrs');

        // Generate Random IV
        const iv = crypto.getRandomValues(new Uint8Array(VLMRS_CONSTANTS.IV_LENGTH));
        let salt;
        let derivedKey;
        let plainMetadataObj = null;
        let plainMetaBytes = new Uint8Array(0);

        if (!isTransparent) {
            // MODE A: FULL ENCRYPTION
            salt = crypto.getRandomValues(new Uint8Array(VLMRS_CONSTANTS.SALT_LENGTH));
            derivedKey = await CryptoUtils.deriveKeyPBKDF2(password, salt, iterations);
        } else {
            // MODE B: TRANSPARENT ENCRYPTION
            if (password && password.length > 0) {
                salt = crypto.getRandomValues(new Uint8Array(VLMRS_CONSTANTS.SALT_LENGTH));
                derivedKey = await CryptoUtils.deriveKeyPBKDF2(password, salt, iterations);
            } else {
                // Deterministic / No Password
                const fileHashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
                salt = new Uint8Array(fileHashBuffer.slice(0, VLMRS_CONSTANTS.SALT_LENGTH));
                derivedKey = await CryptoUtils.deriveDeterministicKey(
                    salt,
                    iterations,
                    VLMRS_CONSTANTS.DETERMINISTIC_KEY_IDENTIFIER
                );
            }

            // Build Plain Metadata
            if (progressCallback) progressCallback(40, "Generating preview metadata...");
            const previewData = await MetadataManager.generatePreviewMetadata(file);

            plainMetadataObj = {
                filename: file.name,
                extension: '.' + (file.name.split('.').pop() || ''),
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                timestamp: file.lastModified || Date.now(),
                mode: 'transparent',
                vlmrsVersion: 2,
                encryption: {
                    method: 'AES-256-GCM',
                    passwordProtected: Boolean(password && password.length > 0),
                    keyDerivation: {
                        method: password ? 'pbkdf2' : 'deterministic-sha256',
                        salt: CryptoUtils.bufferToBase64(salt),
                        iterations: iterations
                    }
                },
                preview: previewData
            };

            const jsonStr = JSON.stringify(plainMetadataObj);
            plainMetaBytes = new TextEncoder().encode(jsonStr);
        }

        // Encrypt Metadata (Mode A only)
        let encMetaCiphertext = new Uint8Array(0);
        if (!isTransparent) {
            if (progressCallback) progressCallback(55, "Encrypting file metadata...");
            const metadataObj = {
                filename: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                lastModified: file.lastModified || Date.now(),
                hash: fileHashHex
            };
            const metaJsonBytes = new TextEncoder().encode(JSON.stringify(metadataObj));

            const tempHeaderForMetaAAD = HeaderManager.buildHeaderV2({
                mode: modeByte,
                saltLength: VLMRS_CONSTANTS.SALT_LENGTH,
                ivLength: VLMRS_CONSTANTS.IV_LENGTH,
                encMetaLength: 0,
                plainMetaLength: 0,
                iterations: iterations
            });
            const metaAAD = HeaderManager.getMetadataAAD(tempHeaderForMetaAAD, 2);

            const metaEncryptedBuffer = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv, additionalData: metaAAD },
                derivedKey,
                metaJsonBytes
            );
            encMetaCiphertext = new Uint8Array(metaEncryptedBuffer);
        }

        // Build Final V2 Header Buffer
        const finalHeaderBuffer = HeaderManager.buildHeaderV2({
            mode: modeByte,
            saltLength: VLMRS_CONSTANTS.SALT_LENGTH,
            ivLength: VLMRS_CONSTANTS.IV_LENGTH,
            encMetaLength: encMetaCiphertext.length,
            plainMetaLength: plainMetaBytes.length,
            iterations: iterations
        });

        // Encrypt File Ciphertext
        if (progressCallback) progressCallback(75, "Encrypting file content...");
        const fileAAD = HeaderManager.getFileAAD(finalHeaderBuffer, plainMetaBytes);

        const fileCiphertextBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv, additionalData: fileAAD },
            derivedKey,
            fileBuffer
        );
        const fileCiphertextBytes = new Uint8Array(fileCiphertextBuffer);

        // Assemble Final Payload
        if (progressCallback) progressCallback(90, "Assembling payload...");
        const totalSize = finalHeaderBuffer.byteLength + salt.length + iv.length + encMetaCiphertext.length + plainMetaBytes.length + fileCiphertextBytes.length;
        const resultBuffer = new Uint8Array(totalSize);

        let offset = 0;
        resultBuffer.set(new Uint8Array(finalHeaderBuffer), offset); offset += finalHeaderBuffer.byteLength;
        resultBuffer.set(salt, offset); offset += salt.length;
        resultBuffer.set(iv, offset); offset += iv.length;

        if (encMetaCiphertext.length > 0) {
            resultBuffer.set(encMetaCiphertext, offset); offset += encMetaCiphertext.length;
        }

        if (plainMetaBytes.length > 0) {
            resultBuffer.set(plainMetaBytes, offset); offset += plainMetaBytes.length;
        }

        resultBuffer.set(fileCiphertextBytes, offset);

        if (progressCallback) progressCallback(100, "Complete!");

        return {
            encodedBuffer: resultBuffer.buffer,
            outputFilename: outputFilename,
            originalName: file.name,
            mode: mode,
            plainMetadata: plainMetadataObj
        };
    }
}
