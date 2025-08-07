// --- (tutto l'inizio del file fino alla logica delle reazioni rimane invariato) ---
// ...

    // --- LOGICA PER LE REAZIONI ---
    const REACTION_EMOJIS = ['👍', '❤️', '😂', '😯', '😢', '🙏'];
    let activePalette = null;

    function createReactionPalette(messageId) {
        // ... (funzione invariata) ...
        const palette = document.createElement('div'); palette.className = 'reaction-palette'; palette.dataset.messageId = messageId;
        REACTION_EMOJIS.forEach(emoji => { const emojiSpan = document.createElement('span'); emojiSpan.className = 'palette-emoji'; emojiSpan.textContent = emoji; palette.appendChild(emojiSpan); });
        return palette;
    }
    
    // MODIFICA: Ora il click sull'emoji invia l'evento al server
    chatMessages.addEventListener('click', (event) => {
        const target = event.target;

        if (target.classList.contains('palette-emoji')) {
            const palette = target.closest('.reaction-palette');
            const messageId = palette.dataset.messageId;
            const emoji = target.textContent;
            
            // Invia l'evento al server!
            socket.emit('add_reaction', { messageId, emoji });
            
            if (activePalette) { activePalette.remove(); activePalette = null; }
            return;
        }

        if (activePalette) { activePalette.remove(); activePalette = null; }

        if (target.classList.contains('add-reaction-btn')) {
            const messageId = target.dataset.messageId;
            const messageWrapper = target.closest('.message-wrapper');
            activePalette = createReactionPalette(messageId);
            messageWrapper.appendChild(activePalette);
            setTimeout(() => { activePalette.classList.add('visible'); }, 10);
        }
    });

    // --- (tutti gli event listeners generali rimangono invariati) ---
    // ...

    // --- EVENTI SOCKET.IO ---
    // ... (tutti gli altri eventi socket.on rimangono invariati) ...

    // MODIFICA: Aggiungiamo il listener per ricevere gli aggiornamenti delle reazioni
    socket.on('update_reactions', ({ messageId, reactions }) => {
        // Troviamo il div del messaggio giusto usando il suo data-id
        const messageDiv = document.querySelector(`.message[data-id="${messageId}"]`);
        if (!messageDiv) return;

        const reactionsDisplay = messageDiv.querySelector('.reactions-display');
        if (!reactionsDisplay) return;

        // Puliamo le reazioni vecchie
        reactionsDisplay.innerHTML = '';

        // Creiamo l'HTML per le nuove reazioni
        let reactionsHTML = '';
        for (const emoji in reactions) {
            const count = reactions[emoji];
            if (count > 0) {
                 reactionsHTML += `<span class="reaction-chip">${emoji} ${count}</span>`;
            }
        }
        reactionsDisplay.innerHTML = reactionsHTML;
    });

    // ... (tutti gli altri eventi socket.on rimangono invariati) ...
});
