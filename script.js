/**
 * VLMRS Binary Structure v1.0 (Secure)
 * Header: Magic "VLMR", version, salt len, iv len, encrypted meta len (LE), iterations (LE)
 * Payload: Salt + IV + Encrypted Metadata (AES-GCM) + File Ciphertext (AES-GCM)
 * Header (dengan encrypted meta len = 0) digunakan sebagai AAD untuk enkripsi metadata
 * Header (dengan encrypted meta len aktual) digunakan sebagai AAD untuk enkripsi file
 */

// Utility functions
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const togglePass = (inputId, confirmInputId, btn) => {
    const input = document.getElementById(inputId);
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
    
    if (confirmInputId) {
        const confirmInput = document.getElementById(confirmInputId);
        if (confirmInput) {
            confirmInput.setAttribute('type', type);
        }
    }
    
    btn.style.color = type === 'text' ? 'var(--accent-color)' : 'var(--text-secondary)';
    
    const siblings = btn.closest('.input-wrapper').parentElement.parentElement.querySelectorAll('.toggle-password');
    siblings.forEach(sibling => {
        sibling.style.color = btn.style.color;
    });
};

const switchTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`view-${tab}`).classList.add('active');
    
    if (tab === 'history') {
        loadHistoryDisplay();
    }
};

const setStatus = (view, state, msg) => {
    const el = document.getElementById(`${view}-status`);
    el.className = `status-message ${state}`;
    el.innerText = msg;
    el.style.display = 'block';
};

// IndexedDB setup for history
let db = null;

const openDatabase = () => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        
        const dbRequest = indexedDB.open('vlmrs-history', 1);
        
        dbRequest.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains('history')) {
                const store = database.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        
        dbRequest.onsuccess = (event) => {
            db = event.target.result;
            
            db.onclose = () => {
                console.warn('Database closed unexpectedly');
                db = null;
            };
            
            db.onversionchange = () => {
                db.close();
                db = null;
                console.warn('Database version changed, closing connection');
            };
            
            resolve(db);
        };
        
        dbRequest.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
        
        dbRequest.onblocked = (event) => {
            console.warn('Database blocked:', event);
            reject(new Error('Database blocked'));
        };
    });
};

const saveHistoryEntry = async (operation, files) => {
    try {
        const database = await openDatabase();
        
        const transaction = database.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        
        const entry = {
            operation: operation,
            timestamp: Date.now(),
            files: files.map(file => ({
                name: file.name || file.filename || file.originalName,
                size: file.size,
                type: file.type || 'N/A',
                metadata: file.metadata ? {
                    vlmrsVersion: file.metadata.vlmrsVersion,
                    encryption: file.metadata.encryption,
                    tool: file.metadata.tool,
                    credit: file.metadata.credit
                } : null
            }))
        };
        
        store.add(entry);
        
        transaction.oncomplete = () => {
            console.log('History saved successfully');
        };
        
        transaction.onerror = (event) => {
            console.error('Transaction error:', event.target.error);
        };
        
    } catch (error) {
        console.error('Failed to save history:', error);
    }
};

const loadHistoryDisplay = async () => {
    try {
        const database = await openDatabase();
        
        const transaction = database.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const history = request.result;
            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '';
            
            if (history.length === 0) {
                historyList.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No history yet</p>';
                return;
            }
            
            history.sort((a, b) => b.timestamp - a.timestamp);
            
            history.forEach(entry => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                const header = document.createElement('div');
                header.className = 'history-item-header';
                header.onclick = () => {
                    const filesList = header.nextElementSibling;
                    filesList.style.display = filesList.style.display === 'none' ? 'flex' : 'none';
                };
                
                const operationBadge = document.createElement('span');
                operationBadge.className = `history-operation ${entry.operation}`;
                operationBadge.textContent = entry.operation.toUpperCase();
                
                const dateSpan = document.createElement('span');
                dateSpan.className = 'history-date';
                dateSpan.textContent = new Date(entry.timestamp).toLocaleString();
                
                header.appendChild(operationBadge);
                header.appendChild(dateSpan);
                
                const filesList = document.createElement('div');
                filesList.className = 'history-files-list';
                filesList.style.display = 'none';
                
                entry.files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'history-file-item';
                    
                    const fileName = document.createElement('span');
                    fileName.className = 'history-file-name';
                    fileName.textContent = file.name;
                    
                    const fileSize = document.createElement('span');
                    fileSize.className = 'history-file-size';
                    fileSize.textContent = formatBytes(file.size);
                    
                    fileItem.appendChild(fileName);
                    fileItem.appendChild(fileSize);
                    
                    if (file.metadata) {
                        const metadataDiv = document.createElement('div');
                        metadataDiv.style.width = '100%';
                        metadataDiv.style.fontSize = '0.8rem';
                        metadataDiv.style.color = 'var(--text-secondary)';
                        metadataDiv.innerHTML = Object.entries(file.metadata)
                            .map(([key, value]) => `<span style="margin-right:1rem;"><strong>${key}:</strong> ${value}</span>`)
                            .join('');
                        fileItem.appendChild(metadataDiv);
                    }
                    
                    filesList.appendChild(fileItem);
                });
                
                historyItem.appendChild(header);
                historyItem.appendChild(filesList);
                historyList.appendChild(historyItem);
            });
        };
        
        request.onerror = (event) => {
            console.error('Failed to load history:', event.target.error);
            const historyList = document.getElementById('history-list');
            historyList.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Failed to load history</p>';
        };
        
    } catch (error) {
        console.error('Failed to open database:', error);
        const historyList = document.getElementById('history-list');
        if (historyList) {
            historyList.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">History unavailable</p>';
        }
    }
};

