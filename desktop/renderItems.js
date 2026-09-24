    function renderItems(items) {
        memoryList.innerHTML = '';
        if (itemCountDisplay) {
            itemCountDisplay.textContent = `( ${items.length} )`;
        }
        items.forEach((item, index) => {
            const itemEl = document.createElement('div');
            // Pseudo-random hash for organic randomized layout (span 1 rect vs span 2 square)
            const seed = (typeof item.id === 'number' ? item.id * 31 : index * 47) + (item.timestamp ? item.timestamp.length : 0);
            const isSquare = ((seed * 19 + 7) % 5) < 2;
            const shapeClass = isSquare ? 'shape-square' : 'shape-rect';

            itemEl.className = `memory-item ${item.isPinned ? 'pinned' : ''} ${shapeClass}`;
            itemEl.onclick = () => openViewModal(item);

            // Format time relative
            const timeString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let previewHtml = '';
            if (item.imageData) {
                previewHtml = `<img src="${item.imageData}" class="item-image-preview">`;
            }

            let pinHtml = item.isPinned ? '<div class="pinned-badge">PINNED</div>' : '';
            
            let contentHtml = '';
            if (item.content) {
                contentHtml = `<span class="item-content">${item.content}</span>`;
            } else if (item.imageData) {
                contentHtml = `<span class="item-content">Image Attachment</span>`;
            } else if (!item.audioBlob) {
                contentHtml = `<span class="item-content">Empty</span>`;
            }

            itemEl.innerHTML = `
                ${pinHtml}
                ${previewHtml}
                <div class="item-left">
                    <span class="item-type">${formatType(item.type)}</span>
                    ${item.type === '[VOICE]' && item.audioBlob ? `
                        <div class="audio-player-custom">
                            <button class="audio-play-btn" onclick="event.stopPropagation(); const audio = this.nextElementSibling; audio.paused ? audio.play() : audio.pause();">▶</button>
                            <audio src="${URL.createObjectURL(item.audioBlob)}" onended="this.previousElementSibling.textContent='▶'" onplay="this.previousElementSibling.textContent='⏸'" onpause="this.previousElementSibling.textContent='▶'"></audio>
                            <div class="audio-wave"></div>
                        </div>
                        ${item.transcript ? `<div class="transcript-text visible">${item.transcript}</div>` : ''}
                        ${contentHtml}
                    ` : `${contentHtml}`}
                </div>
                <span class="item-time">${timeString}</span>
            `;

            memoryList.appendChild(itemEl);
        });
    }
