class StorageService {
    constructor() {
        this.dbName = 'EssentialSpaceDB';
        this.dbVersion = 3; // Increment for tags
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("Database error: " + event.target.errorCode);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("notes")) {
                    const objectStore = db.createObjectStore("notes", { keyPath: "id", autoIncrement: true });
                    objectStore.createIndex("type", "type", { unique: false });
                    objectStore.createIndex("timestamp", "timestamp", { unique: false });
                }
                // No new index needed for tags array unless we want to query by tag directly, 
                // but filtering in memory is fine for this scale.
            };
        });
    }

    async addNote(note) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["notes"], "readwrite");
            const objectStore = transaction.objectStore("notes");
            const newNote = {
                ...note,
                isPinned: false,
                tags: note.tags || [], // Ensuring that a tags array exists
                timestamp: note.timestamp || new Date().toISOString()
            };
            const request = objectStore.add(newNote);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async updateNote(note) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["notes"], "readwrite");
            const objectStore = transaction.objectStore("notes");
            const request = objectStore.put(note);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async getAllNotes(filterTag = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["notes"], "readonly");
            const objectStore = transaction.objectStore("notes");
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                let notes = event.target.result;

                // Filter by tag if provided
                if (filterTag) {
                    notes = notes.filter(note => note.tags && note.tags.includes(filterTag));
                }

                // Sort: Pinned first, then by timestamp descending, yall can change the order based on your wishes. I may add a feature to change order manually later.
                notes.sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return new Date(b.timestamp) - new Date(a.timestamp);
                });
                resolve(notes);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async deleteNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["notes"], "readwrite");
            const objectStore = transaction.objectStore("notes");
            const request = objectStore.delete(id);

            request.onsuccess = (event) => {
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async togglePin(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["notes"], "readwrite");
            const objectStore = transaction.objectStore("notes");
            const request = objectStore.get(id);

            request.onsuccess = (event) => {
                const note = event.target.result;
                if (note) {
                    note.isPinned = !note.isPinned;
                    const updateRequest = objectStore.put(note);
                    updateRequest.onsuccess = () => resolve(note.isPinned);
                    updateRequest.onerror = (e) => reject(e.target.error);
                } else {
                    reject("Note not found");
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getUpcomingEvents() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["notes"], "readonly");
            const objectStore = transaction.objectStore("notes");
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                const now = new Date();
                const notes = event.target.result;
                const events = notes.filter(n =>
                    n.type === '[EVENT]' &&
                    n.eventDate &&
                    new Date(n.eventDate) > now
                );

                // Sort by date ascending (nearest first)
                events.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
                resolve(events);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async getRecentMedia() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["notes"], "readonly");
            const objectStore = transaction.objectStore("notes");
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                const notes = event.target.result;
                // Filter for items with images
                const media = notes.filter(n => n.imageData);
                // Sort by timestamp desc
                media.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(media[0] || null); // Return newest or null
            };
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async getUniqueTags() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["notes"], "readonly");
            const objectStore = transaction.objectStore("notes");
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                const notes = event.target.result;
                const tags = new Set();
                notes.forEach(note => {
                    if (note.tags && Array.isArray(note.tags)) {
                        note.tags.forEach(tag => tags.add(tag));
                    }
                });
                resolve(Array.from(tags).sort());
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}

// Export instance
const db = new StorageService();