const clearHistory = async () => {
    try {
        const database = await openDatabase();
        
        const transaction = database.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        store.clear();
        
        transaction.oncomplete = () => {
            loadHistoryDisplay();
        };
        
    } catch (error) {
        console.error('Failed to clear history:', error);
    }
};

// Global state
let currentEncodeFiles = [];
let currentDecodeBuffers = [];
let parsedMetadata = [];
let parsedHeaderLens = [];
let encryptedMetaLengths = [];
let encodedBlobUrls = [];
let decryptedBlobs = [];
let currentEncodeResults = [];
let currentDecodeResults = [];

// Helper: Async sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Calculate SHA-256
const calculateSHA256 = async (buffer) => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper: Download blob
const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Download all as ZIP
const downloadAllAsZip = async (view) => {
    const results = view === 'enc' ? currentEncodeResults : currentDecodeResults;
    if (!results || results.length === 0) return;
    
    try {
        setStatus(view, 'info', 'Creating ZIP file...');
        
        const zip = new JSZip();
        
        results.forEach((file, index) => {
            const filename = file.encodedName || file.filename || file.name || `file_${index + 1}`;
            zip.file(filename, file.blob);
        });
        
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        const zipName = view === 'enc' ? 'vlmrs_encoded_files.zip' : 'vlmrs_decoded_files.zip';
        downloadBlob(zipBlob, zipName);
        
        setStatus(view, 'success', 'ZIP file downloaded successfully!');
    } catch (error) {
        console.error('ZIP creation failed:', error);
        setStatus(view, 'error', 'Failed to create ZIP: ' + error.message);
    }
};

// Download all individually
const downloadAllIndividually = async (view) => {
    const results = view === 'enc' ? currentEncodeResults : currentDecodeResults;
    if (!results || results.length === 0) return;
    
    for (let i = 0; i < results.length; i++) {
        const file = results[i];
        const filename = file.encodedName || file.filename || file.name || `file_${i + 1}`;
        downloadBlob(file.blob, filename);
        await sleep(500); // Delay between downloads
    }
    
    setStatus(view, 'success', `${results.length} file(s) download started!`);
};

// Preview helper functions
function generatePreview(fileOrBlob, container, filename) {
    container.innerHTML = '';
    
    if (!fileOrBlob) {
        container.innerHTML = '<span class="fallback">No preview available</span>';
        return;
    }
    
    const url = URL.createObjectURL(fileOrBlob);
    const type = fileOrBlob.type || '';
    const name = filename || '';
    const ext = name.split('.').pop().toLowerCase();
    
    if (type.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg','bmp','ico'].includes(ext)) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Preview';
        img.onload = () => URL.revokeObjectURL(url);
        container.appendChild(img);
        return;
    }
    if (type.startsWith('video/') || ['mp4','webm','ogg','mov'].includes(ext)) {
        const video = document.createElement('video');
        video.controls = true;
        video.src = url;
        video.onloadeddata = () => URL.revokeObjectURL(url);
        container.appendChild(video);
        return;
    }
    if (type.startsWith('audio/') || ['mp3','wav','ogg','flac'].includes(ext)) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = url;
        audio.onloadeddata = () => URL.revokeObjectURL(url);
        container.appendChild(audio);
        return;
    }
    if (type === 'application/pdf' || ext === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '250px';
        iframe.style.border = 'none';
        iframe.onload = () => URL.revokeObjectURL(url);
        container.appendChild(iframe);
        return;
    }
    if (type.startsWith('text/') || ['txt','md','json','js','html','css','csv'].includes(ext)) {
        fileOrBlob.text().then(text => {
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordBreak = 'break-all';
            pre.style.maxHeight = '200px';
            pre.style.overflow = 'auto';
            pre.textContent = text.slice(0, 2000);
            container.appendChild(pre);
            URL.revokeObjectURL(url);
        });
        return;
    }
    const fallbackDiv = document.createElement('div');
    fallbackDiv.className = 'file-icon';
    fallbackDiv.textContent = '📄';
    const span = document.createElement('span');
    span.className = 'fallback';
    span.textContent = 'Binary file (no preview)';
    container.appendChild(fallbackDiv);
    container.appendChild(span);
    URL.revokeObjectURL(url);
}

function getFileMetadata(file) {
    const metadata = {};
    metadata['File Name'] = file.name;
    metadata['File Size'] = formatBytes(file.size);
    metadata['File Type'] = file.type || 'Unknown';
    metadata['Last Modified'] = new Date(file.lastModified).toLocaleString();
    
    const lastDot = file.name.lastIndexOf('.');
    metadata['Extension'] = lastDot !== -1 ? file.name.substring(lastDot) : 'None';
    
    if (file.size < 1048576) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            const dataView = new DataView(arrayBuffer);
            let hash = 0;
            for (let i = 0; i < arrayBuffer.byteLength; i++) {
                hash = ((hash << 5) - hash) + dataView.getUint8(i);
                hash |= 0;
            }
            const hashStr = Math.abs(hash).toString(16);
            metadata['Checksum (simple)'] = hashStr;
            updateMetadataDisplay(file, metadata);
        };
        reader.readAsArrayBuffer(file);
    }
    
    return metadata;
}

