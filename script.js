import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

// Skip local model check for browser usage
env.allowLocalModels = false;

document.addEventListener('DOMContentLoaded', async () => {
    const memoryList = document.getElementById('memoryList');
    const addBtn = document.getElementById('addBtn');

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
    }

    // Load Notes
    async function loadNotes() {
        const notes = await db.getAllNotes(currentFilter);
        renderItems(notes);
    }

    // Update Widgets
    async function updateWidgets() {
        // Recent Widget
        const recent = await db.getRecentMedia();
        if (recent) {
            recentPreview.style.backgroundImage = `url(${recent.imageData})`;
            recentText.textContent = recent.content || 'Image Capture';
            recentTime.textContent = new Date(recent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            recentPreview.style.backgroundImage = 'none';
            recentText.textContent = 'No recent media';
            recentTime.textContent = '--:--';
        }

        // Upcoming Widget
        const upcoming = await db.getUpcomingEvents();
        if (upcoming && upcoming.length > 0) {
            const nextEvent = upcoming[0];
            upcomingTitle.textContent = nextEvent.content;
            upcomingDesc.textContent = new Date(nextEvent.eventDate).toLocaleDateString();
            upcomingTime.textContent = new Date(nextEvent.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            upcomingTitle.textContent = 'No upcoming events';
            upcomingDesc.textContent = '';
            upcomingTime.textContent = '--:--';
        }
    }

    // Update Filter Sidebar
    async function updateFilterSidebar() {
        const tags = await db.getUniqueTags();
        tagFilterList.innerHTML = `<li class="${currentFilter === null ? 'active' : ''}" data-tag="all">ALL</li>`;

        tags.forEach(tag => {
            const li = document.createElement('li');
            li.textContent = tag;
            li.dataset.tag = tag;
            if (currentFilter === tag) li.classList.add('active');

            li.onclick = () => {
                currentFilter = tag;
                refreshAll();
                closeMobileMenu();
            };
            tagFilterList.appendChild(li);
        });

        tagFilterList.querySelector('[data-tag="all"]').onclick = () => {
            currentFilter = null;
            refreshAll();
            closeMobileMenu();
        };
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

    // Render Items (Grid)
    function renderItems(items) {
        memoryList.innerHTML = '';
        items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = `memory-item ${item.isPinned ? 'pinned' : ''}`;
            itemEl.onclick = () => openViewModal(item);

            // Format time relative
            const timeString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let previewHtml = '';
            if (item.imageData) {
                previewHtml = `<img src="${item.imageData}" class="item-image-preview">`;
            }

            let pinHtml = item.isPinned ? '<div class="pinned-badge">PINNED</div>' : '';

            itemEl.innerHTML = `
                ${pinHtml}
                ${previewHtml}
                <div class="item-left">
                    <span class="item-type">${item.type}</span>
                    ${item.type === '[VOICE]' && item.audioBlob ? `
                        <div class="audio-player-custom">
                            <button class="audio-play-btn" onclick="event.stopPropagation(); const audio = this.nextElementSibling; audio.paused ? audio.play() : audio.pause();">▶</button>
                            <audio src="${URL.createObjectURL(item.audioBlob)}" onended="this.previousElementSibling.textContent='▶'" onplay="this.previousElementSibling.textContent='⏸'" onpause="this.previousElementSibling.textContent='▶'"></audio>
                            <div class="audio-wave"></div>
                        </div>
                        ${item.transcript ? `<button class="transcribe-btn" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('visible')">Transcribe</button><div class="transcript-text">${item.transcript}</div>` : ''}
                    ` : `<span class="item-content">${item.content || (item.imageData ? 'Image Attachment' : 'Empty')}</span>`}
                </div>
                <span class="item-time">${timeString}</span>
            `;

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
    addBtn.addEventListener('click', () => {
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

        if (noteType.value === '[PHOTO]') {
            imageUploadGroup.style.display = 'block';
        } else if (noteType.value === '[EVENT]') {
            eventFields.style.display = 'block';
        } else if (noteType.value === '[VOICE]') {
            document.getElementById('voiceRecorder').style.display = 'block';
        }
    });

    saveNoteBtn.addEventListener('click', async () => {
        const type = noteType.value;
        const content = noteContent.value;
        let imageData = null;
        let eDate = null;

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
        refreshAll();
    });

    // View Modal Logic
    function openViewModal(item) {
        currentViewId = item.id;
        currentNote = item;
        viewType.textContent = item.type;
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
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    // Toggle Settings Menu
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
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
});
