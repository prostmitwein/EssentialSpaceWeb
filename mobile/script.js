import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

env.allowLocalModels = false;

let db;
let transcriber = null;
let activeTab = 'tab-overview';
let currentNoteType = '[NOTE]';

// DOM Elements
const clockEl = document.getElementById('clock');
const navBtns = document.querySelectorAll('.nav-item[data-target]');
const searchBtn = document.getElementById('nav-search-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const searchOverlay = document.getElementById('search-overlay');
const closeSearchBtn = document.getElementById('closeSearchBtn');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

const fabAdd = document.getElementById('fab-add');
const addModal = document.getElementById('add-modal');
const closeAddBtns = addModal.querySelectorAll('.close-sheet');
const viewModal = document.getElementById('view-modal');
const closeViewBtns = viewModal.querySelectorAll('.close-sheet');
const settingsModal = document.getElementById('settings-modal');

// Init
async function init() {
  db = window.db;
  if (!db) {
    db = new StorageService();
    window.db = db;
  }
  await db.init();

  updateClock();
  setInterval(updateClock, 60000);
  
  setupListeners();
  loadData();
  
  // Preload transcriber
  try {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  } catch (e) {
    console.error('Failed to load transcriber', e);
  }
}

function updateClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setupListeners() {
  // Navigation
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      tabPanes.forEach(pane => {
        if(pane.id === targetId) pane.classList.add('active');
        else pane.classList.remove('active');
      });
      activeTab = targetId;
    });
  });

  // Search
  searchBtn.addEventListener('click', () => {
    searchOverlay.classList.add('active');
    searchInput.focus();
    renderSearch();
  });
  closeSearchBtn.addEventListener('click', () => {
    searchOverlay.classList.remove('active');
    searchInput.value = '';
  });
  searchInput.addEventListener('input', renderSearch);

  // Modals
  fabAdd.addEventListener('click', () => {
    addModal.classList.add('active');
    document.getElementById('addContent').value = '';
    document.getElementById('addTags').value = '';
    document.getElementById('addEventDate').value = '';
    document.getElementById('addPhotoInput').value = '';
    currentNoteType = '[NOTE]';
    updateTypeUI();
  });

  document.querySelectorAll('.close-sheet').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.bottom-sheet').classList.remove('active');
    });
  });

  // Type Selector
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentNoteType = e.target.getAttribute('data-type');
      updateTypeUI();
    });
  });

  // Save Note
  document.getElementById('saveNoteBtn').addEventListener('click', async () => {
    const content = document.getElementById('addContent').value;
    const tagsStr = document.getElementById('addTags').value;
    const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
    
    let noteData = {
      type: currentNoteType,
      content,
      tags,
      timestamp: Date.now(),
      isPinned: false
    };

    if (currentNoteType === '[EVENT]') {
      noteData.eventDate = document.getElementById('addEventDate').value;
    }
    if (currentNoteType === '[PHOTO]') {
      const file = document.getElementById('addPhotoInput').files[0];
      if (file) {
        noteData.imageData = await fileToBase64(file);
      }
    }
    if (currentNoteType === '[VOICE]' && recordedAudioBlob) {
      noteData.audioBlob = recordedAudioBlob;
      noteData.transcript = document.getElementById('addContent').value; 
    }

    await db.addNote(noteData);
    addModal.classList.remove('active');
    loadData();
  });

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => {
    settingsModal.classList.add('active');
  });
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
  });
  document.getElementById('switchToDesktop').addEventListener('click', () => {
    localStorage.setItem('preferred_ui', 'desktop');
    window.location.href = '../desktop/index.html';
  });
  
  setupRecording();
}

function updateTypeUI() {
  document.getElementById('addEventDate').classList.add('hidden');
  document.getElementById('addPhotoInput').classList.add('hidden');
  document.getElementById('voice-controls').classList.add('hidden');
  document.getElementById('addContent').placeholder = "What's on your mind?";
  document.getElementById('addContent').classList.remove('hidden');

  if (currentNoteType === '[EVENT]') {
    document.getElementById('addEventDate').classList.remove('hidden');
  } else if (currentNoteType === '[PHOTO]') {
    document.getElementById('addPhotoInput').classList.remove('hidden');
  } else if (currentNoteType === '[VOICE]') {
    document.getElementById('voice-controls').classList.remove('hidden');
    document.getElementById('addContent').placeholder = "Transcript will appear here...";
  } else if (currentNoteType === '[TASK]') {
    document.getElementById('addContent').placeholder = "What needs to be done?";
  }
}