function updateMetadataDisplay(file, metadata) {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const fileName = item.querySelector('.file-name');
        if (fileName && fileName.textContent === file.name) {
            const detailsDiv = item.querySelector('.file-details');
            if (detailsDiv) {
                const checksumRow = document.createElement('div');
                checksumRow.className = 'detail-row';
                checksumRow.innerHTML = `<span>Checksum (simple)</span><span>${metadata['Checksum (simple)']}</span>`;
                detailsDiv.appendChild(checksumRow);
            }
        }
    });
}

// Encoder logic
const encDropzone = document.getElementById('enc-dropzone');
const encFileInput = document.getElementById('enc-file');

const handleEncFileSelect = (files) => {
    if (!files || files.length === 0) return;
    
    currentEncodeFiles = Array.from(files);
    document.getElementById('enc-form').style.display = 'block';
    document.getElementById('enc-download-area').style.display = 'none';
    document.getElementById('enc-status').style.display = 'none';
    document.getElementById('enc-reset').style.display = 'none';
    
    displayEncoderFiles();
};

const displayEncoderFiles = () => {
    const filesList = document.getElementById('enc-files-list');
    filesList.innerHTML = '';
    
    currentEncodeFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const header = document.createElement('div');
        header.className = 'file-item-header';
        header.onclick = () => toggleFileExpansion(fileItem);
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;
        
        const fileMeta = document.createElement('div');
        fileMeta.className = 'file-meta';
        fileMeta.textContent = `${formatBytes(file.size)} • ${file.type || 'Unknown type'}`;
        
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileMeta);
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'file-item-toggle';
        toggleBtn.textContent = 'Preview';
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFileExpansion(fileItem);
        };
        
        header.appendChild(fileInfo);
        header.appendChild(toggleBtn);
        
        const previewContainer = document.createElement('div');
        previewContainer.className = 'file-preview-container';
        previewContainer.style.display = 'none';
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'file-details';
        const metadata = getFileMetadata(file);
        Object.entries(metadata).forEach(([key, value]) => {
            const row = document.createElement('div');
            row.className = 'detail-row';
            row.innerHTML = `<span>${key}</span><span>${value}</span>`;
            detailsDiv.appendChild(row);
        });
        
        const previewArea = document.createElement('div');
        previewArea.className = 'preview-area';
        generatePreview(file, previewArea, file.name);
        
        previewContainer.appendChild(detailsDiv);
        previewContainer.appendChild(previewArea);
        
        fileItem.appendChild(header);
        fileItem.appendChild(previewContainer);
        filesList.appendChild(fileItem);
    });
};

const toggleFileExpansion = (fileItem) => {
    const isExpanded = fileItem.classList.contains('expanded');
    const previewContainer = fileItem.querySelector('.file-preview-container');
    
    if (isExpanded) {
        fileItem.classList.remove('expanded');
        previewContainer.style.display = 'none';
        fileItem.querySelector('.file-item-toggle').textContent = 'Preview';
    } else {
        fileItem.classList.add('expanded');
        previewContainer.style.display = 'block';
        fileItem.querySelector('.file-item-toggle').textContent = 'Hide';
    }
};

encDropzone.addEventListener('click', () => encFileInput.click());
encDropzone.addEventListener('dragover', (e) => { e.preventDefault(); encDropzone.classList.add('dragover'); });
encDropzone.addEventListener('dragleave', () => encDropzone.classList.remove('dragover'));
encDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    encDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleEncFileSelect(e.dataTransfer.files);
});
encFileInput.addEventListener('change', (e) => handleEncFileSelect(e.target.files));

