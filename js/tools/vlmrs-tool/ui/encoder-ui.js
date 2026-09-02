import { UIUtils } from '../../../shared/ui-utils.js';
import { VLMRSEncoder } from '../core/vlmrs-encoder.js';
import { ProgressManager } from './progress-manager.js';
import { HistoryManager } from '../storage/history-manager.js';

export class EncoderUI {
    constructor() {
        this.fileQueue = [];
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
        const passInput = document.getElementById('enc-pass');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.click();
                }
            });
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

        // Interactive Mode Selection Cards (Requirement 2)
        const modeCards = [modeFullCard, modeTransCard].filter(Boolean);
        modeCards.forEach(card => {
            const mode = card.getAttribute('data-mode');
            const selectCard = () => {
                modeCards.forEach(c => {
                    c.classList.remove('active', 'selected');
                    c.setAttribute('aria-checked', 'false');
                });
                card.classList.add('active', 'selected');
                card.setAttribute('aria-checked', 'true');
                this.setMode(mode);
            };

            card.addEventListener('click', selectCard);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectCard();
                }
            });
        });

        // Real-time Password Strength Meter (Requirement 3 with Icons)
        if (passInput) {
            passInput.addEventListener('input', (e) => {
                this.updatePasswordStrength(e.target.value);
            });
        }

        // Filename mode radio toggles
        const filenameRadios = document.querySelectorAll('input[name="enc-filename-mode"]');
        const customFilenameInput = document.getElementById('enc-custom-filename');
        filenameRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (customFilenameInput) {
                    customFilenameInput.disabled = (e.target.value !== 'custom');
                    if (e.target.value === 'custom') customFilenameInput.focus();
                }
            });
        });

        if (encodeBtn) {
            encodeBtn.addEventListener('click', () => this.startEncoding());
        }

        if (downloadZipBtn) {
            downloadZipBtn.addEventListener('click', () => this.downloadAllZip());
        }
    }

    updatePasswordStrength(password) {
        const strengthBox = document.getElementById('password-strength-box');
        const fillEl = document.getElementById('strength-fill');
        const labelEl = document.getElementById('strength-label');

        if (!strengthBox || !fillEl || !labelEl) return;

        if (!password) {
            strengthBox.style.display = 'none';
            return;
        }

        strengthBox.style.display = 'block';

        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        score = Math.min(score, 5);

        const strengthMap = {
            0: { width: '0%',   color: 'transparent', text: '',           icon: '' },
            1: { width: '20%',  color: '#EF4444',     text: 'Very Weak',  icon: '⚠️' },
            2: { width: '40%',  color: '#F59E0B',     text: 'Weak',       icon: '⚡' },
            3: { width: '60%',  color: '#3B82F6',     text: 'Fair',       icon: '👍' },
            4: { width: '80%',  color: '#10B981',     text: 'Good',       icon: '✅' },
            5: { width: '100%', color: '#059669',     text: 'Strong',     icon: '🛡️' }
        };

        const current = strengthMap[score] || strengthMap[1];

        fillEl.style.width = current.width;
        fillEl.style.backgroundColor = current.color;
        labelEl.innerText = `${current.icon} Strength: ${current.text}`;
        labelEl.style.color = current.color;
    }

    setMode(mode) {
        this.selectedMode = mode;
        const passConfirmGroup = document.getElementById('enc-pass-confirm-group');
        const passHelp = document.getElementById('enc-pass-help');

        if (mode === 'full') {
            if (passConfirmGroup) passConfirmGroup.style.display = 'block';
            if (passHelp) passHelp.innerText = "Password required to encrypt all file metadata and content.";
        } else {
            if (passConfirmGroup) passConfirmGroup.style.display = 'none';
            if (passHelp) passHelp.innerText = "Password is optional. If left empty, deterministic key encryption will be generated.";
        }
    }

    handleFileSelect(files) {
        const hasLargeFile = files.some(f => f.size > 200 * 1024 * 1024);
        if (hasLargeFile) {
            UIUtils.showToast("Files larger than 200MB may cause browser memory lag.", "warning", 5000);
        }

        files.forEach(file => {
            this.fileQueue.push({
                file,
                status: 'pending',
                progress: 0,
                error: null,
                result: null
            });
        });

        this.renderQueueDisplay();

        const encForm = document.getElementById('enc-form');
        if (encForm) encForm.style.display = this.fileQueue.length > 0 ? 'block' : 'none';
    }

    renderQueueDisplay() {
        const container = document.getElementById('enc-files-list');
        if (!container) return;
        container.innerHTML = '';

        this.fileQueue.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'file-item';

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

            row.innerHTML = `
                <div class="file-item-info">
                    <strong class="file-name-truncate" title="${item.file.name}">${item.file.name}</strong>
                    <div class="text-secondary text-sm">Size: ${UIUtils.formatBytes(item.file.size)} ${item.error ? `<span class="text-danger"> - ${item.error}</span>` : ''}</div>
                </div>
                <span class="badge ${badgeClass}">${badgeText}</span>
                ${item.status === 'pending' ? `<button class="btn btn-secondary btn-sm btn-remove-item" data-index="${index}" style="margin-left:0.5rem;" aria-label="Remove ${item.file.name} from queue">Remove</button>` : ''}
            `;

            const removeBtn = row.querySelector('.btn-remove-item');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    this.fileQueue.splice(index, 1);
                    this.renderQueueDisplay();
                    const encForm = document.getElementById('enc-form');
                    if (encForm) encForm.style.display = this.fileQueue.length > 0 ? 'block' : 'none';
                });
            }

            container.appendChild(row);
        });
    }

    async startEncoding() {
        const pendingItems = this.fileQueue.filter(item => item.status === 'pending' || item.status === 'error');
        if (!pendingItems.length) {
            UIUtils.showToast("No pending files to encode in queue.", "warning");
            return;
        }

        const passInput = document.getElementById('enc-pass');
        const confirmPassInput = document.getElementById('enc-pass-confirm');
        const encodeBtn = document.getElementById('btn-start-encode');
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

        if (encodeBtn) encodeBtn.setAttribute('aria-busy', 'true');

        const outputFormatRadio = document.querySelector('input[name="enc-output-format"]:checked');
        const outputFormat = outputFormatRadio ? outputFormatRadio.value : 'binary';

        const filenameRadio = document.querySelector('input[name="enc-filename-mode"]:checked');
        const customFilenameInput = document.getElementById('enc-custom-filename');
        const isCustomMode = filenameRadio && filenameRadio.value === 'custom';
        const customBaseName = isCustomMode && customFilenameInput ? customFilenameInput.value.trim() : '';

        const resultsContainer = document.getElementById('enc-results-container');
        if (resultsContainer) resultsContainer.style.display = 'block';

        const totalQueue = this.fileQueue.length;

        for (let i = 0; i < this.fileQueue.length; i++) {
            const queueItem = this.fileQueue[i];
            if (queueItem.status === 'done') continue;

            queueItem.status = 'processing';
            queueItem.progress = 0;
            this.renderQueueDisplay();

            try {
                const result = await VLMRSEncoder.encodeFile(queueItem.file, {
                    mode: this.selectedMode,
                    outputFormat: outputFormat,
                    password: password,
                    customBaseName: customBaseName,
                    index: i,
                    totalFiles: totalQueue,
                    progressCallback: (pct, msg) => {
                        queueItem.progress = pct;
                        ProgressManager.updateProgress('enc', pct, `File ${i + 1}/${totalQueue}: ${msg}`);
                        this.renderQueueDisplay();
                    }
                });

                queueItem.status = 'done';
                queueItem.progress = 100;
                queueItem.result = result;
                this.encodedResults.push(result);

                this.renderQueueDisplay();
                this.renderResultCard(result);

                await HistoryManager.addEntry({
                    action: 'Encode',
                    filename: queueItem.file.name,
                    outputFilename: result.outputFilename,
                    size: queueItem.file.size,
                    mode: this.selectedMode
                });

            } catch (err) {
                console.error("Encoding error:", err);
                queueItem.status = 'error';
                queueItem.error = err.message;
                this.renderQueueDisplay();
                UIUtils.showToast(`Error encoding ${queueItem.file.name}: ${err.message}`, "danger");
            }
        }

        if (encodeBtn) encodeBtn.setAttribute('aria-busy', 'false');
        ProgressManager.hideProgress('enc');
        this.updateZipButtonLabel();
        UIUtils.showToast("Batch encoding process completed!", "success");
    }

    renderResultCard(result) {
        const resultsList = document.getElementById('enc-results-list');
        if (!resultsList) return;

        const card = document.createElement('div');
        card.className = 'card mb-3';

        const modeBadge = result.mode === 'full' ? '<span class="badge badge-danger">FULL MODE</span>' : '<span class="badge badge-success">TRANSPARENT MODE</span>';
        const formatBadge = result.outputFormat === 'base64' ? '<span class="badge badge-info">BASE64 TEXT</span>' : '<span class="badge badge-secondary">BINARY</span>';

        card.innerHTML = `
            <div class="result-card-header">
                <div>
                    <strong>📁 <span class="card-display-filename file-name" title="${result.outputFilename}">${result.outputFilename}</span></strong> ${modeBadge} ${formatBadge}
                    <div class="text-secondary text-sm">Original: <span class="file-name" title="${result.originalName}">${result.originalName}</span></div>
                </div>
            </div>
            <div class="form-group mb-2">
                <label class="text-sm">Rename Result File:</label>
                <div class="input-wrapper">
                    <input type="text" class="input-control input-rename-card" value="${result.outputFilename}" aria-label="Rename output file">
                </div>
            </div>
            <div class="result-card-actions">
                <button class="btn btn-primary btn-download-single" aria-label="Download ${result.outputFilename}">Download</button>
            </div>
        `;

        const renameInput = card.querySelector('.input-rename-card');
        const displayFilename = card.querySelector('.card-display-filename');
        const targetExt = result.outputFormat === 'base64' ? '.txt' : '.vlmrs';

        renameInput.addEventListener('input', (e) => {
            let val = e.target.value.trim();
            if (!val.endsWith(targetExt)) {
                val += targetExt;
            }
            result.outputFilename = val;
            displayFilename.innerText = val;
            displayFilename.setAttribute('title', val);
        });

        card.querySelector('.btn-download-single').addEventListener('click', () => {
            const blob = new Blob([result.encodedBuffer], { type: result.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.outputFilename;
            a.click();
            URL.revokeObjectURL(url);
        });

        resultsList.appendChild(card);
    }

    updateZipButtonLabel() {
        const btnZip = document.getElementById('btn-enc-download-zip');
        if (!btnZip) return;

        const totalCount = this.encodedResults.length;
        const totalSize = this.encodedResults.reduce((acc, r) => acc + r.encodedBuffer.byteLength, 0);

        if (totalCount > 0) {
            btnZip.innerText = `Download All (.ZIP) - ${totalCount} file${totalCount > 1 ? 's' : ''} (${UIUtils.formatBytes(totalSize)})`;
        } else {
            btnZip.innerText = `Download All (.ZIP)`;
        }
    }

    async downloadAllZip() {
        if (!this.encodedResults.length) {
            UIUtils.showToast("No processed files available for ZIP download", "warning");
            return;
        }

        if (typeof JSZip === 'undefined') {
            UIUtils.showToast("JSZip library not loaded", "danger");
            return;
        }

        ProgressManager.updateProgress('enc', 20, "Creating ZIP archive...");
        const zip = new JSZip();

        this.encodedResults.forEach(res => {
            zip.file(res.outputFilename, res.encodedBuffer);
        });

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        ProgressManager.hideProgress('enc');

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vlmrs_encoded_bundle_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        UIUtils.showToast("ZIP archive downloaded!", "success");
    }
}
