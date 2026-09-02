/**
 * UI Utility Helpers (Toasts, Formatting, Password Toggles, Filename Sanitization)
 */

export class UIUtils {
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static showToast(message, type = 'info', duration = 3000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let iconHtml = '';
        if (type === 'success') {
            iconHtml = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        } else if (type === 'danger') {
            iconHtml = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
        } else {
            iconHtml = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v1z"/></svg>`;
        }

        toast.innerHTML = `${iconHtml}<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    static togglePassword(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const isPass = input.getAttribute('type') === 'password';
        input.setAttribute('type', isPass ? 'text' : 'password');
        btn.style.color = isPass ? 'var(--accent-color)' : 'var(--text-secondary)';
    }

    static sanitizeFilename(name) {
        if (!name) return 'file';
        // Remove illegal filename characters
        return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file';
    }

    /**
     * Extracts base name and extension from a filename
     */
    static getBaseAndExt(filename) {
        if (!filename) return { base: 'file', ext: '' };
        const lastDot = filename.lastIndexOf('.');
        if (lastDot <= 0) {
            return { base: filename, ext: '' };
        }
        return {
            base: filename.substring(0, lastDot),
            ext: filename.substring(lastDot) // includes dot, e.g. ".pdf"
        };
    }

    /**
     * Computes output filename according to encoder/decoder naming rules
     * @param {string} originalFilename - e.g. "document.pdf" or "secret.vlmrs"
     * @param {string} customBaseName - user provided custom base name
     * @param {number} index - 0-based batch index
     * @param {number} totalFiles - total count of files in batch
     * @param {string} targetExtension - target extension including dot (e.g. ".vlmrs" or ".pdf")
     */
    static computeOutputFilename(originalFilename, customBaseName, index, totalFiles, targetExtension) {
        let baseName = '';

        if (customBaseName && customBaseName.trim().length > 0) {
            const sanitized = UIUtils.sanitizeFilename(customBaseName.trim());
            if (totalFiles > 1) {
                baseName = `${sanitized}_${index + 1}`;
            } else {
                baseName = sanitized;
            }
        } else {
            const parsed = UIUtils.getBaseAndExt(originalFilename);
            baseName = parsed.base;
        }

        const ext = targetExtension.startsWith('.') ? targetExtension : '.' + targetExtension;
        return `${baseName}${ext}`;
    }
}
