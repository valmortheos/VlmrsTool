import { DB_CONFIG } from '../../../shared/constants.js';

export class HistoryManager {
    static db = null;

    static async getDB() {
        if (HistoryManager.db) return HistoryManager.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(DB_CONFIG.STORE_NAME)) {
                    const store = db.createObjectStore(DB_CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                HistoryManager.db = event.target.result;
                resolve(HistoryManager.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    static async addEntry(entry) {
        try {
            const db = await HistoryManager.getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(DB_CONFIG.STORE_NAME, 'readwrite');
                const store = tx.objectStore(DB_CONFIG.STORE_NAME);
                const record = {
                    ...entry,
                    timestamp: Date.now()
                };
                const req = store.add(record);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error("Failed to save history entry:", e);
        }
    }

    static async getHistory() {
        try {
            const db = await HistoryManager.getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(DB_CONFIG.STORE_NAME, 'readonly');
                const store = tx.objectStore(DB_CONFIG.STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => {
                    const results = req.result || [];
                    results.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(results);
                };
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error("Failed to load history:", e);
            return [];
        }
    }

    static async clearHistory() {
        try {
            const db = await HistoryManager.getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(DB_CONFIG.STORE_NAME, 'readwrite');
                const store = tx.objectStore(DB_CONFIG.STORE_NAME);
                const req = store.clear();
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error("Failed to clear history:", e);
        }
    }
}
