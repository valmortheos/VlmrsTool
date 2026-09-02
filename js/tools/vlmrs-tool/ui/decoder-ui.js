import { UIUtils } from '../../../shared/ui-utils.js';
import { VLMRSDecoder } from '../core/vlmrs-decoder.js';
import { PreviewRenderer } from './preview-renderer.js';
import { ProgressManager } from './progress-manager.js';
import { HistoryManager } from '../storage/history-manager.js';

export class DecoderUI {
    constructor() {
        this.fileQueue = [];
        this.decodedResults = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const dropzone = document.getElementById('dec-dropzone');
        const fileInput = document.getElementById('dec-file');
        const decodeBtn = document.getElementById('btn-start-decode');
        const downloadZipBtn = document.getElementById('btn-dec-download-zip');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    this.handleFileSelect(Array.from(e.dataTransfer.files));
                }
            });
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    this.handleFileSelect(Array.from(e.target.files));
                }
            });
        }

        // Filename mode radio toggles
        const filenameRadios = document.querySelectorAll('input[name="dec-filename-mode"]');
        const customFilenameInput = document.getElementById('dec-custom-filename');
        filenameRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (customFilenameInput) {
                    customFilenameInput.disabled = (e.target.value !== 'custom');
                    if (e.target.value === 'custom') customFilenameInput.focus();
                }
            });
        });

        if (decodeBtn) {
            decodeBtn.addEventListener('click', () => this.startDecoding());
        }

        if (downloadZipBtn) {
            downloadZipBtn.addEventListener('click', () => this.downloadAllZip());
        }
    }

    async handleFileSelect(files) {
        const hasLargeFile = files.some(f => f.size > 200 * 1024 * 1024);
        if (hasLargeFile) {
            UIUtils.showToast("Files larger than 200MB may cause browser memory lag.", "warning", 5000);
        }

        for (const file of files) {
            try {
                const buffer = await file.arrayBuffer();
                const metaInfo = VLMRSDecoder.extractMetadata(buffer);
                this.fileQueue.push({
                    file,
                    buffer,
                    headerInfo: metaInfo.headerInfo,
                    plainMetadata: metaInfo.plainMetadata,
                    status: 'pending', // pending, processing, done, error
                    progress: 0,
                    error: null,
                    result: null
                });
            } catch (e) {
                console.error("Error loading file for decoding:", e);
                UIUtils.showToast(`Invalid VLMRS file: ${file.name}`, "danger");
            }
        }

        const decForm = document.getElementById('dec-form');
        if (decForm) decForm.style.display = this.fileQueue.length > 0 ? 'block' : 'none';

        this.renderQueueDisplay();
    }

    renderQueueDisplay() {
        const container = document.getElementById('dec-files-list');
        if (!container) return;
        container.innerHTML = '';

        this.fileQueue.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'card mb-3';

            let badgeClass = 'badge-secondary';
            let badgeText = '[Pending]';

            if (item.status === 'processing') {
                badgeClass = 'badge-warning';
                badgeText = `[Processing ${item.progress}%]`;
            } else if (item.status === 'done') {
                badgeClass = 'badge-success';
                badgeText = '[Done ✓]';
            } else if (item.status === 'error') {
                badgeClass = 'badge-danger';
                badgeText = '[Error ✗]';
            }

            const headerRow = document.createElement('div');
            headerRow.className = 'flex justify-between items-center mb-2';
            headerRow.innerHTML = `
                <div class="file-item-info">
                    <strong class="file-name-truncate" title="${item.file.name}">${item.file.name}</strong>
                    ${item.error ? `<div class="text-danger text-sm">${item.error}</div>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    ${item.status === 'pending' ? `<button class="btn btn-secondary btn-sm btn-remove-dec" data-index="${index}">Remove</button>` : ''}
                </div>
            `;

            const removeBtn = headerRow.querySelector('.btn-remove-dec');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    this.fileQueue.splice(index, 1);
                    this.renderQueueDisplay();
                    const decForm = document.getElementById('dec-form');
                    if (decForm) decForm.style.display = this.fileQueue.length > 0 ? 'block' : 'none';
                });
            }

            card.appendChild(headerRow);

            if (item.plainMetadata) {
                const previewSlot = document.createElement('div');
                PreviewRenderer.renderTransparentPreview(previewSlot, item.plainMetadata);
                card.appendChild(previewSlot);
            } else {
                const fullInfo = document.createElement('p');
                fullInfo.className = 'text-secondary text-sm mt-1';
                fullInfo.innerText = "🔒 Metadata encrypted. Password required to decrypt content.";
                card.appendChild(fullInfo);
            }

            container.appendChild(card);
        });
    }

    async startDecoding() {
        const pendingItems = this.fileQueue.filter(item => item.status === 'pending' || item.status === 'error');
        if (!pendingItems.length) {
            UIUtils.showToast("No pending files to decode in queue.", "warning");
            return;
        }

        const passInput = document.getElementById('dec-pass');
        const password = passInput ? passInput.value : '';

        // Custom Filename Mode check
        const filenameRadio = document.querySelector('input[name="dec-filename-mode"]:checked');
        const customFilenameInput = document.getElementById('dec-custom-filename');
        const isCustomMode = filenameRadio && filenameRadio.value === 'custom';
        const customBaseName = isCustomMode && customFilenameInput ? customFilenameInput.value.trim() : '';

        const resultsContainer = document.getElementById('dec-results-container');
        if (resultsContainer) resultsContainer.style.display = 'block';

        const totalQueue = this.fileQueue.length;

        for (let i = 0; i < this.fileQueue.length; i++) {
            const queueItem = this.fileQueue[i];
            if (queueItem.status === 'done') continue;

            queueItem.status = 'processing';
            queueItem.progress = 0;
            this.renderQueueDisplay();

            try {
                const result = await VLMRSDecoder.decryptFile(queueItem.buffer, password, {
                    customBaseName: customBaseName,
                    index: i,
                    totalFiles: totalQueue,
                    progressCallback: (pct, msg) => {
                        queueItem.progress = pct;
                        ProgressManager.updateProgress('dec', pct, `File ${i + 1}/${totalQueue}: ${msg}`);
                        this.renderQueueDisplay();
                    }
                });

                queueItem.status = 'done';
                queueItem.progress = 100;
                queueItem.result = result;
                this.decodedResults.push(result);

                this.renderQueueDisplay();
                this.renderDecodedCard(result);

                await HistoryManager.addEntry({
                    action: 'Decode',
                    filename: queueItem.file.name,
                    outputFilename: result.filename,
                    size: result.size,
                    mode: queueItem.headerInfo.mode === 1 ? 'transparent' : 'full'
                });

            } catch (err) {
                console.error("Decoding error:", err);
                queueItem.status = 'error';
                queueItem.error = err.message;
                this.renderQueueDisplay();
                UIUtils.showToast(`Error decoding ${queueItem.file.name}: ${err.message}`, "danger");
            }
        }

        ProgressManager.hideProgress('dec');
        this.updateZipButtonLabel();
        UIUtils.showToast("Batch decoding process completed!", "success");
    }

    renderDecodedCard(result) {
        const resultsList = document.getElementById('dec-results-list');
        if (!resultsList) return;

        const card = document.createElement('div');
        card.className = 'card mb-3';

        const { ext } = UIUtils.getBaseAndExt(result.filename);

        card.innerHTML = `
            <div class="result-card-header">
                <div>
                    <strong>📄 Original: ${result.originalFilename}</strong> (${UIUtils.formatBytes(result.size)})
                    <div class="text-secondary text-sm">Output name: <span class="card-display-filename">${result.filename}</span></div>
                </div>
            </div>
            <div class="form-group mb-2">
                <label class="text-sm">Rename Decrypted File:</label>
                <div class="input-wrapper">
                    <input type="text" class="input-control input-rename-card" value="${result.filename}">
                </div>
            </div>
            <div class="decrypted-preview-slot"></div>
            <div class="result-card-actions">
                <button class="btn btn-success btn-download-single">Download Decrypted File</button>
            </div>
        `;

        const previewSlot = card.querySelector('.decrypted-preview-slot');
        PreviewRenderer.renderDecryptedPreview(previewSlot, result.decryptedBuffer, result.filename, result.mimeType);

        const renameInput = card.querySelector('.input-rename-card');
        const displayFilename = card.querySelector('.card-display-filename');
        renameInput.addEventListener('input', (e) => {
            let val = e.target.value.trim();
            if (ext && !val.endsWith(ext)) {
                val += ext;
            }
            result.filename = val;
            displayFilename.innerText = val;
        });

        card.querySelector('.btn-download-single').addEventListener('click', () => {
            const blob = new Blob([result.decryptedBuffer], { type: result.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
        });

        resultsList.appendChild(card);
    }

    updateZipButtonLabel() {
        const btnZip = document.getElementById('btn-dec-download-zip');
        if (!btnZip) return;

        const totalCount = this.decodedResults.length;
        const totalSize = this.decodedResults.reduce((acc, r) => acc + r.decryptedBuffer.byteLength, 0);

        if (totalCount > 0) {
            btnZip.innerText = `Download All (.ZIP) - ${totalCount} file${totalCount > 1 ? 's' : ''} (${UIUtils.formatBytes(totalSize)})`;
        } else {
            btnZip.innerText = `Download All (.ZIP)`;
        }
    }

    async downloadAllZip() {
        if (!this.decodedResults.length) {
            UIUtils.showToast("No processed files available for ZIP download", "warning");
            return;
        }

        if (typeof JSZip === 'undefined') {
            UIUtils.showToast("JSZip library not loaded", "danger");
            return;
        }

        ProgressManager.updateProgress('dec', 20, "Creating ZIP archive...");
        const zip = new JSZip();

        this.decodedResults.forEach(res => {
            zip.file(res.filename, res.decryptedBuffer);
        });

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        ProgressManager.hideProgress('dec');

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vlmrs_decoded_bundle_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        UIUtils.showToast("ZIP archive downloaded!", "success");
    }
}
