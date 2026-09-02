import { VLMRS_CONSTANTS } from '../../../shared/constants.js';

export class MetadataManager {
    /**
     * Generates preview metadata based on file type
     */
    static async generatePreviewMetadata(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const type = file.type || '';

        try {
            // IMAGE
            if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
                return await MetadataManager.generateImageThumbnail(file);
            }

            // TEXT FILES
            if (type.startsWith('text/') || ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'csv', 'xml', 'py'].includes(ext)) {
                return await MetadataManager.generateTextSnippet(file);
            }

            // VIDEO
            if (type.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext)) {
                return await MetadataManager.generateVideoMetadata(file);
            }

            // AUDIO
            if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
                return {
                    type: "audio",
                    thumbnail: null,
                    description: `Audio file (${ext.toUpperCase()})`
                };
            }

            // PDF
            if (type === 'application/pdf' || ext === 'pdf') {
                return {
                    type: "pdf",
                    thumbnail: null,
                    description: "PDF Document"
                };
            }
        } catch (e) {
            console.warn("Failed to generate preview metadata:", e);
        }

        // BINARY / DEFAULT FALLBACK
        return {
            type: "binary",
            thumbnail: null,
            description: "Binary file - preview unavailable"
        };
    }

    /**
     * Generates scaled canvas image thumbnail (JPEG base64)
     */
    static async generateImageThumbnail(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                const MAX_DIM = VLMRS_CONSTANTS.PREVIEW.MAX_IMAGE_DIMENSION;
                const MAX_BYTES = VLMRS_CONSTANTS.PREVIEW.MAX_THUMBNAIL_BYTES;

                let width = img.width;
                let height = img.height;

                if (width > MAX_DIM || height > MAX_DIM) {
                    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.8;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);

                while (dataUrl.length > MAX_BYTES && quality > 0.3) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                URL.revokeObjectURL(objectUrl);
                resolve({
                    type: "image",
                    thumbnail: dataUrl,
                    width: width,
                    height: height
                });
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve({
                    type: "image",
                    thumbnail: null,
                    description: "Image file"
                });
            };

            img.src = objectUrl;
        });
    }

    /**
     * Reads text snippet (first N characters)
     */
    static async generateTextSnippet(file) {
        try {
            const text = await file.text();
            return {
                type: "text",
                thumbnail: null,
                snippet: text.slice(0, VLMRS_CONSTANTS.PREVIEW.MAX_TEXT_SNIPPET_CHARS),
                lineCount: text.split('\n').length
            };
        } catch (e) {
            return {
                type: "text",
                thumbnail: null,
                snippet: null
            };
        }
    }

    /**
     * Video metadata helper
     */
    static async generateVideoMetadata(file) {
        return {
            type: "video",
            thumbnail: null,
            description: "Video file"
        };
    }
}
