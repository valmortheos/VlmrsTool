import { UIUtils } from '../../../shared/ui-utils.js';

export class ProgressManager {
    static updateProgress(view, percent, message) {
        const bar = document.getElementById(`${view}-progress-bar`);
        const text = document.getElementById(`${view}-progress-text`);
        const container = document.getElementById(`${view}-progress-container`);

        if (container) container.style.display = 'block';
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.innerText = `${percent}% - ${message}`;
    }

    static hideProgress(view) {
        const container = document.getElementById(`${view}-progress-container`);
        if (container) container.style.display = 'none';
    }
}