const startEncoding = async () => {
    const passInput = document.getElementById('enc-pass');
    const passConfirmInput = document.getElementById('enc-pass-confirm');
    const pass1 = passInput ? passInput.value : '';
    const pass2 = passConfirmInput ? passConfirmInput.value : '';
    
    if (!pass1) return setStatus('enc', 'error', 'Password cannot be empty.');
    if (pass1 !== pass2) return setStatus('enc', 'error', 'Passwords do not match.');
    if (!currentEncodeFiles.length) return setStatus('enc', 'error', 'No files selected.');
    
    const btn = document.getElementById('enc-btn');
    btn.disabled = true;
    
    encodedBlobUrls.forEach(url => URL.revokeObjectURL(url));
    encodedBlobUrls = [];
    currentEncodeResults = [];
    
    document.getElementById('enc-progress-area').style.display = 'block';
    
    try {
        const totalFiles = currentEncodeFiles.length;
        const iterations = 100000;
        
        for (let i = 0; i < totalFiles; i++) {
            const file = currentEncodeFiles[i];
            const fileSize = file.size;
            const isLargeFile = fileSize > 100 * 1024 * 1024;
            
            const baseProgress = (i / totalFiles) * 100;
            updateProgress('enc', baseProgress, `Preparing ${file.name}...`);
            await sleep(50);
            
            const lastDot = file.name.lastIndexOf('.');
            const origName = lastDot !== -1 && lastDot !== 0 ? file.name.substring(0, lastDot) : file.name;
            const origExt = lastDot !== -1 && lastDot !== 0 ? file.name.substring(lastDot) : '';
            
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Read file first
            const progressReadStart = baseProgress + 5;
            updateProgress('enc', progressReadStart, `Reading ${file.name}...`);
            await sleep(50);
            
            let fileBuf;
            if (isLargeFile) {
                const reader = new FileReader();
                const readPromise = new Promise((resolve, reject) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const readProgress = progressReadStart + ((e.loaded / e.total) * 15);
                            updateProgress('enc', readProgress, `Reading ${file.name}... ${Math.round((e.loaded / e.total) * 100)}%`);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                });
                fileBuf = await readPromise;
            } else {
                fileBuf = await file.arrayBuffer();
            }
            
            // Calculate SHA-256 hash
            const progressHashStart = baseProgress + 20;
            updateProgress('enc', progressHashStart, `Calculating hash for ${file.name}...`);
            await sleep(10);
            const fileHash = await calculateSHA256(fileBuf);
            
            // Metadata (sensitive original MIME type stored encrypted)
            const meta = {
                filename: origName,
                extension: origExt,
                mimeType: file.type || 'application/octet-stream',
                timestamp: Date.now(),
                vlmrsVersion: 1,
                encryption: "AES-256-GCM",
                kdf: { algorithm: "PBKDF2-HMAC-SHA-256", iterations: iterations },
                tool: "VLMRS Encoder",
                credit: "@valmortheos",
                fileHash: fileHash
            };
            
            // Derive key with best-effort memory zeroization of password byte array
            const progressKeyStart = baseProgress + 25;
            updateProgress('enc', progressKeyStart, `Deriving key for ${file.name}...`);
            await sleep(50);
            
            const passBytes = new TextEncoder().encode(pass1);
            const keyMaterial = await crypto.subtle.importKey("raw", passBytes, "PBKDF2", false, ["deriveKey"]);
            passBytes.fill(0); // Best-effort zeroize password byte buffer

            const key = await crypto.subtle.deriveKey(
                { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );
            
            // Prepare metadata
            const metaString = JSON.stringify(meta);
            const metaBytes = new TextEncoder().encode(metaString);
            
            // Header
            const headerBaseLen = 15;
            const finalHeaderBuf = new ArrayBuffer(headerBaseLen);
            const finalHeaderView = new DataView(finalHeaderBuf);
            const finalHeader8 = new Uint8Array(finalHeaderBuf);
            
            finalHeader8[0] = 86; finalHeader8[1] = 76; finalHeader8[2] = 77; finalHeader8[3] = 82;
            finalHeader8[4] = 1;
            finalHeader8[5] = 16;
            finalHeader8[6] = 12;
            finalHeaderView.setUint32(7, 0, true);
            finalHeaderView.setUint32(11, iterations, true);
            
            // AAD for metadata (encryptedMetaLen = 0)
            const metadataAAD = new Uint8Array(finalHeaderBuf.slice(0));
            
            // Encrypt metadata
            updateProgress('enc', progressKeyStart + 10, `Encrypting metadata for ${file.name}...`);
            await sleep(10);
            
            const encryptedMeta = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv, additionalData: metadataAAD },
                key,
                metaBytes
            );
            metaBytes.fill(0); // Best-effort zeroize plaintext metadata byte buffer
            
            // Update header with actual encryptedMetaLen
            finalHeaderView.setUint32(7, encryptedMeta.byteLength, true);
            
            // AAD for file (encryptedMetaLen aktual)
            const fileAAD = new Uint8Array(finalHeaderBuf);
            
            // Encrypt file
            const progressEncStart = baseProgress + 60;
            updateProgress('enc', progressEncStart, `Encrypting ${file.name}...`);
            await sleep(50);
            
            let ciphertextBuf;
            if (isLargeFile) {
                const chunkCount = Math.min(10, Math.ceil(fileBuf.byteLength / (10 * 1024 * 1024)));
                const chunkSize = Math.ceil(fileBuf.byteLength / chunkCount);
                const chunks = [];
                
                for (let c = 0; c < chunkCount; c++) {
                    const start = c * chunkSize;
                    const end = Math.min(start + chunkSize, fileBuf.byteLength);
                    const chunk = fileBuf.slice(start, end);
                    chunks.push(chunk);
                    
                    const chunkProgress = progressEncStart + ((c / chunkCount) * 30);
                    updateProgress('enc', chunkProgress, `Encrypting ${file.name}... ${Math.round((c / chunkCount) * 100)}%`);
                    await sleep(0);
                }
                
                const combinedBuf = new Uint8Array(fileBuf.byteLength);
                let offset = 0;
                for (const chunk of chunks) {
                    combinedBuf.set(new Uint8Array(chunk), offset);
                    offset += chunk.byteLength;
                }
                
                ciphertextBuf = await crypto.subtle.encrypt(
                    { name: "AES-GCM", iv: iv, additionalData: fileAAD },
                    key,
                    combinedBuf.buffer
                );
                combinedBuf.fill(0); // Best-effort zeroize combined plaintext buffer
            } else {
                ciphertextBuf = await crypto.subtle.encrypt(
                    { name: "AES-GCM", iv: iv, additionalData: fileAAD },
                    key,
                    fileBuf
                );
            }
            
            // Best-effort zeroization of plaintext input file buffer
            try { new Uint8Array(fileBuf).fill(0); } catch(e) {}

            // Final assembly
            const progressFinalStart = baseProgress + 92;
            updateProgress('enc', progressFinalStart, `Finalizing ${file.name}...`);
            await sleep(50);
            
            const finalBuf = new Uint8Array(15 + 16 + 12 + encryptedMeta.byteLength + ciphertextBuf.byteLength);
            let offset2 = 0;
            
            finalBuf.set(new Uint8Array(finalHeaderBuf), offset2);
            offset2 += 15;
            
            finalBuf.set(salt, offset2);
            offset2 += 16;
            
            finalBuf.set(iv, offset2);
            offset2 += 12;
            
            finalBuf.set(new Uint8Array(encryptedMeta), offset2);
            offset2 += encryptedMeta.byteLength;
            
            finalBuf.set(new Uint8Array(ciphertextBuf), offset2);
            
            const finalBlob = new Blob([finalBuf], {type: "application/octet-stream"});
            const blobUrl = URL.createObjectURL(finalBlob);
            
            encodedBlobUrls.push(blobUrl);
            currentEncodeResults.push({
                blob: finalBlob,
                url: blobUrl,
                originalName: origName + origExt,
                encodedName: origName + '.vlmrs',
                size: finalBlob.size,
                metadata: meta,
                name: origName + origExt,
                type: 'application/octet-stream'
            });
            
            const finalProgress = ((i + 1) / totalFiles) * 100;
            updateProgress('enc', finalProgress, `Completed ${file.name}`);
            await sleep(100);
        }
        
        await saveHistoryEntry('encode', currentEncodeResults);
        displayDownloadButtons('enc', currentEncodeResults);
        
        setStatus('enc', 'success', `${totalFiles} file(s) encoded successfully! Ready to download.`);
        document.getElementById('enc-form').style.display = 'none';
        document.getElementById('enc-reset').style.display = 'block';
        
    } catch (error) {
        console.error('Encoding process error:', error.message);
        setStatus('enc', 'error', 'Encoding error: ' + error.message);
    } finally {
        btn.disabled = false;
        setTimeout(() => {
            document.getElementById('enc-progress-area').style.display = 'none';
        }, 1000);
    }
};

