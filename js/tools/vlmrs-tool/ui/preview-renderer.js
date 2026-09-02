import { UIUtils } from '../../../shared/ui-utils.js';

export class PreviewRenderer {
    /**
     * Renders Mode B unencrypted preview from plainMetadata inside the element
     */
    static renderTransparentPreview(container, plainMetadata) {
        if (!container) return;
        container.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'transparent-preview-card';

        const title = document.createElement('div');
        title.className = 'preview-title';
        title.innerHTML = `<strong>📁 ${plainMetadata.filename}</strong> <span class="badge mode-badge">Transparent Mode</span>`;
        card.appendChild(title);

        const info = document.createElement('div');
        info.className = 'preview-info';
        info.innerHTML = `Original Size: <strong>${UIUtils.formatBytes(plainMetadata.size)}</strong> | Type: <code>${plainMetadata.mimeType}</code>`;
        card.appendChild(info);

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
        container.appendChild(card);
    }

    /**
     * Renders decrypted file full preview (Images, Video, Audio, PDF, Text)
     */
    static renderDecryptedPreview(container, fileBuffer, filename, mimeType) {
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
    }

    static escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}