async function loadData() {
  const notes = await db.getAllNotes();
  
  // Overview Data
  const today = new Date().toDateString();
  const events = notes.filter(n => n.type === '[EVENT]');
  const tasks = notes.filter(n => n.type === '[TASK]');
  
  const todayEvents = events.filter(e => e.eventDate && new Date(e.eventDate).toDateString() === today);
  
  document.getElementById('overview-hero-text').textContent = `You have ${todayEvents.length} events and ${tasks.length} tasks today.`;
  
  const eventsList = document.getElementById('overview-events-list');
  eventsList.innerHTML = '';
  events.slice(0, 5).forEach(e => {
    const el = document.createElement('div');
    el.className = 'list-card';
    el.innerHTML = `<strong>${e.content}</strong><span style="font-size:0.8rem;color:var(--text-muted)">${new Date(e.eventDate).toLocaleString()}</span>`;
    el.onclick = () => openViewModal(e);
    eventsList.appendChild(el);
  });

  const tasksList = document.getElementById('overview-tasks-list');
  tasksList.innerHTML = '';
  tasks.slice(0, 5).forEach(t => {
    const el = document.createElement('div');
    el.className = 'list-card task-card';
    el.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
      <span>${t.content}</span>
    `;
    el.onclick = () => openViewModal(t);
    tasksList.appendChild(el);
  });

  // Collections Data
  renderCollections(notes, document.getElementById('collections-grid'));
}

function renderCollections(notes, container) {
  container.innerHTML = '';
  notes.forEach((note, index) => {
    const card = document.createElement('div');
    const seed = (typeof note.id === 'number' ? note.id * 31 : index * 47) + (note.timestamp ? Number(note.timestamp) || 0 : 0);
    const isSquare = ((seed * 19 + 7) % 5) < 2;
    const shapeClass = isSquare ? 'shape-square' : 'shape-rect';

    card.className = `grid-card ${shapeClass}`;
    card.onclick = () => openViewModal(note);

    const typeText = note.type ? note.type.replace(/^\[|\]$/g, '') : 'NOTE';
    let innerHTML = `<div class="type-badge">${typeText}</div>`;

    if (note.type === '[PHOTO]' && note.imageData) {
      card.classList.add('photo-card');
      card.style.backgroundImage = `url(${note.imageData})`;
      innerHTML += `<div class="content-text">${note.content || note.transcript || ''}</div>`;
    } else if (note.type === '[VOICE]') {
      innerHTML += `
        <div class="voice-waveform">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
        </div>
        <div class="content-text">${note.transcript || note.content || 'Voice Note'}</div>
      `;
    } else if (note.type === '[TASK]') {
      innerHTML += `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom: 8px; color: var(--accent-color);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
        </div>
        <div class="content-text">${note.content || ''}</div>
      `;
    } else {
      innerHTML += `<div class="content-text">${note.content || ''}</div>`;
    }

    card.innerHTML = innerHTML;
    container.appendChild(card);
  });
}

async function renderSearch() {
  const query = searchInput.value.toLowerCase();
  const notes = await db.getAllNotes();
  const filtered = notes.filter(n => 
    (n.content && n.content.toLowerCase().includes(query)) ||
    (n.transcript && n.transcript.toLowerCase().includes(query)) ||
    (n.tags && n.tags.some(t => t.toLowerCase().includes(query)))
  );
  renderCollections(filtered, searchResults);
}

let currentViewNote = null;
function openViewModal(note) {
  currentViewNote = note;
  viewModal.classList.add('active');
  document.getElementById('view-type').textContent = note.type || '[NOTE]';
  
  const contentArea = document.getElementById('view-content-area');
  let html = `<div class="view-meta">${new Date(note.timestamp).toLocaleString()}</div>`;
  
  if (note.type === '[PHOTO]' && note.imageData) {
    html += `<img src="${note.imageData}" class="view-image">`;
  }
  
  if (note.type === '[EVENT]' && note.eventDate) {
    html += `<div style="color:var(--accent-color); margin-bottom:16px;">Event Date: ${new Date(note.eventDate).toLocaleString()}</div>`;
  }

  html += `<div style="font-size:1.1rem; line-height:1.5;">${note.content || note.transcript || ''}</div>`;
  
  if (note.type === '[VOICE]' && note.audioBlob) {
    html += `<audio controls src="${URL.createObjectURL(note.audioBlob)}" style="margin-top:16px; width:100%;"></audio>`;
  }

  if (note.tags && note.tags.length > 0) {
    html += `<div class="view-tags">` + note.tags.map(t => `<span class="tag-pill">#${t}</span>`).join('') + `</div>`;
  }

  contentArea.innerHTML = html;

  // Pin state
  const pinBtn = document.getElementById('viewPinBtn');
  if (note.isPinned) pinBtn.style.color = 'var(--accent-color)';
  else pinBtn.style.color = 'var(--text-color)';
}

document.getElementById('viewDeleteBtn').addEventListener('click', async () => {
  if (currentViewNote) {
    await db.deleteNote(currentViewNote.id);
    viewModal.classList.remove('active');
    loadData();
  }
});

document.getElementById('viewPinBtn').addEventListener('click', async () => {
  if (currentViewNote) {
    await db.togglePin(currentViewNote.id);
    currentViewNote.isPinned = !currentViewNote.isPinned;
    const pinBtn = document.getElementById('viewPinBtn');
    pinBtn.style.color = currentViewNote.isPinned ? 'var(--accent-color)' : 'var(--text-color)';
    loadData();
  }
});

// Recording setup
let mediaRecorder;
let audioChunks = [];
let recordedAudioBlob = null;
let isRecording = false;

function setupRecording() {
  const recordBtn = document.getElementById('recordBtn');
  const statusEl = document.getElementById('recordingStatus');

  recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
          recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          statusEl.textContent = 'Processing audio...';
          
          if (transcriber) {
            try {
              // Read blob as float32 array for whisper
              const arrayBuffer = await recordedAudioBlob.arrayBuffer();
              const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
              const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
              const audioData = audioBuffer.getChannelData(0);
              
              const output = await transcriber(audioData);
              const transcript = output.text.trim();
              document.getElementById('addContent').value = transcript;
              statusEl.textContent = 'Transcription complete.';
            } catch (err) {
              console.error(err);
              statusEl.textContent = 'Transcription failed.';
            }
          } else {
            statusEl.textContent = 'Audio recorded. (Transcriber not loaded)';
          }
        };

        mediaRecorder.start();
        isRecording = true;
        recordBtn.textContent = 'Stop Recording';
        recordBtn.classList.add('primary-btn');
        statusEl.textContent = 'Recording...';
      } catch (err) {
        console.error('Microphone error', err);
        statusEl.textContent = 'Error accessing microphone.';
      }
    } else {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      isRecording = false;
      recordBtn.textContent = 'Start Recording';
      recordBtn.classList.remove('primary-btn');
    }
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.addEventListener('DOMContentLoaded', init);