const displayDownloadButtons = (view, files) => {
    const downloadArea = document.getElementById(`${view}-download-buttons`);
    downloadArea.innerHTML = '';
    
    files.forEach((file, index) => {
        const group = document.createElement('div');
        group.className = 'download-btn-group';
        
        const originalNameDiv = document.createElement('div');
        originalNameDiv.className = 'original-name';
        originalNameDiv.innerHTML = `
            <span class="file-original-label">Original: ${file.originalName || file.filename}</span>
            <span style="font-size:0.85rem; color:var(--text-secondary);">${formatBytes(file.size)}</span>
        `;
        
        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.className = 'rename-input';
        renameInput.value = file.encodedName || file.filename || file.name;
        renameInput.placeholder = 'Enter custom filename...';
        renameInput.title = 'Edit filename or leave as original';
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-success';
        downloadBtn.textContent = 'Download';
        downloadBtn.onclick = () => {
            const customName = renameInput.value.trim() || (file.encodedName || file.filename || file.name);
            downloadBlob(file.blob, customName);
        };
        
        group.appendChild(originalNameDiv);
        group.appendChild(renameInput);
        group.appendChild(downloadBtn);
        downloadArea.appendChild(group);
    });
    
    document.getElementById(`${view}-download-area`).style.display = 'block';
};

const updateProgress = (view, percentage, message) => {
    const progressBar = document.getElementById(`${view}-progress-bar`);
    const progressText = document.getElementById(`${view}-progress-text`);
    const progressPercentage = document.getElementById(`${view}-progress-percentage`);
    
    const clampedPercentage = Math.min(100, Math.max(0, percentage));
    
    if (progressBar) progressBar.style.width = `${clampedPercentage}%`;
    if (progressText) progressText.textContent = message;
    if (progressPercentage) progressPercentage.textContent = `${Math.round(clampedPercentage)}%`;
};

const resetEncoder = () => {
    encodedBlobUrls.forEach(url => URL.revokeObjectURL(url));
    encodedBlobUrls = [];
    currentEncodeFiles = [];
    currentEncodeResults = [];

    const p1 = document.getElementById('enc-pass');
    const p2 = document.getElementById('enc-pass-confirm');
    if (p1) p1.value = '';
    if (p2) p2.value = '';

    const fileInput = document.getElementById('enc-file');
    if (fileInput) fileInput.value = '';

    document.getElementById('enc-files-list').innerHTML = '';
    document.getElementById('enc-form').style.display = 'none';
    document.getElementById('enc-download-area').style.display = 'none';
    document.getElementById('enc-progress-area').style.display = 'none';
    document.getElementById('enc-status').style.display = 'none';
    document.getElementById('enc-reset').style.display = 'none';
};

// Decoder logic
const decDropzone = document.getElementById('dec-dropzone');
const decFileInput = document.getElementById('dec-file');

