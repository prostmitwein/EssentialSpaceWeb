import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

// Skip local model check for browser usage
env.allowLocalModels = false;

document.addEventListener('DOMContentLoaded', async () => {
    const memoryList = document.getElementById('memoryList');
    const pillAddBtn = document.getElementById('pillAddBtn');

    // Modals
    const addModal = document.getElementById('addModal');
    const closeAddModal = document.getElementById('closeAddModal');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const noteType = document.getElementById('noteType');
    const noteContent = document.getElementById('noteContent');
    const noteImage = document.getElementById('noteImage');
    const imageUploadGroup = document.getElementById('imageUploadGroup');
    const eventFields = document.getElementById('eventFields');
    const eventDate = document.getElementById('eventDate');
    const micBtn = document.getElementById('micBtn');
    const aiStatus = document.getElementById('aiStatus');

    // Tag Inputs (Add Modal)
    const addTagInput = document.getElementById('addTagInput');
    const addTagsList = document.getElementById('addTagsList');
    let currentAddTags = [];

    // Tag Inputs (View Modal)
    const viewModal = document.getElementById('viewModal');
    const closeViewModal = document.getElementById('closeViewModal');
    const viewType = document.getElementById('viewType');
    const viewContent = document.getElementById('viewContent');
    const viewTime = document.getElementById('viewTime');
    const viewEventDetails = document.getElementById('viewEventDetails');
    const viewImageContainer = document.getElementById('viewImageContainer');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    const pinNoteBtn = document.getElementById('pinNoteBtn');
    const viewTagInput = document.getElementById('viewTagInput');
    const viewTagsList = document.getElementById('viewTagsList');
    let currentViewTags = [];

    // Widgets
    const recentPreview = document.getElementById('recentPreview');
    const recentText = document.getElementById('recentText');
    const recentTime = document.getElementById('recentTime');
    const upcomingTitle = document.getElementById('upcomingTitle');
    const upcomingDesc = document.getElementById('upcomingDesc');
    const upcomingTime = document.getElementById('upcomingTime');

    // Sidebar
    const tagFilterList = document.getElementById('tagFilterList');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const filterSidebar = document.querySelector('.filter-sidebar');

    let currentViewId = null;
    let currentNote = null;
    let currentFilter = null;
    let classifier = null;

    // Header Live Clock & Item Count
    const headerClock = document.getElementById('headerClock');
    const itemCountDisplay = document.getElementById('itemCountDisplay');

    function updateHeaderClock() {
        if (headerClock) {
            const now = new Date();
            headerClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }
    setInterval(updateHeaderClock, 1000);
    updateHeaderClock();

    // Initialize DB
    try {
        await db.init();
        await refreshAll();
    } catch (err) {
        console.error("Failed to init DB:", err);
    }

    async function refreshAll() {
        await loadNotes();
        await updateWidgets();
        await updateFilterSidebar();
        await refreshOverviewData();
    }

    // Load Notes
    async function loadNotes() {
        const notes = await db.getAllNotes(currentFilter);
        renderItems(notes);
    }

    // Update Widgets
    async function updateWidgets() {
        // Recent Widget
        if (recentPreview) {
            const recent = await db.getRecentMedia();
            if (recent) {
                recentPreview.style.backgroundImage = `url(${recent.imageData})`;
                if (recentText) recentText.textContent = recent.content || 'Image Capture';
                if (recentTime) recentTime.textContent = new Date(recent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                recentPreview.style.backgroundImage = 'none';
                if (recentText) recentText.textContent = 'No recent media';
                if (recentTime) recentTime.textContent = '--:--';
            }
        }

        // Upcoming Widget
        if (upcomingTitle) {
            const upcoming = await db.getUpcomingEvents();
            if (upcoming && upcoming.length > 0) {
                const nextEvent = upcoming[0];
                upcomingTitle.textContent = nextEvent.content;
                if (upcomingDesc) upcomingDesc.textContent = new Date(nextEvent.eventDate).toLocaleDateString();
                if (upcomingTime) upcomingTime.textContent = new Date(nextEvent.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                upcomingTitle.textContent = 'No upcoming events';
                if (upcomingDesc) upcomingDesc.textContent = '';
                if (upcomingTime) upcomingTime.textContent = '--:--';
            }
        }
    }

    function getTagsFromNote(n) {
        const set = new Set();
        if (n.tags) {
            let list = [];
            if (Array.isArray(n.tags)) {
                list = n.tags;
            } else if (typeof n.tags === 'string') {
                try {
                    const parsed = JSON.parse(n.tags);
                    if (Array.isArray(parsed)) list = parsed;
                    else list = n.tags.split(/[,#\s]+/);
                } catch (e) {
                    list = n.tags.split(/[,#\s]+/);
                }
            }
            list.forEach(t => {
                if (t) {
                    const clean = String(t).trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/^#/, '');
                    if (clean) set.add(clean);
                }
            });
        }
        const textToScan = ((n.content || '') + ' ' + (n.transcript || '') + ' ' + (n.title || '')).toLowerCase();
        const matches = textToScan.match(/#([a-zA-Z0-9_\-\u00C0-\u024F]+)/g);
        if (matches) {
            matches.forEach(m => {
                const clean = m.replace(/^#/, '').trim().toLowerCase();
                if (clean) set.add(clean);
            });
        }
        return Array.from(set);
    }

    // Update Filter Sidebar
    async function updateFilterSidebar() {
        if (!tagFilterList) return;
        const allNotes = await db.getAllNotes();
        const tagCounts = {};
        allNotes.forEach(n => {
            const tags = getTagsFromNote(n);
            tags.forEach(clean => {
                tagCounts[clean] = (tagCounts[clean] || 0) + 1;
            });
        });

        const activeTag = currentFilter ? currentFilter.toLowerCase().replace(/^#/, '') : null;
        tagFilterList.innerHTML = `<li class="${activeTag === null ? 'active' : ''}" data-tag="all">ALL (${allNotes.length})</li>`;

        Object.keys(tagCounts).sort().forEach(tag => {
            const li = document.createElement('li');
            li.textContent = `${tag.toUpperCase()} (${tagCounts[tag]})`;
            li.dataset.tag = tag;
            if (activeTag === tag) li.classList.add('active');

            li.onclick = () => {
                currentFilter = tag;
                const collectionsBtn = document.getElementById('pillCollectionsBtn');
                if (collectionsBtn) collectionsBtn.click();
                refreshAll();
                closeMobileMenu();
            };
            tagFilterList.appendChild(li);
        });

        const allBtn = tagFilterList.querySelector('[data-tag="all"]');
        if (allBtn) {
            allBtn.onclick = () => {
                currentFilter = null;
                refreshAll();
                closeMobileMenu();
            };
        }
    }

    // Mobile Menu Logic
    function toggleMobileMenu() {
        filterSidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    }

    function closeMobileMenu() {
        filterSidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileMenu();
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            closeMobileMenu();
        });
    }

    function formatType(type) {
        if (!type) return '';
        return type.replace(/^\[|\]$/g, '');
    }

    // Render Items (Grid)
    function renderItems(items) {
        memoryList.innerHTML = '';
        if (itemCountDisplay) {
            itemCountDisplay.textContent = `( ${items.length} )`;
        }
        items.forEach((item, index) => {
            const itemEl = document.createElement('div');
            const seed = (typeof item.id === 'number' ? item.id * 31 : index * 47) + (item.timestamp ? String(item.timestamp).length : 0);
            const isSquare = ((seed * 19 + 7) % 5) < 2;
            const shapeClass = isSquare ? 'shape-square' : 'shape-rect';

            itemEl.onclick = () => openViewModal(item);

            const timeString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const pinHtml = item.isPinned ? '<div class="pinned-badge">PINNED</div>' : '';
            const typeBadge = formatType(item.type) || 'NOTE';

            let tagsHtml = '';
            if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
                tagsHtml = `<div class="item-tags">${item.tags.map(t => `<span class="item-tag">#${t.replace(/^#/, '')}</span>`).join('')}</div>`;
            }

            if (item.imageData) {
                itemEl.className = `memory-item photo-card ${item.isPinned ? 'pinned' : ''} ${shapeClass}`;
                itemEl.style.backgroundImage = `url(${item.imageData})`;
                itemEl.innerHTML = `
                    ${pinHtml}
                    <div class="card-overlay"></div>
                    <div class="card-content-wrap">
                        <div class="item-header-row">
                            <span class="item-type">${typeBadge}</span>
                            ${tagsHtml}
                        </div>
                        <span class="item-content">${item.content || item.transcript || ''}</span>
                        <span class="item-time">${timeString}</span>
                    </div>
                `;
            } else {
                itemEl.className = `memory-item ${item.isPinned ? 'pinned' : ''} ${shapeClass}`;
                let voiceHtml = '';
                if (item.type === '[VOICE]' && item.audioBlob) {
                    voiceHtml = `
                        <div class="audio-player-custom">
                            <button class="audio-play-btn" onclick="event.stopPropagation(); const audio = this.nextElementSibling; audio.paused ? audio.play() : audio.pause();">▶</button>
                            <audio src="${URL.createObjectURL(item.audioBlob)}" onended="this.previousElementSibling.textContent='▶'" onplay="this.previousElementSibling.textContent='⏸'" onpause="this.previousElementSibling.textContent='▶'"></audio>
                            <div class="audio-wave"></div>
                        </div>`;
                }

                let bodyText = item.content || item.transcript || '';
                if (item.type === '[TASK]' && bodyText) {
                    bodyText = `◯ ${bodyText}`;
                }

                itemEl.innerHTML = `
                    ${pinHtml}
                    <div class="item-header-row">
                        <span class="item-type">${typeBadge}</span>
                        ${tagsHtml}
                    </div>
                    <div class="item-body-content">
                        ${voiceHtml}
                        <span class="item-content">${bodyText}</span>
                    </div>
                    <span class="item-time">${timeString}</span>
                `;
            }

            memoryList.appendChild(itemEl);
        });
    }

    // --- AI Integration ---

    // Lazy load classifier
    async function getClassifier() {
        if (!classifier) {
            aiStatus.textContent = 'Loading AI Model...';
            try {
                classifier = await pipeline('image-classification', 'Xenova/resnet-50');
                aiStatus.textContent = 'AI Ready';
            } catch (e) {
                console.error("AI Load Error", e);
                aiStatus.textContent = 'AI Failed';
            }
        }
        return classifier;
    }

    // Image Auto-Tagging
    noteImage.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = async (event) => {
                const imgData = event.target.result;

                // Run AI
                const model = await getClassifier();
                if (model) {
                    aiStatus.textContent = 'Analyzing...';
                    const output = await model(imgData);
                    aiStatus.textContent = 'Done';

                    // Add top 3 tags
                    if (output && output.length > 0) {
                        output.slice(0, 3).forEach(prediction => {
                            addTag(prediction.label, 'add');
                        });
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    });

    // Voice Dictation
    if ('webkitSpeechRecognition' in window) {
        const dictationRecognition = new webkitSpeechRecognition();
        dictationRecognition.continuous = true;
        dictationRecognition.interimResults = true;
        let isDictating = false;

        micBtn.addEventListener('click', () => {
            if (isDictating) {
                dictationRecognition.stop();
                isDictating = false;
                micBtn.classList.remove('recording');
            } else {
                dictationRecognition.start();
                isDictating = true;
                micBtn.classList.add('recording');
            }
        });

        dictationRecognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                noteContent.value += (noteContent.value ? ' ' : '') + finalTranscript;
            }
        };

        dictationRecognition.onerror = (event) => {
            console.error("Speech error", event);
            micBtn.classList.remove('recording');
            isDictating = false;
        };

        dictationRecognition.onend = () => {
            micBtn.classList.remove('recording');
            isDictating = false;
        };
    } else {
        micBtn.style.display = 'none'; // Hide if not supported
    }

    // --- Tag Management ---

    function renderTags(container, tags, mode) {
        container.innerHTML = '';
        tags.forEach(tag => {
            const pill = document.createElement('span');
            pill.className = 'tag-pill';
            pill.innerHTML = `${tag} <span class="remove-tag">×</span>`;
            pill.querySelector('.remove-tag').onclick = (e) => {
                e.stopPropagation();
                removeTag(tag, mode);
            };
            container.appendChild(pill);
        });
    }

    function addTag(tag, mode) {
        const cleanTag = tag.trim().toLowerCase();
        if (!cleanTag) return;

        if (mode === 'add') {
            if (!currentAddTags.includes(cleanTag)) {
                currentAddTags.push(cleanTag);
                renderTags(addTagsList, currentAddTags, 'add');
            }
            addTagInput.value = '';
        } else {
            if (!currentViewTags.includes(cleanTag)) {
                currentViewTags.push(cleanTag);
                renderTags(viewTagsList, currentViewTags, 'view');
                // Auto-save for view mode
                if (currentNote) {
                    currentNote.tags = currentViewTags;
                    db.updateNote(currentNote).then(refreshAll);
                }
            }
            viewTagInput.value = '';
        }
    }

    function removeTag(tag, mode) {
        if (mode === 'add') {
            currentAddTags = currentAddTags.filter(t => t !== tag);
            renderTags(addTagsList, currentAddTags, 'add');
        } else {
            currentViewTags = currentViewTags.filter(t => t !== tag);
            renderTags(viewTagsList, currentViewTags, 'view');
            // Auto-save for view mode
            if (currentNote) {
                currentNote.tags = currentViewTags;
                db.updateNote(currentNote).then(refreshAll);
            }
        }
    }

    addTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(addTagInput.value, 'add');
        }
    });

    viewTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(viewTagInput.value, 'view');
        }
    });

    // Add Modal Logic
    pillAddBtn.addEventListener('click', () => {
        addModal.classList.add('active');
        noteContent.value = '';
        noteImage.value = '';
        noteType.value = '[NOTE]';
        eventDate.value = '';
        imageUploadGroup.style.display = 'none';
        eventFields.style.display = 'none';

        // Reset Tags
        currentAddTags = [];
        renderTags(addTagsList, currentAddTags, 'add');
        aiStatus.textContent = '';

        // Reset Voice Recorder
        if (window.resetVoiceRecorder) window.resetVoiceRecorder();
        document.getElementById('voiceRecorder').style.display = 'none';
    });

    closeAddModal.addEventListener('click', () => {
        addModal.classList.remove('active');
    });

    noteType.addEventListener('change', () => {
        imageUploadGroup.style.display = 'none';
        eventFields.style.display = 'none';
        const vr = document.getElementById('voiceRecorder');
        if (vr) vr.style.display = 'none';

        if (noteType.value === '[PHOTO]') {
            imageUploadGroup.style.display = 'block';
        } else if (noteType.value === '[EVENT]') {
            eventFields.style.display = 'block';
        } else if (noteType.value === '[VOICE]') {
            if (vr) vr.style.display = 'block';
        }
    });

    saveNoteBtn.addEventListener('click', async () => {
        const type = noteType.value;
        const content = noteContent.value;
        let imageData = null;
        let eDate = null;

        if (addTagInput && addTagInput.value.trim()) {
            const typed = addTagInput.value.split(/[,#\s]+/).map(t => t.trim().toLowerCase().replace(/^\[|\]$/g, '')).filter(t => t);
            typed.forEach(t => {
                if (!currentAddTags.includes(t)) currentAddTags.push(t);
            });
            addTagInput.value = '';
        }

        // Auto-extract hashtags from content text
        if (content) {
            const matches = content.match(/#([a-zA-Z0-9_\-]+)/g);
            if (matches) {
                matches.forEach(m => {
                    const tag = m.replace(/^#/, '').toLowerCase();
                    if (!currentAddTags.includes(tag)) currentAddTags.push(tag);
                });
            }
        }

        if (type === '[PHOTO]' && noteImage.files.length > 0) {
            imageData = await convertToBase64(noteImage.files[0]);
        }

        if (type === '[EVENT]') {
            eDate = eventDate.value;
            if (!eDate) {
                alert('Please select a date for the event.');
                return;
            }
        }

        if (!content && !imageData && type !== '[EVENT]' && type !== '[VOICE]') return;

        const newNote = {
            type,
            content,
            imageData,
            eventDate: eDate,
            tags: currentAddTags,
            timestamp: new Date().toISOString()
        };

        if (type === '[VOICE]') {
            const voiceData = window.getVoiceNoteData();
            if (voiceData.audioBlob) {
                newNote.audioBlob = voiceData.audioBlob;
                newNote.transcript = voiceData.transcript;
                // Voice notes might not have text content, so allow empty content
            } else {
                alert('Please record a voice note.');
                return;
            }
        } else if (!content && !imageData && type !== '[EVENT]') {
            return;
        }

        await db.addNote(newNote);
        addModal.classList.remove('active');
        await refreshAll();
    });

    // View Modal Logic
    function openViewModal(item) {
        currentViewId = item.id;
        currentNote = item;
        viewType.textContent = formatType(item.type);
        viewTime.textContent = new Date(item.timestamp).toLocaleString();

        if (item.type === '[VOICE]' && item.audioBlob) {
            viewContent.innerHTML = `
                <div class="audio-player-custom">
                    <button class="audio-play-btn" onclick="const audio = this.nextElementSibling; audio.paused ? audio.play() : audio.pause();">▶</button>
                    <audio src="${URL.createObjectURL(item.audioBlob)}" onended="this.previousElementSibling.textContent='▶'" onplay="this.previousElementSibling.textContent='⏸'" onpause="this.previousElementSibling.textContent='▶'"></audio>
                    <div class="audio-wave" style="width: 200px;"></div>
                </div>
                ${item.transcript ? `<div style="margin-top:15px; font-style:italic; color:#888;">"${item.transcript}"</div>` : ''}
             `;
        } else {
            viewContent.textContent = item.content;
        }

        // Tags
        currentViewTags = item.tags || [];
        renderTags(viewTagsList, currentViewTags, 'view');

        viewImageContainer.innerHTML = '';
        if (item.imageData) {
            const img = document.createElement('img');
            img.src = item.imageData;
            viewImageContainer.appendChild(img);
        }

        if (item.type === '[EVENT]' && item.eventDate) {
            viewEventDetails.textContent = `Event Date: ${new Date(item.eventDate).toLocaleString()}`;
        } else {
            viewEventDetails.textContent = '';
        }

        pinNoteBtn.textContent = item.isPinned ? 'UNPIN' : 'PIN';

        viewModal.classList.add('active');
    }

    closeViewModal.addEventListener('click', () => {
        viewModal.classList.remove('active');
        currentViewId = null;
        currentNote = null;
    });

    deleteNoteBtn.addEventListener('click', async () => {
        if (currentViewId) {
            if (confirm('Are you sure you want to delete this entry?')) {
                await db.deleteNote(currentViewId);
                viewModal.classList.remove('active');
                refreshAll();
            }
        }
    });

    pinNoteBtn.addEventListener('click', async () => {
        if (currentViewId) {
            const newStatus = await db.togglePin(currentViewId);
            pinNoteBtn.textContent = newStatus ? 'UNPIN' : 'PIN';
            if (currentNote) currentNote.isPinned = newStatus;
            refreshAll();
        }
    });

    // Utilities
    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target === addModal) addModal.classList.remove('active');
        if (e.target === viewModal) viewModal.classList.remove('active');
    });

    // --- Settings & Theme Logic ---
    const pillSettingsBtn = document.getElementById('pillSettingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    // Toggle Settings Menu
    pillSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== pillSettingsBtn) {
            settingsMenu.classList.remove('active');
        }
    });

    // Handle Toggles
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const setting = btn.dataset.setting;
            const value = btn.dataset.value;

            // Update UI
            const group = btn.parentElement;
            group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Apply Setting
            if (setting === 'theme') {
                applyTheme(value);
            } else if (setting === 'accent') {
                applyAccent(value);
            }
        });
    });

    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        localStorage.setItem('essential_theme', theme);
    }

    function applyAccent(accent) {
        const root = document.documentElement;
        if (accent === 'yellow') {
            root.style.setProperty('--accent-color', 'var(--accent-yellow)');
        } else {
            root.style.setProperty('--accent-color', 'var(--accent-red)');
        }
        localStorage.setItem('essential_accent', accent);
    }

    // Load Preferences
    function loadPreferences() {
        const savedTheme = localStorage.getItem('essential_theme') || 'dark';
        const savedAccent = localStorage.getItem('essential_accent') || 'red';

        // Apply saved values
        applyTheme(savedTheme);
        applyAccent(savedAccent);

        // Update UI state
        // Reset all first
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));

        // Set active
        const themeBtn = document.querySelector(`.toggle-btn[data-setting="theme"][data-value="${savedTheme}"]`);
        if (themeBtn) themeBtn.classList.add('active');

        const accentBtn = document.querySelector(`.toggle-btn[data-setting="accent"][data-value="${savedAccent}"]`);
        if (accentBtn) accentBtn.classList.add('active');
    }

    loadPreferences();

    // --- Pill Bar Navigation ---
    const pillOverviewBtn = document.getElementById('pillOverviewBtn');
    const pillCollectionsBtn = document.getElementById('pillCollectionsBtn');
    const pillSearchBtn = document.getElementById('pillSearchBtn');
    const overviewSection = document.getElementById('overviewSection');
    const collectionsSection = document.getElementById('collectionsSection');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    const closeSearchBtn = document.getElementById('closeSearchBtn');

    // --- Local LLM & Overview Generator ---
    let localSummarizer = null;

    async function loadLocalLLM(onProgress) {
        if (localSummarizer) return localSummarizer;
        env.allowLocalModels = false;
        localSummarizer = await pipeline('summarization', 'Xenova/t5-small', {
            progress_callback: (p) => {
                if (p.status === 'progress' && onProgress) {
                    onProgress(Math.round(p.progress));
                }
            }
        });
        localStorage.setItem('local_llm_installed', 'true');
        return localSummarizer;
    }

    async function runLocalAISummary() {
        const notes = await db.getAllNotes();
        const summaryCard = document.getElementById('desktopAiSummaryCard');
        const summaryBody = document.getElementById('desktopAiSummaryBody');
        const summaryTime = document.getElementById('desktopSummaryTime');
        if (!summaryCard || !summaryBody) return;

        summaryCard.style.display = 'block';
        if (summaryTime) summaryTime.textContent = new Date().toLocaleTimeString();
        summaryBody.innerHTML = `<div style="display:flex; align-items:center; gap:10px; color:var(--text-muted); font-style:italic;"><span>Local LLM model is generating high-level summary on-device...</span></div>`;

        const events = notes.filter(n => n.type === '[EVENT]');
        const tasks = notes.filter(n => n.type === '[TASK]');
        const captures = notes.filter(n => n.type !== '[EVENT]' && n.type !== '[TASK]');

        let textPrompt = notes.map(n => n.content || n.transcript || '').filter(t => t).join(' . ');
        if (!textPrompt) {
            textPrompt = "Workspace contains upcoming events and notes.";
        }
        if (textPrompt.length > 500) textPrompt = textPrompt.substring(0, 500);

        let generatedText = "";
        try {
            const summarizer = await loadLocalLLM();
            const res = await summarizer(textPrompt, { max_new_tokens: 60, min_new_tokens: 15 });
            if (res && res[0] && res[0].summary_text) {
                generatedText = res[0].summary_text;
            }
        } catch (err) {
            console.warn("Local AI summary fallback:", err);
        }

        if (!generatedText) {
            generatedText = `Your workspace has ${events.length} upcoming event(s) and ${tasks.length} pending task(s). Recent focus is on captured notes and voice recordings.`;
        }

        summaryBody.innerHTML = `
            <p style="margin:0; line-height:1.6; font-size:14px;"><strong>High-Level Overview:</strong> ${generatedText}</p>
        `;
    }

    async function refreshOverviewData() {
        const notes = await db.getAllNotes();
        const todayStr = new Date().toDateString();

        const events = notes.filter(n => n.type === '[EVENT]');
        const tasks = notes.filter(n => n.type === '[TASK]');
        const captures = notes.filter(n => n.type !== '[EVENT]' && n.type !== '[TASK]');

        const todayEvents = events.filter(e => e.eventDate && new Date(e.eventDate).toDateString() === todayStr);

        const heroEventCount = document.getElementById('heroEventCount');
        const heroTaskCount = document.getElementById('heroTaskCount');
        const desktopHeroSubtitle = document.getElementById('desktopHeroSubtitle');

        if (heroEventCount) heroEventCount.textContent = `${todayEvents.length || events.length} events`;
        if (heroTaskCount) heroTaskCount.textContent = `${tasks.length} tasks`;
        if (desktopHeroSubtitle) desktopHeroSubtitle.textContent = `Captured ${notes.length} total memories in workspace`;

        const desktopEventsList = document.getElementById('desktopEventsList');
        if (desktopEventsList) {
            desktopEventsList.innerHTML = '';
            if (events.length === 0) {
                desktopEventsList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No upcoming events</p>`;
            } else {
                events.slice(0, 4).forEach(e => {
                    const item = document.createElement('div');
                    item.className = 'list-card';
                    item.style.cursor = 'pointer';
                    item.onclick = () => openViewModal(e);
                    item.innerHTML = `
                        <strong>${e.content || 'Untitled Event'}</strong>
                        <span style="font-size:0.8rem; color:var(--text-muted); display:block; margin-top:4px;">${e.eventDate ? new Date(e.eventDate).toLocaleString() : 'No date set'}</span>
                    `;
                    desktopEventsList.appendChild(item);
                });
            }
        }

        const desktopTasksList = document.getElementById('desktopTasksList');
        if (desktopTasksList) {
            desktopTasksList.innerHTML = '';
            if (tasks.length === 0) {
                desktopTasksList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No pending tasks</p>`;
            } else {
                tasks.slice(0, 5).forEach(t => {
                    const item = document.createElement('div');
                    item.className = 'task-pill-row';
                    item.onclick = () => openViewModal(t);
                    item.innerHTML = `
                        <div class="task-check-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"></circle></svg>
                        </div>
                        <span class="task-text">${t.content || 'Untitled Task'}</span>
                    `;
                    desktopTasksList.appendChild(item);
                });
            }
        }

        const desktopCapturesList = document.getElementById('desktopCapturesList');
        if (desktopCapturesList) {
            desktopCapturesList.innerHTML = '';
            if (captures.length === 0) {
                desktopCapturesList.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No recent captures</p>`;
            } else {
                captures.slice(0, 3).forEach(c => {
                    const card = document.createElement('div');
                    card.onclick = () => openViewModal(c);
                    const typeText = (c.type || 'NOTE').replace(/^\[|\]$/g, '');
                    const timeStr = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    if (c.imageData) {
                        card.className = 'capture-card photo-capture';
                        card.style.backgroundImage = `url(${c.imageData})`;
                        card.innerHTML = `
                            <div class="card-overlay"></div>
                            <div class="capture-inner">
                                <span class="capture-type">${typeText}</span>
                                <span class="capture-title">${c.content || c.transcript || 'Photo Capture'}</span>
                                <span class="capture-time">${timeStr}</span>
                            </div>
                        `;
                    } else {
                        card.className = 'capture-card text-capture';
                        card.innerHTML = `
                            <div class="capture-inner">
                                <span class="capture-type">${typeText}</span>
                                <span class="capture-title">${c.content || c.transcript || 'Note Capture'}</span>
                                <span class="capture-time">${timeStr}</span>
                            </div>
                        `;
                    }
                    desktopCapturesList.appendChild(card);
                });
            }
        }
    }

    // Modal Install Event Listeners
    const modelInstallModal = document.getElementById('modelInstallModal');
    const startModelInstallBtn = document.getElementById('startModelInstallBtn');
    const cancelModelInstallBtn = document.getElementById('cancelModelInstallBtn');
    const closeModelInstallModal = document.getElementById('closeModelInstallModal');
    const desktopGenerateOverviewBtn = document.getElementById('desktopGenerateOverviewBtn');
    const downloadProgressContainer = document.getElementById('downloadProgressContainer');
    const downloadProgressBar = document.getElementById('downloadProgressBar');
    const downloadProgressText = document.getElementById('downloadProgressText');

    function openModelModal() { if (modelInstallModal) modelInstallModal.classList.add('active'); }
    function closeModelModal() { if (modelInstallModal) modelInstallModal.classList.remove('active'); }

    if (closeModelInstallModal) closeModelInstallModal.addEventListener('click', closeModelModal);
    if (cancelModelInstallBtn) cancelModelInstallBtn.addEventListener('click', closeModelModal);

    if (desktopGenerateOverviewBtn) {
        desktopGenerateOverviewBtn.addEventListener('click', () => {
            const isInstalled = localStorage.getItem('local_llm_installed') === 'true';
            if (!isInstalled && !localSummarizer) {
                openModelModal();
            } else {
                runLocalAISummary();
            }
        });
    }

    if (startModelInstallBtn) {
        startModelInstallBtn.addEventListener('click', async () => {
            startModelInstallBtn.disabled = true;
            if (downloadProgressContainer) downloadProgressContainer.style.display = 'block';
            try {
                await loadLocalLLM((percent) => {
                    if (downloadProgressBar) downloadProgressBar.style.width = `${percent}%`;
                    if (downloadProgressText) downloadProgressText.textContent = `Downloading local AI model weights... ${percent}%`;
                });
                closeModelModal();
                runLocalAISummary();
            } catch (err) {
                console.error("Model download failed:", err);
                if (downloadProgressText) downloadProgressText.textContent = `Download failed. Please check network.`;
                startModelInstallBtn.disabled = false;
            }
        });
    }

    if (pillOverviewBtn && pillCollectionsBtn) {
        pillOverviewBtn.addEventListener('click', () => {
            pillOverviewBtn.classList.add('active');
            pillCollectionsBtn.classList.remove('active');
            overviewSection.style.display = 'flex';
            collectionsSection.style.display = 'none';
            refreshOverviewData();
        });

        pillCollectionsBtn.addEventListener('click', () => {
            pillCollectionsBtn.classList.add('active');
            pillOverviewBtn.classList.remove('active');
            overviewSection.style.display = 'none';
            collectionsSection.style.display = 'block';
        });
    }

    const desktopSearchResults = document.getElementById('desktopSearchResults');

    function closeDesktopSearch() {
        if (searchOverlay) searchOverlay.classList.remove('active');
        if (searchInput) searchInput.value = '';
        if (desktopSearchResults) desktopSearchResults.innerHTML = '';
        currentFilter = null;
        updateFilterSidebar();
        loadNotes();
    }

    if (pillSearchBtn) {
        pillSearchBtn.addEventListener('click', async () => {
            if (searchOverlay) searchOverlay.classList.add('active');
            if (searchInput) {
                searchInput.value = '';
                setTimeout(() => searchInput.focus(), 100);
            }
            const allNotes = await db.getAllNotes();
            renderSearchResults(allNotes);
        });
    }

    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', closeDesktopSearch);
    }

    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                closeDesktopSearch();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchOverlay && searchOverlay.classList.contains('active')) {
            closeDesktopSearch();
        }
    });

    function renderSearchResults(items) {
        if (!desktopSearchResults) return;
        desktopSearchResults.innerHTML = '';
        if (!items || items.length === 0) {
            desktopSearchResults.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:30px; font-family:var(--font-body); grid-column: 1 / -1;">No matching memories found</div>`;
            return;
        }
        items.forEach((item, index) => {
            const itemEl = document.createElement('div');
            const seed = (typeof item.id === 'number' ? item.id * 31 : index * 47) + (item.timestamp ? String(item.timestamp).length : 0);
            const isSquare = ((seed * 19 + 7) % 5) < 2;
            const shapeClass = isSquare ? 'shape-square' : 'shape-rect';

            itemEl.onclick = () => {
                openViewModal(item);
            };

            const timeString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const typeBadge = formatType(item.type) || 'NOTE';

            let tagsHtml = '';
            if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
                tagsHtml = `<div class="item-tags">${item.tags.map(t => `<span class="item-tag">#${t.replace(/^#/, '')}</span>`).join('')}</div>`;
            }

            if (item.imageData) {
                itemEl.className = `memory-item photo-card ${shapeClass}`;
                itemEl.style.backgroundImage = `url(${item.imageData})`;
                itemEl.innerHTML = `
                    <div class="card-overlay"></div>
                    <div class="card-content-wrap">
                        <div class="item-header-row">
                            <span class="item-type">${typeBadge}</span>
                            ${tagsHtml}
                        </div>
                        <span class="item-content">${item.content || item.transcript || ''}</span>
                        <span class="item-time">${timeString}</span>
                    </div>
                `;
            } else {
                itemEl.className = `memory-item ${shapeClass}`;
                let bodyText = item.content || item.transcript || '';
                if (item.type === '[TASK]' && bodyText) bodyText = `◯ ${bodyText}`;

                itemEl.innerHTML = `
                    <div class="item-header-row">
                        <span class="item-type">${typeBadge}</span>
                        ${tagsHtml}
                    </div>
                    <div class="item-body-content">
                        <span class="item-content">${bodyText}</span>
                    </div>
                    <span class="item-time">${timeString}</span>
                `;
            }
            desktopSearchResults.appendChild(itemEl);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase().trim();
            const notes = await db.getAllNotes();
            if (!query) {
                renderSearchResults(notes);
                renderItems(notes);
                return;
            }
            const filtered = notes.filter(note => {
                const contentMatch = note.content && note.content.toLowerCase().includes(query);
                const typeMatch = note.type && note.type.toLowerCase().includes(query);
                const transcriptMatch = note.transcript && note.transcript.toLowerCase().includes(query);
                const tagMatch = note.tags && Array.isArray(note.tags) && note.tags.some(t => t.toLowerCase().includes(query));
                return contentMatch || typeMatch || transcriptMatch || tagMatch;
            });

            renderSearchResults(filtered);
            renderItems(filtered);
        });
    }

    // --- Voice Recorder Logic ---
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob = null;
    let recognition;
    let transcript = "";
    let isRecording = false;
    let recordingStartTime;
    let timerInterval;

    const voiceRecorder = document.getElementById('voiceRecorder');
    const recorderStatus = document.querySelector('.recorder-status');
    const recorderTimer = document.querySelector('.recorder-timer');
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const playPreviewBtn = document.getElementById('playPreviewBtn');
    const deleteRecordingBtn = document.getElementById('deleteRecordingBtn');
    const transcriptionPreview = document.getElementById('transcriptionPreview');

    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    transcript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            transcriptionPreview.textContent = transcript + interimTranscript;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
        };
    } else {
        transcriptionPreview.textContent = "Transcription not supported in this browser.";
    }

    recordBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            transcript = "";
            transcriptionPreview.textContent = "";

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                playPreviewBtn.disabled = false;
                deleteRecordingBtn.disabled = false;
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            if (recognition) recognition.start();

            isRecording = true;
            recorderStatus.textContent = "REC";
            recorderStatus.classList.add('recording');
            recordBtn.disabled = true;
            stopBtn.disabled = false;
            playPreviewBtn.disabled = true;
            deleteRecordingBtn.disabled = true;

            recordingStartTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Microphone permission is required to record voice notes.");
        }
    });

    stopBtn.addEventListener('click', () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            if (recognition) recognition.stop();
            isRecording = false;
            recorderStatus.textContent = "IDLE";
            recorderStatus.classList.remove('recording');
            recordBtn.disabled = false;
            stopBtn.disabled = true;
            clearInterval(timerInterval);
        }
    });

    playPreviewBtn.addEventListener('click', () => {
        if (audioBlob) {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
        }
    });

    deleteRecordingBtn.addEventListener('click', () => {
        audioBlob = null;
        transcript = "";
        transcriptionPreview.textContent = "";
        recorderTimer.textContent = "00:00";
        playPreviewBtn.disabled = true;
        deleteRecordingBtn.disabled = true;
    });

    function updateTimer() {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        recorderTimer.textContent = `${minutes}:${seconds}`;
    }

    // Expose for use in saveNote
    window.getVoiceNoteData = () => {
        return { audioBlob, transcript };
    };

    window.resetVoiceRecorder = () => {
        if (isRecording) stopBtn.click();
        deleteRecordingBtn.click();
    };

    const switchToMobileBtn = document.getElementById('switchToMobileBtn');
    if (switchToMobileBtn) {
        switchToMobileBtn.addEventListener('click', () => {
            localStorage.setItem('preferred_ui', 'mobile');
            window.location.href = '../mobile/index.html';
        });
    }
});
