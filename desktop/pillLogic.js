
    // --- Pill Bar Navigation ---
    const pillOverviewBtn = document.getElementById('pillOverviewBtn');
    const pillCollectionsBtn = document.getElementById('pillCollectionsBtn');
    const pillSearchBtn = document.getElementById('pillSearchBtn');
    const overviewSection = document.getElementById('overviewSection');
    const collectionsSection = document.getElementById('collectionsSection');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    const closeSearchBtn = document.getElementById('closeSearchBtn');

    if (pillOverviewBtn && pillCollectionsBtn) {
        pillOverviewBtn.addEventListener('click', () => {
            pillOverviewBtn.classList.add('active');
            pillCollectionsBtn.classList.remove('active');
            overviewSection.style.display = 'grid';
            collectionsSection.style.display = 'none';
        });

        pillCollectionsBtn.addEventListener('click', () => {
            pillCollectionsBtn.classList.add('active');
            pillOverviewBtn.classList.remove('active');
            overviewSection.style.display = 'none';
            collectionsSection.style.display = 'block';
        });
    }

    if (pillSearchBtn) {
        pillSearchBtn.addEventListener('click', () => {
            searchOverlay.classList.add('active');
            searchInput.focus();
        });
    }

    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            searchOverlay.classList.remove('active');
            searchInput.value = '';
            // Reset search filter
            currentFilter = 'all';
            document.querySelectorAll('#tagFilterList li').forEach(li => li.classList.remove('active'));
            document.querySelector('#tagFilterList li[data-tag="all"]').classList.add('active');
            loadNotes();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase();
            const notes = await db.getAllNotes(currentFilter);
            if (!query) {
                renderItems(notes);
                return;
            }
            const filtered = notes.filter(note => {
                return (note.content && note.content.toLowerCase().includes(query)) ||
                       (note.type && note.type.toLowerCase().includes(query)) ||
                       (note.transcript && note.transcript.toLowerCase().includes(query));
            });
            
            // Auto switch to collections view to show results if not already there
            if (pillCollectionsBtn && !pillCollectionsBtn.classList.contains('active')) {
                pillCollectionsBtn.click();
            }
            searchOverlay.classList.remove('active'); // optionally keep open or close
            renderItems(filtered);
        });
        
        // Let's close overlay on Enter
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchOverlay.classList.remove('active');
            }
        });
    }
