import { UIUtils } from '../../../shared/ui-utils.js';
import { VLMRSEncoder } from '../core/vlmrs-encoder.js';
import { ProgressManager } from './progress-manager.js';
import { HistoryManager } from '../storage/history-manager.js';

export class EncoderUI {
    constructor() {
        this.selectedFiles = [];
        this.selectedMode = 'full'; // 'full' or 'transparent'
        this.encodedResults = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const dropzone = document.getElementById('enc-dropzone');
        const fileInput = document.getElementById('enc-file');
        const modeFullCard = document.getElementById('mode-card-full');
        const modeTransCard = document.getElementById('mode-card-transparent');
        const encodeBtn = document.getElementById('btn-start-encode');
        const downloadZipBtn = document.getElementById('btn-enc-download-zip');

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

        if (modeFullCard && modeTransCard) {
            modeFullCard.addEventListener('click', () => this.setMode('full'));
            modeTransCard.addEventListener('click', () => this.setMode('transparent'));
        }

        if (encodeBtn) {
            encodeBtn.addEventListener('click', () => this.startEncoding());
        }

        if (downloadZipBtn) {
            downloadZipBtn.addEventListener('click', () => this.downloadAllZip());
        }
    }

    setMode(mode) {
        this.selectedMode = mode;
        const fullCard = document.getElementById('mode-card-full');
        const transCard = document.getElementById('mode-card-transparent');
        const passConfirmGroup = document.getElementById('enc-pass-confirm-group');
        const passHelp = document.getElementById('enc-pass-help');

        if (mode === 'full') {
            fullCard.classList.add('selected');
            transCard.classList.remove('selected');
            if (passConfirmGroup) passConfirmGroup.style.display = 'block';
            if (passHelp) passHelp.innerText = "Password required to encrypt all file metadata and content.";
        } else {
            transCard.classList.add('selected');
            fullCard.classList.remove('selected');
            if (passConfirmGroup) passConfirmGroup.style.display = 'none';
            if (passHelp) passHelp.innerText = "Password is optional. If left empty, deterministic key encryption will be generated.";
        }
    }

    handleFileSelect(files) {
        this.selectedFiles = files;
        this.renderSelectedFilesList();

        const encForm = document.getElementById('enc-form');
        if (encForm) encForm.style.display = files.length > 0 ? 'block' : 'none';
    }

    renderSelectedFilesList() {
        const container = document.getElementById('enc-files-list');
        if (!container) return;
        container.innerHTML = '';

        this.selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-item-info">
                    <strong>${file.name}</strong> (${UIUtils.formatBytes(file.size)})
                </div>
                <button class="btn btn-secondary btn-sm" data-index="${index}">Remove</button>
            `;
            item.querySelector('button').addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                this.selectedFiles.splice(idx, 1);
                this.handleFileSelect(this.selectedFiles);
            });
            container.appendChild(item);
        });
    }

    async startEncoding() {
        if (!this.selectedFiles.length) {
            UIUtils.showToast("Please select at least one file to encode.", "warning");
            return;
        }

        const passInput = document.getElementById('enc-pass');
        const confirmPassInput = document.getElementById('enc-pass-confirm');
        const password = passInput ? passInput.value : '';

        if (this.selectedMode === 'full') {
            if (!password) {
                UIUtils.showToast("Password is required for Full Encryption Mode.", "danger");
                return;
            }
            if (confirmPassInput && password !== confirmPassInput.value) {
                UIUtils.showToast("Passwords do not match!", "danger");
                return;
            }
        }

        this.encodedResults = [];
        const resultsContainer = document.getElementById('enc-results-container');
        const resultsList = document.getElementById('enc-results-list');
        if (resultsContainer) resultsContainer.style.display = 'block';
        if (resultsList) resultsList.innerHTML = '';

        for (let i = 0; i < this.selectedFiles.length; i++) {
            const file = this.selectedFiles[i];
            const currentPercentPrefix = Math.round((i / this.selectedFiles.length) * 100);

            try {
                const result = await VLMRSEncoder.encodeFile(file, {
                    mode: this.selectedMode,
                    password: password,
                    progressCallback: (pct, msg) => {
                        const totalPct = Math.round(currentPercentPrefix + (pct / this.selectedFiles.length));
                        ProgressManager.updateProgress('enc', totalPct, `File ${i + 1}/${this.selectedFiles.length}: ${msg}`);
                    }
                });

                this.encodedResults.push(result);
                this.renderResultItem(result);

                await HistoryManager.addEntry({
                    action: 'Encode',
                    filename: file.name,
                    outputFilename: result.outputFilename,
                    size: file.size,
                    mode: this.selectedMode
                });

            } catch (err) {
                console.error("Encoding error:", err);
                UIUtils.showToast(`Error encoding ${file.name}: ${err.message}`, "danger");
            }
        }

        ProgressManager.hideProgress('enc');
        UIUtils.showToast("Encoding completed successfully!", "success");
    }

    renderResultItem(result) {
        const resultsList = document.getElementById('enc-results-list');
        if (!resultsList) return;

        const item = document.createElement('div');
        item.className = 'result-item card mb-2';
        item.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <strong>📁 ${result.outputFilename}</strong>
                    <span class="badge ${result.mode === 'full' ? 'badge-danger' : 'badge-success'}">${result.mode.toUpperCase()} MODE</span>
                </div>
                <button class="btn btn-primary btn-sm btn-download">Download .vlmrs</button>
            </div>
        `;

        item.querySelector('.btn-download').addEventListener('click', () => {
            const blob = new Blob([result.encodedBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.outputFilename;
            a.click();
            URL.revokeObjectURL(url);
        });

        resultsList.appendChild(item);
    }

    async downloadAllZip() {
        if (!this.encodedResults.length) return;
        if (typeof JSZip === 'undefined') {
            UIUtils.showToast("JSZip library not loaded", "danger");
            return;
        }

        const zip = new JSZip();
        this.encodedResults.forEach(res => {
            zip.file(res.outputFilename, res.encodedBuffer);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vlmrs_encrypted_files_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
