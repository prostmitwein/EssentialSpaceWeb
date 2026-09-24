import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

env.allowLocalModels = false;

document.addEventListener('DOMContentLoaded', async () => {
  let currentFilter = null;
  let currentNoteType = '[NOTE]';
  let recordedAudioBlob = null;
  let mediaRecorder = null;
  let audioChunks = [];

  // Elements
  const clockEl = document.getElementById('clock');
  const overviewHeroText = document.getElementById('overview-hero-text');
  const heroEventCount = document.getElementById('heroEventCount');
  const heroTaskCount = document.getElementById('heroTaskCount');
  const mobileHeroSubtitle = document.getElementById('mobileHeroSubtitle');
  const mobileGenerateOverviewBtn = document.getElementById('mobileGenerateOverviewBtn');
  
  const tabOverview = document.getElementById('tab-overview');
  const tabCollections = document.getElementById('tab-collections');
  
  const mobilePillOverviewBtn = document.getElementById('mobilePillOverviewBtn');
  const mobilePillCollectionsBtn = document.getElementById('mobilePillCollectionsBtn');
  const mobilePillSettingsBtn = document.getElementById('mobilePillSettingsBtn');
  const mobilePillAddBtn = document.getElementById('mobilePillAddBtn');
  const mobilePillSearchBtn = document.getElementById('mobilePillSearchBtn');
  const mobileSettingsMenu = document.getElementById('mobileSettingsMenu');
  
  const collectionsGrid = document.getElementById('collections-grid');
  const collectionsCount = document.getElementById('collectionsCount');
  const mobileTagFilters = document.getElementById('mobileTagFilters');

  const addModal = document.getElementById('add-modal');
  const viewModal = document.getElementById('view-modal');
  const searchOverlay = document.getElementById('search-overlay');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const closeSearchBtn = document.getElementById('closeSearchBtn');
  const saveNoteBtn = document.getElementById('saveNoteBtn');
  
  const addContent = document.getElementById('addContent');
  const addTags = document.getElementById('addTags');
  const addEventDate = document.getElementById('addEventDate');
  const addPhotoInput = document.getElementById('addPhotoInput');
  const recordBtn = document.getElementById('recordBtn');
  const recordingStatus = document.getElementById('recordingStatus');

  // Clock
  function updateClock() {
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Initialize DB
  try {
    await db.init();
    await refreshAll();
  } catch (err) {
    console.error("Mobile DB init error:", err);
  }

  async function refreshAll() {
    await loadCollections();
    await updateOverviewData();
    await updateTagFilters();
  }

  // --- Tab Switching ---
  if (mobilePillOverviewBtn && mobilePillCollectionsBtn) {
    mobilePillOverviewBtn.addEventListener('click', () => {
      mobilePillOverviewBtn.classList.add('active');
      mobilePillCollectionsBtn.classList.remove('active');
      tabOverview.classList.add('active');
      tabCollections.classList.remove('active');
      if (mobileSettingsMenu) mobileSettingsMenu.classList.remove('active');
    });

    mobilePillCollectionsBtn.addEventListener('click', () => {
      mobilePillCollectionsBtn.classList.add('active');
      mobilePillOverviewBtn.classList.remove('active');
      tabCollections.classList.add('active');
      tabOverview.classList.remove('active');
      if (mobileSettingsMenu) mobileSettingsMenu.classList.remove('active');
    });
  }

  // Settings Menu Toggle
  if (mobilePillSettingsBtn && mobileSettingsMenu) {
    mobilePillSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileSettingsMenu.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
      if (!mobileSettingsMenu.contains(e.target) && e.target !== mobilePillSettingsBtn) {
        mobileSettingsMenu.classList.remove('active');
      }
    });
  }

  // Desktop Switch
  const mobileSwitchToDesktopBtn = document.getElementById('mobileSwitchToDesktopBtn');
  if (mobileSwitchToDesktopBtn) {
    mobileSwitchToDesktopBtn.addEventListener('click', () => {
      localStorage.setItem('preferred_ui', 'desktop');
      window.location.replace('../desktop/index.html');
    });
  }

  // Settings Toggles (Theme & Accent)
  document.querySelectorAll('.toggle-btn[data-setting]').forEach(btn => {
    btn.addEventListener('click', () => {
      const setting = btn.getAttribute('data-setting');
      const value = btn.getAttribute('data-value');
      const group = btn.parentElement;

      group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

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
      root.style.setProperty('--accent-color', '#FFC700');
      root.setAttribute('data-accent', 'yellow');
    } else {
      root.style.setProperty('--accent-color', '#FF2E2E');
      root.setAttribute('data-accent', 'red');
    }
    localStorage.setItem('essential_accent', accent);
  }

  function loadPreferences() {
    const savedTheme = localStorage.getItem('essential_theme') || 'dark';
    const savedAccent = localStorage.getItem('essential_accent') || 'red';

    applyTheme(savedTheme);
    applyAccent(savedAccent);

    const themeBtn = document.querySelector(`.toggle-btn[data-setting="theme"][data-value="${savedTheme}"]`);
    if (themeBtn) {
      themeBtn.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      themeBtn.classList.add('active');
    }

    const accentBtn = document.querySelector(`.toggle-btn[data-setting="accent"][data-value="${savedAccent}"]`);
    if (accentBtn) {
      accentBtn.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      accentBtn.classList.add('active');
    }
  }

  loadPreferences();

  // --- Overview Dashboard ---
  async function updateOverviewData() {
    const notes = await db.getAllNotes();
    const todayStr = new Date().toDateString();

    const events = notes.filter(n => n.type === '[EVENT]');
    const tasks = notes.filter(n => n.type === '[TASK]');
    const captures = notes.filter(n => n.type !== '[EVENT]' && n.type !== '[TASK]');

    const todayEvents = events.filter(e => e.eventDate && new Date(e.eventDate).toDateString() === todayStr);

    if (heroEventCount) heroEventCount.textContent = `${todayEvents.length} events`;
    if (heroTaskCount) heroTaskCount.textContent = `${tasks.length} tasks`;
    if (mobileHeroSubtitle) mobileHeroSubtitle.textContent = `Captured ${notes.length} memories overall`;

    // Render Events List
    const eventsList = document.getElementById('overview-events-list');
    if (eventsList) {
      if (events.length === 0) {
        eventsList.innerHTML = `<div class="empty-state-text">No upcoming events</div>`;
      } else {
        eventsList.innerHTML = events.slice(0, 4).map(e => `
          <div class="overview-event-item">
            <span class="event-title">${escapeHtml(e.content || 'Event')}</span>
            <span class="event-time">${e.eventDate ? new Date(e.eventDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '--'}</span>
          </div>
        `).join('');
      }
    }

    // Render Tasks List
    const tasksList = document.getElementById('overview-tasks-list');
    if (tasksList) {
      if (tasks.length === 0) {
        tasksList.innerHTML = `<div class="empty-state-text">No pending tasks</div>`;
      } else {
        tasksList.innerHTML = tasks.slice(0, 4).map(t => `
          <div class="overview-task-item ${t.isCompleted ? 'completed' : ''}">
            <input type="checkbox" ${t.isCompleted ? 'checked' : ''} data-id="${t.id}" class="task-checkbox">
            <span>${escapeHtml(t.content || 'Task')}</span>
          </div>
        `).join('');

        tasksList.querySelectorAll('.task-checkbox').forEach(cb => {
          cb.addEventListener('change', async (e) => {
            const id = Number(e.target.dataset.id);
            const targetNote = notes.find(n => n.id === id);
            if (targetNote) {
              targetNote.isCompleted = e.target.checked;
              await db.updateNote(targetNote);
              await refreshAll();
            }
          });
        });
      }
    }

    // Render Recent Captures Grid
    const capturesList = document.getElementById('overview-captures-list');
    if (capturesList) {
      const recentCaptures = captures.slice(0, 4);
      if (recentCaptures.length === 0) {
        capturesList.innerHTML = `<div class="empty-state-text" style="grid-column: span 2;">No recent captures</div>`;
      } else {
        capturesList.innerHTML = recentCaptures.map(c => renderCardHtml(c)).join('');
        attachCardClickHandlers(capturesList);
      }
    }
  }

  // --- Local AI Summary Generator ---
  let localSummarizer = null;
  async function runMobileLocalAISummary() {
    const notes = await db.getAllNotes();
    const summaryCard = document.getElementById('mobileAiSummaryCard');
    const summaryBody = document.getElementById('mobileAiSummaryBody');
    const summaryTime = document.getElementById('mobileSummaryTime');
    if (!summaryCard || !summaryBody) return;

    summaryCard.style.display = 'block';
    if (summaryTime) summaryTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    summaryBody.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">Local LLM model generating summary...</div>`;

    const events = notes.filter(n => n.type === '[EVENT]');
    const tasks = notes.filter(n => n.type === '[TASK]');

    let textPrompt = notes.map(n => n.content || n.transcript || '').filter(t => t).join(' . ');
    if (!textPrompt) textPrompt = "Workspace contains notes and events.";
    if (textPrompt.length > 400) textPrompt = textPrompt.substring(0, 400);

    let generatedText = "";
    try {
      if (!localSummarizer) {
        env.allowLocalModels = false;
        localSummarizer = await pipeline('summarization', 'Xenova/t5-small');
      }
      const res = await localSummarizer(textPrompt, { max_new_tokens: 50, min_new_tokens: 15 });
      if (res && res[0] && res[0].summary_text) {
        generatedText = res[0].summary_text;
      }
    } catch (err) {
      console.warn("Mobile local AI summary fallback:", err);
    }

    if (!generatedText) {
      generatedText = `Your workspace has ${events.length} event(s) and ${tasks.length} task(s). Recent focus is on captured notes and voice entries.`;
    }

    summaryBody.innerHTML = `
      <p style="margin:0; line-height:1.5; font-size:13px;"><strong>High-Level Overview:</strong> ${generatedText}</p>
    `;
  }

  if (mobileGenerateOverviewBtn) {
    mobileGenerateOverviewBtn.addEventListener('click', runMobileLocalAISummary);
  }

  // --- Collections View & Tag Filters ---
  async function loadCollections() {
    const notes = await db.getAllNotes(currentFilter);
    if (collectionsCount) collectionsCount.textContent = `( ${notes.length} )`;
    if (collectionsGrid) {
      if (notes.length === 0) {
        collectionsGrid.innerHTML = `<div class="empty-state-text" style="grid-column: span 2; padding: 20px 0;">No memories found</div>`;
      } else {
        collectionsGrid.innerHTML = notes.map(n => renderCardHtml(n)).join('');
        attachCardClickHandlers(collectionsGrid);
      }
    }
  }

  async function updateTagFilters() {
    const allNotes = await db.getAllNotes();
    const tagCounts = {};
    allNotes.forEach(n => {
      const seen = new Set();
      if (n.tags && Array.isArray(n.tags)) {
        n.tags.forEach(t => {
          const clean = String(t).trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/^#/, '');
          if (clean && !seen.has(clean)) {
            seen.add(clean);
            tagCounts[clean] = (tagCounts[clean] || 0) + 1;
          }
        });
      }
      const text = ((n.content || '') + ' ' + (n.transcript || '')).toLowerCase();
      const matches = text.match(/#([a-zA-Z0-9_\-]+)/g);
      if (matches) {
        matches.forEach(m => {
          const clean = m.replace(/^#/, '').trim();
          if (clean && !seen.has(clean)) {
            seen.add(clean);
            tagCounts[clean] = (tagCounts[clean] || 0) + 1;
          }
        });
      }
    });

    if (!mobileTagFilters) return;
    const activeTag = currentFilter ? currentFilter.toLowerCase().replace(/^#/, '') : null;
    mobileTagFilters.innerHTML = `<button class="tag-chip ${activeTag === null ? 'active' : ''}" data-tag="all">ALL (${allNotes.length})</button>`;

    Object.keys(tagCounts).sort().forEach(tag => {
      const btn = document.createElement('button');
      btn.className = `tag-chip ${activeTag === tag ? 'active' : ''}`;
      btn.textContent = `#${tag.toUpperCase()} (${tagCounts[tag]})`;
      btn.dataset.tag = tag;
      btn.onclick = () => {
        currentFilter = tag;
        if (mobilePillCollectionsBtn) mobilePillCollectionsBtn.click();
        refreshAll();
      };
      mobileTagFilters.appendChild(btn);
    });

    const allBtn = mobileTagFilters.querySelector('[data-tag="all"]');
    if (allBtn) {
      allBtn.onclick = () => {
        currentFilter = null;
        refreshAll();
      };
    }
  }

  // Render Card HTML
  function renderCardHtml(n) {
    const timeStr = new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const typeLabel = (n.type || '[NOTE]').replace(/^\[|\]$/g, '');

    if (n.type === '[PHOTO]' && n.imageData) {
      return `
        <div class="memory-item photo-card" data-id="${n.id}" style="background-image: url('${n.imageData}');">
          <div class="card-overlay"></div>
          <div class="card-content-wrap">
            <div class="item-header-row">
              <span class="item-type">${typeLabel}</span>
              ${n.isPinned ? '<span>📌</span>' : ''}
            </div>
            <div class="item-content">${escapeHtml(n.content || 'Photo Attachment')}</div>
            <div class="item-time">${timeStr}</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="memory-item" data-id="${n.id}">
        <div class="item-header-row">
          <span class="item-type">${typeLabel}</span>
          ${n.isPinned ? '<span>📌</span>' : ''}
        </div>
        <div class="item-content">${escapeHtml(n.content || n.transcript || 'Note Entry')}</div>
        <div class="item-time">${timeStr}</div>
      </div>
    `;
  }

  function attachCardClickHandlers(container) {
    container.querySelectorAll('.memory-item').forEach(card => {
      card.addEventListener('click', async () => {
        const id = Number(card.dataset.id);
        const notes = await db.getAllNotes();
        const note = notes.find(n => n.id === id);
        if (note) openViewModal(note);
      });
    });
  }

  // --- Add Modal & Type Switching ---
  let isRecording = false;
  let recognition = null;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      if (addContent) addContent.value = transcript;
    };
  }

  if (recordBtn) {
    recordBtn.addEventListener('click', async () => {
      if (!isRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
          };

          mediaRecorder.onstop = () => {
            recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          if (recognition) {
            try { recognition.start(); } catch (e) {}
          }

          isRecording = true;
          recordBtn.textContent = '⏹ Stop Recording';
          recordBtn.style.backgroundColor = 'var(--accent-color)';
          recordBtn.style.color = '#000000';
          if (recordingStatus) {
            recordingStatus.innerHTML = `<span style="color:var(--accent-color); font-weight:700; font-size:11px; font-family:'Ntype Mono',monospace;">🔴 RECORDING AUDIO...</span>`;
          }
        } catch (err) {
          console.error("Microphone permission error:", err);
          alert("Microphone access is required to record voice notes.");
        }
      } else {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        if (recognition) {
          try { recognition.stop(); } catch (e) {}
        }
        isRecording = false;
        recordBtn.textContent = 'Start Recording';
        recordBtn.style.backgroundColor = '';
        recordBtn.style.color = '';
        if (recordingStatus) {
          recordingStatus.innerHTML = `<span style="color:#4CAF50; font-weight:700; font-size:11px; font-family:'Ntype Mono',monospace;">✓ Audio recorded & ready</span>`;
        }
      }
    });
  }

  if (mobilePillAddBtn) {
    mobilePillAddBtn.addEventListener('click', () => {
      addModal.classList.add('active');
      addContent.value = '';
      addTags.value = '';
      if (addEventDate) addEventDate.value = '';
      if (addPhotoInput) addPhotoInput.value = '';
      if (recordingStatus) recordingStatus.innerHTML = '';
      if (recordBtn) {
        recordBtn.textContent = 'Start Recording';
        recordBtn.style.backgroundColor = '';
        recordBtn.style.color = '';
      }
      recordedAudioBlob = null;
      isRecording = false;
      currentNoteType = '[NOTE]';

      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      const defaultNoteBtn = document.querySelector('.type-btn[data-type="[NOTE]"]');
      if (defaultNoteBtn) defaultNoteBtn.classList.add('active');

      updateTypeUI();
    });
  }

  document.querySelectorAll('.close-sheet').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sheet = e.target.closest('.bottom-sheet');
      if (sheet) sheet.classList.remove('active');
    });
  });

  // Close sheet when tapping backdrop (outside container)
  document.querySelectorAll('.bottom-sheet').forEach(sheet => {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        sheet.classList.remove('active');
      }
    });
  });

  // Type Selector buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentNoteType = e.target.getAttribute('data-type');
      updateTypeUI();
    });
  });

  function updateTypeUI() {
    const eventGroup = document.getElementById('eventFieldGroup');
    const photoGroup = document.getElementById('photoFieldGroup');
    const voiceGroup = document.getElementById('voice-controls');

    if (eventGroup) eventGroup.classList.add('hidden');
    if (photoGroup) photoGroup.classList.add('hidden');
    if (voiceGroup) voiceGroup.classList.add('hidden');

    if (currentNoteType === '[EVENT]' && eventGroup) eventGroup.classList.remove('hidden');
    if (currentNoteType === '[PHOTO]' && photoGroup) photoGroup.classList.remove('hidden');
    if (currentNoteType === '[VOICE]' && voiceGroup) voiceGroup.classList.remove('hidden');
  }

  // Save Note
  if (saveNoteBtn) {
    saveNoteBtn.addEventListener('click', async () => {
      const content = addContent.value;
      const tagsStr = addTags.value;
      let tags = tagsStr.split(/[,#\s]+/).map(t => t.trim().toLowerCase().replace(/^\[|\]$/g, '')).filter(t => t);

      // Auto extract hashtags from content text
      if (content) {
        const matches = content.match(/#([a-zA-Z0-9_\-]+)/g);
        if (matches) {
          matches.forEach(m => {
            const clean = m.replace(/^#/, '').toLowerCase();
            if (!tags.includes(clean)) tags.push(clean);
          });
        }
      }

      let noteData = {
        type: currentNoteType,
        content,
        tags,
        timestamp: new Date().toISOString(),
        isPinned: false
      };

      if (currentNoteType === '[EVENT]' && addEventDate) {
        noteData.eventDate = addEventDate.value;
      }
      if (currentNoteType === '[PHOTO]' && addPhotoInput && addPhotoInput.files.length > 0) {
        noteData.imageData = await fileToBase64(addPhotoInput.files[0]);
      }
      if (currentNoteType === '[VOICE]' && recordedAudioBlob) {
        noteData.audioBlob = recordedAudioBlob;
        noteData.transcript = content;
      }

      await db.addNote(noteData);
      addModal.classList.remove('active');
      await refreshAll();
    });
  }

  // --- View Modal ---
  function openViewModal(note) {
    const viewType = document.getElementById('view-type');
    const viewContentArea = document.getElementById('view-content-area');
    const viewPinBtn = document.getElementById('viewPinBtn');
    const viewDeleteBtn = document.getElementById('viewDeleteBtn');

    const cleanType = (note.type || '[NOTE]').replace(/^\[|\]$/g, '');
    if (viewType) viewType.textContent = cleanType;

    if (viewPinBtn) {
      viewPinBtn.innerHTML = note.isPinned ? '📌 <span style="font-size:10px; font-weight:700;">PINNED</span>' : '📌';
      viewPinBtn.title = note.isPinned ? 'Unpin Note' : 'Pin Note';
      viewPinBtn.style.opacity = note.isPinned ? '1' : '0.6';
    }

    if (viewContentArea) {
      let imageHtml = note.imageData ? `<div style="margin-top:14px;"><img src="${note.imageData}" class="view-image" style="width:100%; border-radius:16px; border:1px solid var(--border-color); object-fit:cover; max-height:300px;"></div>` : '';
      let audioHtml = '';
      if (note.audioBlob) {
        const audioUrl = URL.createObjectURL(note.audioBlob);
        audioHtml = `<div style="margin-top:14px; background:var(--input-bg); padding:12px; border-radius:16px; border:1px solid var(--border-color);"><audio controls src="${audioUrl}" style="width:100%; height:40px;"></audio></div>`;
      }
      let eventHtml = note.eventDate ? `<div style="margin-top:12px; color:var(--accent-color); font-family:'Ntype',sans-serif; font-size:11px; letter-spacing:1px;">📅 EVENT DATE: ${new Date(note.eventDate).toLocaleString()}</div>` : '';
      let tagsHtml = note.tags && note.tags.length > 0 ? `<div class="view-tags" style="margin-top:14px; display:flex; gap:6px; flex-wrap:wrap;">${note.tags.map(t => `<span class="tag-pill" style="background:var(--input-bg); border:1px solid var(--border-color); color:var(--text-color); padding:4px 10px; border-radius:9999px; font-size:11px; font-family:'Geist Mono',monospace;">#${t.replace(/^#/, '')}</span>`).join('')}</div>` : '';

      const timeFormatted = new Date(note.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

      viewContentArea.innerHTML = `
        <div class="view-meta" style="font-size:11px; font-family:'Ntype Mono',monospace; color:var(--text-muted); margin-bottom:10px;">TIMESTAMP: ${timeFormatted}</div>
        <div style="font-size:1rem; line-height:1.6; word-break:break-word; white-space:pre-wrap;">${escapeHtml(note.content || note.transcript || 'No text content')}</div>
        ${eventHtml}
        ${imageHtml}
        ${audioHtml}
        ${tagsHtml}
      `;
    }

    if (viewPinBtn) {
      viewPinBtn.onclick = async () => {
        note.isPinned = !note.isPinned;
        await db.updateNote(note);
        viewModal.classList.remove('active');
        await refreshAll();
      };
    }

    if (viewDeleteBtn) {
      viewDeleteBtn.onclick = async () => {
        if (confirm('Delete this memory?')) {
          await db.deleteNote(note.id);
          viewModal.classList.remove('active');
          await refreshAll();
        }
      };
    }

    viewModal.classList.add('active');
  }

  // --- Search Overlay ---
  if (mobilePillSearchBtn) {
    mobilePillSearchBtn.addEventListener('click', async () => {
      searchOverlay.classList.add('active');
      if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 100);
      }
      const allNotes = await db.getAllNotes();
      renderSearchResults(allNotes);
    });
  }

  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      searchOverlay.classList.remove('active');
      if (searchInput) searchInput.value = '';
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', async () => {
      const q = searchInput.value.toLowerCase().trim();
      const allNotes = await db.getAllNotes();
      if (!q) {
        renderSearchResults(allNotes);
        return;
      }
      const filtered = allNotes.filter(n => {
        const text = ((n.content || '') + ' ' + (n.transcript || '')).toLowerCase();
        const tags = n.tags ? n.tags.join(' ').toLowerCase() : '';
        return text.includes(q) || tags.includes(q);
      });
      renderSearchResults(filtered);
    });
  }

  function renderSearchResults(notes) {
    if (!searchResults) return;
    if (notes.length === 0) {
      searchResults.innerHTML = `<div class="empty-state-text" style="grid-column: span 2;">No search results found</div>`;
    } else {
      searchResults.innerHTML = notes.map(n => renderCardHtml(n)).join('');
      attachCardClickHandlers(searchResults);
    }
  }

  // Helper: File to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // Helper: Escape HTML
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
