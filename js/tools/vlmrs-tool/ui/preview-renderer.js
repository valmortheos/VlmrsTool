import { UIUtils } from '../../../shared/ui-utils.js';

export class PreviewRenderer {
    /**
     * Renders Mode B unencrypted preview and ALL metadata fields from plainMetadata
     */
    static renderTransparentPreview(container, plainMetadata, headerInfo = null) {
        if (!container) return;
        container.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'transparent-preview-card';

        const filename = plainMetadata.filename || 'file';
        const extension = plainMetadata.extension || '';
        const fullFilename = `${filename}${extension}`;

        const title = document.createElement('div');
        title.className = 'preview-title';
        title.innerHTML = `<strong>📁 ${fullFilename}</strong> <span class="badge badge-success">Transparent Mode</span>`;
        card.appendChild(title);

        const previewContent = document.createElement('div');
        previewContent.className = 'preview-body';

        const preview = plainMetadata.preview || {};

        if (preview.type === 'image' && preview.thumbnail) {
            previewContent.innerHTML = `<img src="${preview.thumbnail}" alt="Thumbnail Preview" class="preview-img-thumb">`;
        } else if (preview.type === 'text' && preview.snippet) {
            previewContent.innerHTML = `<pre class="preview-text-snippet"><code>${PreviewRenderer.escapeHtml(preview.snippet)}...</code></pre>`;
        } else {
            previewContent.innerHTML = `<div class="preview-fallback"><svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg><p>${preview.description || 'No visual preview available without decryption'}</p></div>`;
        }

        card.appendChild(previewContent);

        // Comprehensive Enhanced Metadata Table
        const metadataTable = PreviewRenderer.buildMetadataTable(plainMetadata, headerInfo);
        card.appendChild(metadataTable);

        container.appendChild(card);
    }

    /**
     * Renders decrypted file full preview and ALL metadata fields
     */
    static renderDecryptedPreview(container, fileBuffer, filename, mimeType, metadata = {}, headerInfo = null) {
        if (!container) return;
        container.innerHTML = '';

        const blob = new Blob([fileBuffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const ext = filename.split('.').pop().toLowerCase();

        const wrapper = document.createElement('div');
        wrapper.className = 'decrypted-preview-wrapper';

        if (mimeType.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg'].includes(ext)) {
            const img = document.createElement('img');
            img.src = url;
            img.className = 'full-preview-img';
            wrapper.appendChild(img);
        } else if (mimeType.startsWith('video/') || ['mp4','webm','ogg'].includes(ext)) {
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.className = 'full-preview-video';
            wrapper.appendChild(video);
        } else if (mimeType.startsWith('audio/') || ['mp3','wav','ogg'].includes(ext)) {
            const audio = document.createElement('audio');
            audio.src = url;
            audio.controls = true;
            audio.className = 'full-preview-audio';
            wrapper.appendChild(audio);
        } else if (mimeType === 'application/pdf' || ext === 'pdf') {
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.className = 'full-preview-iframe';
            wrapper.appendChild(iframe);
        } else if (mimeType.startsWith('text/') || ['txt','md','json','js','css','html'].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const pre = document.createElement('pre');
                pre.className = 'full-preview-text';
                pre.textContent = e.target.result;
                wrapper.appendChild(pre);
            };
            reader.readAsText(blob);
        } else {
            wrapper.innerHTML = `<div class="preview-fallback"><p>Binary file content decoded successfully.</p></div>`;
        }

        container.appendChild(wrapper);

        // Comprehensive Enhanced Metadata Table
        const metadataTable = PreviewRenderer.buildMetadataTable(metadata, headerInfo, fileBuffer.byteLength, filename, mimeType);
        container.appendChild(metadataTable);
    }

    /**
     * Builds standard Metadata Table displaying ALL required fields
     */
    static buildMetadataTable(meta = {}, headerInfo = null, fallbackSize = 0, fallbackFilename = '', fallbackMime = '') {
        const details = document.createElement('details');
        details.className = 'metadata-details-box mt-2';

        const summary = document.createElement('summary');
        summary.className = 'metadata-summary-title';
        summary.innerHTML = '📋 <strong>View Complete File Metadata</strong>';
        details.appendChild(summary);

        const encInfo = meta.encryption || {};
        const kdfInfo = encInfo.keyDerivation || {};

        const filename = meta.filename || (fallbackFilename ? UIUtils.getBaseAndExt(fallbackFilename).base : 'N/A');
        const extension = meta.extension || (fallbackFilename ? UIUtils.getBaseAndExt(fallbackFilename).ext : 'N/A');
        const mimeType = meta.mimeType || meta.type || fallbackMime || 'application/octet-stream';
        const size = meta.size || fallbackSize;
        const hash = meta.hash || 'Verified via AES-GCM tag';
        const timestamp = meta.timestamp ? new Date(meta.timestamp).toLocaleString() : 'N/A';
        const vlmrsVersion = meta.vlmrsVersion || (headerInfo ? headerInfo.version : 2);
        const mode = meta.mode ? meta.mode.toUpperCase() : (headerInfo && headerInfo.mode === 1 ? 'TRANSPARENT' : 'FULL');
        const encMethod = encInfo.method || 'AES-256-GCM';
        const kdfAlgo = kdfInfo.method ? kdfInfo.method.toUpperCase() : 'PBKDF2-HMAC-SHA256';
        const iterations = kdfInfo.iterations || (headerInfo ? headerInfo.iterations : 50000);
        const passProtected = encInfo.passwordProtected !== undefined
            ? (encInfo.passwordProtected ? 'Yes 🔒' : 'No 🔓')
            : 'Yes 🔒';

        const table = document.createElement('table');
        table.className = 'metadata-table mt-2';
        table.innerHTML = `
            <tbody>
                <tr><td><strong>Original Filename:</strong></td><td>${filename}</td></tr>
                <tr><td><strong>File Extension:</strong></td><td><code>${extension}</code></td></tr>
                <tr><td><strong>MIME Type:</strong></td><td><code>${mimeType}</code></td></tr>
                <tr><td><strong>File Size:</strong></td><td>${UIUtils.formatBytes(size)} (${size} bytes)</td></tr>
                <tr><td><strong>SHA-256 Hash:</strong></td><td><code class="hash-text">${hash}</code></td></tr>
                <tr><td><strong>Encryption Timestamp:</strong></td><td>${timestamp}</td></tr>
                <tr><td><strong>VLMRS Version:</strong></td><td>v${vlmrsVersion}.0</td></tr>
                <tr><td><strong>Encryption Mode:</strong></td><td><strong>${mode}</strong></td></tr>
                <tr><td><strong>Encryption Method:</strong></td><td>${encMethod}</td></tr>
                <tr><td><strong>KDF Algorithm:</strong></td><td>${kdfAlgo} (${iterations.toLocaleString()} iterations)</td></tr>
                <tr><td><strong>Password Protected:</strong></td><td>${passProtected}</td></tr>
                <tr><td><strong>Credit:</strong></td><td>Valmortheos</td></tr>
                <tr><td><strong>Instagram:</strong></td><td><a href="https://instagram.com/valmortheos" target="_blank" rel="noopener">@valmortheos</a></td></tr>
                <tr><td><strong>GitHub:</strong></td><td><a href="https://github.com/valmortheos" target="_blank" rel="noopener">@valmortheos</a></td></tr>
            </tbody>
        `;

        details.appendChild(table);
        return details;
    }

    static escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}
