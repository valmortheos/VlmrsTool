import { UIUtils } from '../../../shared/ui-utils.js';
import { VLMRSDecoder } from '../core/vlmrs-decoder.js';
import { PreviewRenderer } from './preview-renderer.js';
import { ProgressManager } from './progress-manager.js';
import { HistoryManager } from '../storage/history-manager.js';

export class DecoderUI {
    constructor() {
        this.selectedFileBuffers = [];
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

        if (decodeBtn) {
            decodeBtn.addEventListener('click', () => this.startDecoding());
        }
    }

    async handleFileSelect(files) {
        this.selectedFileBuffers = [];
        const previewContainer = document.getElementById('dec-files-list');
        if (previewContainer) previewContainer.innerHTML = '';

        for (const file of files) {
            try {
                const buffer = await file.arrayBuffer();
                const metaInfo = VLMRSDecoder.extractMetadata(buffer);
                this.selectedFileBuffers.push({
                    file,
                    buffer,
                    headerInfo: metaInfo.headerInfo,
                    plainMetadata: metaInfo.plainMetadata
                });
            } catch (e) {
                console.error("Error loading file for decoding:", e);
                UIUtils.showToast(`Invalid VLMRS file: ${file.name}`, "danger");
            }
        }

        const decForm = document.getElementById('dec-form');
        if (decForm) decForm.style.display = this.selectedFileBuffers.length > 0 ? 'block' : 'none';

        this.renderDecFilesPreview();
    }

    renderDecFilesPreview() {
        const container = document.getElementById('dec-files-list');
        if (!container) return;
        container.innerHTML = '';

        this.selectedFileBuffers.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'card mb-3';

            if (item.plainMetadata) {
                // Transparent Mode with unencrypted preview
                const previewSlot = document.createElement('div');
                PreviewRenderer.renderTransparentPreview(previewSlot, item.plainMetadata);
                card.appendChild(previewSlot);
            } else {
                // Mode A or V1 (Full Encryption)
                card.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div>
                            <strong>🔒 ${item.file.name}</strong>
                            <span class="badge badge-danger">FULL ENCRYPTION</span>
                            <p class="text-secondary text-sm">Metadata encrypted. Password required to decrypt and view preview.</p>
                        </div>
                    </div>
                `;
            }

            container.appendChild(card);
        });
    }

    async startDecoding() {
        if (!this.selectedFileBuffers.length) {
            UIUtils.showToast("Please select at least one .vlmrs file", "warning");
            return;
        }

        const passInput = document.getElementById('dec-pass');
        const password = passInput ? passInput.value : '';

        this.decodedResults = [];
        const resultsList = document.getElementById('dec-results-list');
        const resultsContainer = document.getElementById('dec-results-container');
        if (resultsContainer) resultsContainer.style.display = 'block';
        if (resultsList) resultsList.innerHTML = '';

        for (let i = 0; i < this.selectedFileBuffers.length; i++) {
            const item = this.selectedFileBuffers[i];
            const currentPercentPrefix = Math.round((i / this.selectedFileBuffers.length) * 100);

            try {
                const result = await VLMRSDecoder.decryptFile(item.buffer, password, (pct, msg) => {
                    const totalPct = Math.round(currentPercentPrefix + (pct / this.selectedFileBuffers.length));
                    ProgressManager.updateProgress('dec', totalPct, `File ${i + 1}/${this.selectedFileBuffers.length}: ${msg}`);
                });

                this.decodedResults.push(result);
                this.renderDecodedItem(result);

                await HistoryManager.addEntry({
                    action: 'Decode',
                    filename: item.file.name,
                    outputFilename: result.filename,
                    size: result.size,
                    mode: item.headerInfo.mode === 1 ? 'transparent' : 'full'
                });

            } catch (err) {
                console.error("Decoding error:", err);
                UIUtils.showToast(`Error decoding ${item.file.name}: ${err.message}`, "danger");
            }
        }

        ProgressManager.hideProgress('dec');
        UIUtils.showToast("Decoding complete!", "success");
    }

    renderDecodedItem(result) {
        const resultsList = document.getElementById('dec-results-list');
        if (!resultsList) return;

        const card = document.createElement('div');
        card.className = 'card mb-3';

        const headerRow = document.createElement('div');
        headerRow.className = 'flex justify-between items-center mb-3';
        headerRow.innerHTML = `
            <div>
                <strong>📄 Original: ${result.filename}</strong> (${UIUtils.formatBytes(result.size)})
            </div>
            <button class="btn btn-success btn-sm btn-download">Download Decrypted</button>
        `;

        headerRow.querySelector('.btn-download').addEventListener('click', () => {
            const blob = new Blob([result.decryptedBuffer], { type: result.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
        });

        card.appendChild(headerRow);

        const previewContainer = document.createElement('div');
        PreviewRenderer.renderDecryptedPreview(previewContainer, result.decryptedBuffer, result.filename, result.mimeType);
        card.appendChild(previewContainer);

        resultsList.appendChild(card);
    }
}