const handleDecFileSelect = async (files) => {
    if (!files || files.length === 0) return;
    
    currentDecodeBuffers = [];
    parsedMetadata = [];
    parsedHeaderLens = [];
    encryptedMetaLengths = [];
    
    const validFiles = [];
    
    for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.vlmrs')) {
            continue;
        }
        
        try {
            const buffer = await file.arrayBuffer();
            if (buffer.byteLength < 15) continue;
            
            const headerView = new DataView(buffer);
            const header8 = new Uint8Array(buffer);
            
            if (header8[0] !== 86 || header8[1] !== 76 || header8[2] !== 77 || header8[3] !== 82) continue;
            
            const version = header8[4];
            if (version !== 1) continue;
            
            const saltLen = header8[5];
            const ivLen = header8[6];
            const encryptedMetaLen = headerView.getUint32(7, true);
            const iterations = headerView.getUint32(11, true);
            
            const headerLen = 15;
            const totalHeaderLen = headerLen + saltLen + ivLen + encryptedMetaLen;
            
            if (buffer.byteLength < totalHeaderLen) continue;
            if (encryptedMetaLen === 0) continue;
            
            currentDecodeBuffers.push(buffer);
            encryptedMetaLengths.push(encryptedMetaLen);
            parsedHeaderLens.push(headerLen);
            parsedMetadata.push(null);
            validFiles.push(file);
        } catch (error) {
            console.error('Error parsing file:', file.name, error);
        }
    }
    
    if (validFiles.length === 0) {
        return setStatus('dec', 'error', 'No valid .vlmrs files found.');
    }
    
    document.getElementById('dec-form').style.display = 'block';
    document.getElementById('dec-download-area').style.display = 'none';
    document.getElementById('dec-preview-area').style.display = 'none';
    document.getElementById('dec-status').style.display = 'none';
    document.getElementById('dec-reset').style.display = 'none';
    
    displayDecoderFiles(validFiles);
};

const displayDecoderFiles = (files) => {
    const filesList = document.getElementById('dec-files-list');
    filesList.innerHTML = '';
    
    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const header = document.createElement('div');
        header.className = 'file-item-header';
        header.onclick = () => toggleFileExpansion(fileItem);
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        const displayName = file.name.replace(/\.vlmrs$/i, '');
        
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = displayName;
        
        const fileMeta = document.createElement('div');
        fileMeta.className = 'file-meta';
        fileMeta.textContent = `Encrypted with VLMRS v1 • Click "Decode" to decrypt`;
        
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileMeta);
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'file-item-toggle';
        toggleBtn.textContent = 'Info';
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFileExpansion(fileItem);
        };
        
        header.appendChild(fileInfo);
        header.appendChild(toggleBtn);
        
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'file-preview-container';
        detailsContainer.style.display = 'none';
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'file-details';
        
        const details = {
            'File': file.name,
            'Size': formatBytes(file.size),
            'Status': '🔒 Encrypted - Decrypt to view metadata'
        };
        
        Object.entries(details).forEach(([key, value]) => {
            const row = document.createElement('div');
            row.className = 'detail-row';
            row.innerHTML = `<span>${key}</span><span>${value}</span>`;
            detailsDiv.appendChild(row);
        });
        
        detailsContainer.appendChild(detailsDiv);
        fileItem.appendChild(header);
        fileItem.appendChild(detailsContainer);
        filesList.appendChild(fileItem);
    });
};

decDropzone.addEventListener('click', () => decFileInput.click());
decDropzone.addEventListener('dragover', (e) => { e.preventDefault(); decDropzone.classList.add('dragover'); });
decDropzone.addEventListener('dragleave', () => decDropzone.classList.remove('dragover'));
decDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    decDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleDecFileSelect(e.dataTransfer.files);
});
decFileInput.addEventListener('change', (e) => handleDecFileSelect(e.target.files));

