// Contenuto per il nuovo file: settings.js

// Questo event listener assicura che il codice venga eseguito
// solo dopo che la pagina principale ha caricato tutti gli elementi.
document.addEventListener('DOMContentLoaded', () => {

    // Selettori degli elementi specifici per le impostazioni
    const settingsNavBtn = document.getElementById('settingsNavBtn');
    const avatarGrid = document.getElementById('avatar-grid');
    const avatarCategorySelector = document.getElementById('avatar-category-selector');
    
    // Input del profilo
    const userNameInput = document.getElementById('userNameInput');
    const userBioInput = document.getElementById('userBioInput');
    
    // Elementi per la ricerca canzoni (da implementare in futuro)
    const userSongSearchInput = document.getElementById('userSongSearchInput');
    const songSearchBtn = document.getElementById('songSearchBtn');
    const songResultsDiv = document.getElementById('songResults');
    const selectedSongDisplay = document.getElementById('selectedSongDisplay');
    const selectedSongCover = document.getElementById('selectedSongCover');
    const selectedSongTitle = document.getElementById('selectedSongTitle');
    const selectedSongArtist = document.getElementById('selectedSongArtist');
    
    // Bottone per tornare alla chat che funge da "Salva"
    const backToChatBtn = document.getElementById('saveSettingsBtn');
    const chatNavBtn = document.querySelector('.nav-btn[data-section="chat"]');

    // --- FUNZIONI ---

    /**
     * Carica le impostazioni correnti dell'utente (salvate nelle variabili globali di script.js)
     * e le mostra nei campi di input della pagina delle impostazioni.
     */
    function loadUserSettings() {
        userNameInput.value = userName || '';
        userBioInput.value = userBio || '';
        
        // Logica per mostrare la canzone preferita (se presente)
        if (userFavoriteSong && userFavoriteSong.title) {
            selectedSongTitle.textContent = userFavoriteSong.title;
            selectedSongArtist.textContent = userFavoriteSong.artist;
            selectedSongCover.src = userFavoriteSong.cover;
            selectedSongDisplay.classList.remove('hidden');
        } else {
            selectedSongDisplay.classList.add('hidden');
        }

        // Seleziona l'avatar corrente nella griglia
        highlightSelectedAvatar(currentUserAvatar);
    }
    
    /**
     * Popola il selettore delle categorie di avatar.
     * @param {string} activeCategory - La categoria da preselezionare.
     */
    function populateCategorySelector(activeCategory) {
        avatarCategorySelector.innerHTML = ''; // Pulisce le categorie esistenti
        for (const category in AVATAR_CATEGORIES) {
            const button = document.createElement('button');
            button.className = 'control-btn';
            button.textContent = category;
            button.dataset.category = category;
            if (category === activeCategory) {
                button.classList.add('primary');
            }
            button.addEventListener('click', () => {
                // Rimuove la classe 'primary' da tutti i bottoni
                avatarCategorySelector.querySelectorAll('button').forEach(btn => btn.classList.remove('primary'));
                // Aggiunge la classe 'primary' al bottone cliccato
                button.classList.add('primary');
                populateAvatarGrid(category);
            });
            avatarCategorySelector.appendChild(button);
        }
    }

    /**
     * Popola la griglia con gli avatar della categoria selezionata.
     * @param {string} categoryName - Il nome della categoria da visualizzare.
     */
    function populateAvatarGrid(categoryName) {
        avatarGrid.innerHTML = ''; // Pulisce la griglia esistente
        const avatars = AVATAR_CATEGORIES[categoryName];
        if (!avatars) return;

        avatars.forEach(avatarUrl => {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = 'Avatar';
            img.className = 'avatar-option';
            img.dataset.url = avatarUrl;

            if (avatarUrl === pendingAvatar) {
                img.classList.add('selected');
            }

            img.addEventListener('click', () => {
                pendingAvatar = avatarUrl; // Aggiorna l'avatar temporaneo
                highlightSelectedAvatar(avatarUrl);
            });
            avatarGrid.appendChild(img);
        });
    }

    /**
     * Evidenzia l'avatar selezionato nella griglia.
     * @param {string} avatarUrl - L'URL dell'avatar da evidenziare.
     */
    function highlightSelectedAvatar(avatarUrl) {
        const allAvatars = avatarGrid.querySelectorAll('.avatar-option');
        allAvatars.forEach(img => {
            if (img.dataset.url === avatarUrl) {
                img.classList.add('selected');
            } else {
                img.classList.remove('selected');
            }
        });
    }

    /**
     * Salva le impostazioni modificate nelle variabili globali.
     */
    function saveSettings() {
        userName = userNameInput.value.trim() || 'Anonimo';
        userBio = userBioInput.value.trim();

        // Controlla se l'avatar è stato effettivamente cambiato
        if (currentUserAvatar !== pendingAvatar) {
            currentUserAvatar = pendingAvatar;
            addSelfAvatarChangeMessage(currentUserAvatar); // Notifica nella chat (funzione da script.js)
            updateAvatarDisplay(); // Aggiorna l'avatar nella navbar (funzione da script.js)
            
            // Se si è connessi, notifica il partner del cambio avatar
            if(connected && socket) {
                socket.emit('avatar_change', currentUserAvatar);
            }
        }
    }


    // --- EVENT LISTENERS ---

    // Quando si clicca sul pulsante delle impostazioni, inizializza la pagina
    settingsNavBtn.addEventListener('click', () => {
        pendingAvatar = currentUserAvatar; // Imposta l'avatar temporaneo a quello corrente

        // Trova la categoria dell'avatar corrente per preselezionarla
        let currentCategory = DEFAULT_AVATAR_CATEGORY;
        for (const category in AVATAR_CATEGORIES) {
            if (AVATAR_CATEGORIES[category].includes(currentUserAvatar)) {
                currentCategory = category;
                break;
            }
        }
        
        populateCategorySelector(currentCategory);
        populateAvatarGrid(currentCategory);
        loadUserSettings();
    });

    // Quando si clicca il pulsante "Torna alla Chat" (che funge da salva)
    backToChatBtn.addEventListener('click', () => {
        saveSettings();
        // Simula un click sul pulsante della chat per tornare alla sezione principale
        if (chatNavBtn) {
            chatNavBtn.click();
        }
    });
});
