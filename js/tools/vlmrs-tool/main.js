import { ThemeManager } from '../../shared/theme-manager.js';
import { UIUtils } from '../../shared/ui-utils.js';
import { EncoderUI } from './ui/encoder-ui.js';
import { DecoderUI } from './ui/decoder-ui.js';
import { HistoryManager } from './storage/history-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => ThemeManager.toggleTheme());
    }

    const encoderUI = new EncoderUI();
    const decoderUI = new DecoderUI();

    // Setup Password Toggle Buttons
    const btnToggleEncPass = document.getElementById('btn-toggle-enc-pass');
    if (btnToggleEncPass) {
        btnToggleEncPass.addEventListener('click', () => {
            UIUtils.togglePassword('enc-pass', btnToggleEncPass);
        });
    }

    const btnToggleDecPass = document.getElementById('btn-toggle-dec-pass');
    if (btnToggleDecPass) {
        btnToggleDecPass.addEventListener('click', () => {
            UIUtils.togglePassword('dec-pass', btnToggleDecPass);
        });
    }

    // Tabs switching with ARIA accessibility updates (Requirement 5)
    const tabEncoder = document.getElementById('tab-encoder');
    const tabDecoder = document.getElementById('tab-decoder');
    const tabHistory = document.getElementById('tab-history');

    const switchTab = (tabName) => {
        const tabs = [tabEncoder, tabDecoder, tabHistory].filter(Boolean);
        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });

        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

        const activeTab = document.getElementById(`tab-${tabName}`);
        const activeView = document.getElementById(`view-${tabName}`);

        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
        }
        if (activeView) {
            activeView.classList.add('active');
        }

        if (tabName === 'history') {
            loadHistoryDisplay();
        }
    };

    if (tabEncoder) tabEncoder.addEventListener('click', () => switchTab('encoder'));
    if (tabDecoder) tabDecoder.addEventListener('click', () => switchTab('decoder'));
    if (tabHistory) tabHistory.addEventListener('click', () => switchTab('history'));

    // Clear History Button
    const btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
        btnClearHistory.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear all operation history?")) {
                await HistoryManager.clearHistory();
                loadHistoryDisplay();
                UIUtils.showToast("History cleared", "info");
            }
        });
    }

    async function loadHistoryDisplay() {
        const container = document.getElementById('history-list');
        if (!container) return;

        const history = await HistoryManager.getHistory();
        if (!history || history.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center">No history records found.</p>';
            return;
        }

        container.innerHTML = '';
        history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card mb-2 history-item-row';
            const dateStr = new Date(item.timestamp).toLocaleString();

            card.innerHTML = `
                <div class="history-item-main">
                    <strong>${item.action}: ${item.filename}</strong>
                    <span class="badge ${item.action === 'Encode' ? 'badge-danger' : 'badge-success'}">${item.mode || 'FULL'}</span>
                    <div class="text-secondary text-sm mt-1">Output: ${item.outputFilename} | Size: ${UIUtils.formatBytes(item.size)}</div>
                </div>
                <div class="history-timestamp">${dateStr}</div>
            `;
            container.appendChild(card);
        });
    }
});