const startDecoding = async () => {
    const passInput = document.getElementById('dec-pass');
    const pass = passInput ? passInput.value : '';
    if (!pass) return setStatus('dec', 'error', 'Password cannot be empty.');
    if (!currentDecodeBuffers.length) return setStatus('dec', 'error', 'No valid files parsed.');
    
    const btn = document.getElementById('dec-btn');
    btn.disabled = true;
    
    decryptedBlobs.forEach(url => URL.revokeObjectURL(url));
    decryptedBlobs = [];
    currentDecodeResults = [];
    
    document.getElementById('dec-progress-area').style.display = 'block';
    
    try {
        const totalFiles = currentDecodeBuffers.length;
        
        for (let i = 0; i < totalFiles; i++) {
            const baseProgress = (i / totalFiles) * 100;
            
            updateProgress('dec', baseProgress, `Processing file ${i + 1} of ${totalFiles}...`);
            await sleep(50);
            
            const buffer = currentDecodeBuffers[i];
            const headerLen = parsedHeaderLens[i];
            const encryptedMetaLen = encryptedMetaLengths[i];
            
            const headerView = new DataView(buffer);
            const header8 = new Uint8Array(buffer);
            
            const saltLen = header8[5];
            const ivLen = header8[6];
            const iterations = headerView.getUint32(11, true);
            
            const saltStart = headerLen;
            const saltEnd = saltStart + saltLen;
            const salt = new Uint8Array(buffer.slice(saltStart, saltEnd));
            
            const ivStart = saltEnd;
            const ivEnd = ivStart + ivLen;
            const iv = new Uint8Array(buffer.slice(ivStart, ivEnd));
            
            const encryptedMetaStart = ivEnd;
            const encryptedMetaEnd = encryptedMetaStart + encryptedMetaLen;
            const encryptedMeta = buffer.slice(encryptedMetaStart, encryptedMetaEnd);
            
            // AAD for metadata
            const metadataAAD = new Uint8Array(buffer.slice(0, headerLen));
            const metadataAADView = new DataView(metadataAAD.buffer);
            metadataAADView.setUint32(7, 0, true);
            
            // Derive key with best-effort memory zeroization of password byte array
            const progressKeyStart = baseProgress + 10;
            updateProgress('dec', progressKeyStart, `Deriving key for file ${i + 1}...`);
            await sleep(50);
            
            const passBytes = new TextEncoder().encode(pass);
            const keyMaterial = await crypto.subtle.importKey("raw", passBytes, "PBKDF2", false, ["deriveKey"]);
            passBytes.fill(0); // Best-effort zeroize password byte buffer

            const key = await crypto.subtle.deriveKey(
                { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["decrypt"]
            );
            
            // Decrypt metadata
            const progressMetaStart = baseProgress + 30;
            updateProgress('dec', progressMetaStart, `Decrypting metadata for file ${i + 1}...`);
            await sleep(50);
            
            let metadata;
            try {
                const decryptedMetaBuf = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: iv, additionalData: metadataAAD },
                    key,
                    encryptedMeta
                );
                
                const metaString = new TextDecoder().decode(decryptedMetaBuf);
                try { new Uint8Array(decryptedMetaBuf).fill(0); } catch(e){} // Zeroize metadata plaintext buffer

                metadata = JSON.parse(metaString);
                parsedMetadata[i] = metadata;
            } catch (error) {
                throw new Error('Failed to decrypt metadata - incorrect password or corrupted file');
            }
            
            // Decrypt file
            const progressDecStart = baseProgress + 50;
            updateProgress('dec', progressDecStart, `Decrypting file ${i + 1}...`);
            await sleep(50);
            
            const ciphertextStart = encryptedMetaEnd;
            const ciphertext = buffer.slice(ciphertextStart);
            
            // AAD for file
            const fileAAD = new Uint8Array(buffer.slice(0, headerLen));
            
            let decryptedBuf;
            
            try {
                decryptedBuf = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: iv, additionalData: fileAAD },
                    key,
                    ciphertext
                );
            } catch (error) {
                throw new Error('Failed to decrypt file content - incorrect password or corrupted file');
            }
            
            // Verify hash
            const progressHashStart = baseProgress + 85;
            updateProgress('dec', progressHashStart, `Verifying integrity for file ${i + 1}...`);
            await sleep(10);
            
            let hashVerified = false;
            if (metadata && metadata.fileHash) {
                const decryptedHash = await calculateSHA256(decryptedBuf);
                hashVerified = decryptedHash === metadata.fileHash;
                if (!hashVerified) {
                    console.warn('Hash verification failed for file:', metadata.filename);
                }
            }
            
            const progressFinalStart = baseProgress + 92;
            updateProgress('dec', progressFinalStart, `Finalizing file ${i + 1}...`);
            await sleep(50);
            
            let defaultName;
            if (metadata && metadata.filename && metadata.extension) {
                defaultName = metadata.filename + metadata.extension;
            } else {
                const originalFile = document.getElementById('dec-file').files[i];
                defaultName = originalFile ? originalFile.name.replace(/\.vlmrs$/i, '') : `decrypted_${i + 1}`;
            }
            
            // Determine original MIME type only after successful decryption and verification
            let restoredMimeType = 'application/octet-stream';
            if (metadata && metadata.mimeType) {
                restoredMimeType = metadata.mimeType;
            } else if (metadata && metadata.extension) {
                // Backward compatibility for legacy .vlmrs files missing metadata.mimeType
                const cleanExt = metadata.extension.replace(/^\./, '').toLowerCase();
                const mimeMap = {
                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
                    'webp': 'image/webp', 'svg': 'image/svg+xml', 'bmp': 'image/bmp', 'ico': 'image/x-icon',
                    'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg', 'mov': 'video/quicktime',
                    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac',
                    'pdf': 'application/pdf', 'txt': 'text/plain', 'html': 'text/html', 'css': 'text/css',
                    'js': 'text/javascript', 'json': 'application/json', 'csv': 'text/csv', 'zip': 'application/zip'
                };
                restoredMimeType = mimeMap[cleanExt] || 'application/octet-stream';
            }

            const blob = new Blob([decryptedBuf], { type: restoredMimeType });
            const blobUrl = URL.createObjectURL(blob);
            
            decryptedBlobs.push(blobUrl);
            currentDecodeResults.push({
                blob: blob,
                url: blobUrl,
                filename: defaultName,
                size: blob.size,
                metadata: metadata || {},
                hashVerified: hashVerified,
                name: defaultName,
                type: restoredMimeType
            });
            
            const finalProgress = ((i + 1) / totalFiles) * 100;
            updateProgress('dec', finalProgress, `Completed file ${i + 1}`);
            await sleep(100);
        }
        
        await saveHistoryEntry('decode', currentDecodeResults);
        
        displayDownloadButtons('dec', currentDecodeResults);
        displayDecryptedPreviews(currentDecodeResults);
        
        setStatus('dec', 'success', `${totalFiles} file(s) decrypted successfully!`);
        document.getElementById('dec-form').style.display = 'none';
        document.getElementById('dec-reset').style.display = 'block';
        
    } catch (error) {
        setStatus('dec', 'error', 'Decryption failed! ' + error.message);
    } finally {
        btn.disabled = false;
        setTimeout(() => {
            document.getElementById('dec-progress-area').style.display = 'none';
        }, 1000);
    }
};

const displayDecryptedPreviews = (files) => {
    const previewList = document.getElementById('dec-preview-list');
    previewList.innerHTML = '';
    
    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'preview-file-item';
        
        const header = document.createElement('div');
        header.className = 'preview-file-header';
        
        const fileName = document.createElement('span');
        fileName.className = 'preview-file-name';
        fileName.textContent = file.filename || file.name;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'file-item-toggle';
        toggleBtn.textContent = 'Preview';
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            const content = header.nextElementSibling;
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? 'Hide' : 'Preview';
        };
        
        header.appendChild(fileName);
        header.appendChild(toggleBtn);
        
        const content = document.createElement('div');
        content.className = 'preview-file-content';
        content.style.display = 'none';
        
        const previewArea = document.createElement('div');
        previewArea.className = 'preview-area';
        generatePreview(file.blob, previewArea, file.filename || file.name);
        
        content.appendChild(previewArea);
        
        const metadataDetail = document.createElement('div');
        metadataDetail.className = 'metadata-detail';
        
        const metaTitle = document.createElement('div');
        metaTitle.className = 'meta-title';
        metaTitle.textContent = '📋 File Details';
        metadataDetail.appendChild(metaTitle);
        
        const metaGrid = document.createElement('div');
        metaGrid.className = 'meta-grid';
        
        const metadata = file.metadata || {};
        const detailItems = {};
        
        if (metadata.filename) {
            detailItems['Filename'] = metadata.filename + (metadata.extension || '');
        }
        if (metadata.mimeType || file.type) {
            detailItems['Original MIME Type'] = metadata.mimeType || file.type;
        }
        if (metadata.timestamp) {
            detailItems['Encrypted On'] = new Date(metadata.timestamp).toLocaleString();
        }
        if (metadata.vlmrsVersion) {
            detailItems['VLMRS Version'] = `v${metadata.vlmrsVersion}`;
        }
        if (metadata.encryption) {
            detailItems['Encryption'] = metadata.encryption;
        }
        if (metadata.kdf) {
            detailItems['KDF'] = `${metadata.kdf.algorithm} (${metadata.kdf.iterations} iterations)`;
        }
        if (metadata.fileHash) {
            detailItems['SHA-256 Hash'] = metadata.fileHash.substring(0, 16) + '...';
        }
        if (file.hashVerified !== undefined) {
            detailItems['Integrity'] = file.hashVerified ? '✅ Verified' : '❌ Failed';
        }
        if (metadata.tool) {
            detailItems['Tool'] = metadata.tool;
        }
        if (metadata.credit) {
            detailItems['Credit'] = metadata.credit;
        }
        
        Object.entries(detailItems).forEach(([key, value]) => {
            const item = document.createElement('div');
            item.className = 'meta-item';
            item.innerHTML = `<strong>${key}:</strong> ${value}`;
            metaGrid.appendChild(item);
        });
        
        metadataDetail.appendChild(metaGrid);
        content.appendChild(metadataDetail);
        
        fileItem.appendChild(header);
        fileItem.appendChild(content);
        previewList.appendChild(fileItem);
    });
    
    document.getElementById('dec-preview-area').style.display = 'block';
};

const resetDecoder = () => {
    decryptedBlobs.forEach(url => URL.revokeObjectURL(url));
    decryptedBlobs = [];

    // Best-effort zeroization of buffers in application memory
    currentDecodeBuffers.forEach(buf => {
        try { new Uint8Array(buf).fill(0); } catch (e) {}
    });
    currentDecodeBuffers = [];
    parsedMetadata = [];
    parsedHeaderLens = [];
    encryptedMetaLengths = [];
    currentDecodeResults = [];

    const p = document.getElementById('dec-pass');
    if (p) p.value = '';

    const f = document.getElementById('dec-file');
    if (f) f.value = '';

    document.getElementById('dec-files-list').innerHTML = '';
    document.getElementById('dec-form').style.display = 'none';
    document.getElementById('dec-download-area').style.display = 'none';
    document.getElementById('dec-preview-area').style.display = 'none';
    document.getElementById('dec-progress-area').style.display = 'none';
    document.getElementById('dec-status').style.display = 'none';
    document.getElementById('dec-reset').style.display = 'none';
};

// Revoke resources on page unload as best-effort cleanup
window.addEventListener('beforeunload', () => {
    try {
        encodedBlobUrls.forEach(url => URL.revokeObjectURL(url));
        decryptedBlobs.forEach(url => URL.revokeObjectURL(url));
        currentDecodeBuffers.forEach(buf => {
            try { new Uint8Array(buf).fill(0); } catch (e) {}
        });
    } catch (e) {}
});