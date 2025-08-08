// Questo event listener assicura che il codice venga eseguito
// solo dopo che la pagina principale (script.js) ha caricato tutto.
document.addEventListener('DOMContentLoaded', () => {

    // Selettori degli elementi specifici per le impostazioni
    const settingsNavBtn = document.getElementById('settingsNavBtn');
    const avatarGrid = document.getElementById('avatar-grid');
    const avatarCategorySelector = document.getElementById('avatar-category-selector');
    const userNameInput = document.getElementById('userNameInput');
    const userBioInput = document.getElementById('userBioInput');
    const userSongSearchInput = document.getElementById('userSongSearchInput');
    const songSearchBtn = document.getElementById('songSearchBtn');
    const songResultsDiv = document.getElementById('songResults');
    const selectedSongDisplay = document.getElementById('selectedSongDisplay');
    const selectedSongCover = document.getElementById('selectedSongCover');
    const selectedSongTitle = document.getElementById('selectedSongTitle');
    const selectedSongArtist = document.getElementById('selectedSongArtist');
    const showProfileBtn = document.getElementById('showProfileBtn');
    const backToChatBtn = document.getElementById('saveSettingsBtn');
    const chatNavBtn = document.querySelector('.nav-btn[data-section="chat"]');

    // --- FUNZIONI ---

    /**
     * Carica le impostazioni correnti dell'utente dalle variabili globali
     * e le mostra nei campi di input della pagina.
     */
    function loadCurrentSettings() {
        userNameInput.value = userName || '';
        userBioInput.value = userBio || '';

        if (userFavoriteSong && userFavoriteSong.title) {
            selectedSongTitle.textContent = userFavoriteSong.title;
            selectedSongArtist.textContent = userFavoriteSong.artist;
            selectedSongCover.src = userFavoriteSong.cover;
            selectedSongDisplay.classList.remove('hidden');
        } else {
            selectedSongDisplay.classList.add('hidden');
        }
        
        updateShowProfileButton();
        highlightSelectedAvatar(currentUserAvatar);
    }
    
    /**
     * Aggiorna l'aspetto e il testo del pulsante di visibilità del profilo.
     */
    function updateShowProfileButton() {
        const icon = showProfileBtn.querySelector('i');
        const text = showProfileBtn.querySelector('span');
        if (showProfile) {
            showProfileBtn.classList.remove('danger');
            showProfileBtn.classList.add('primary');
            icon.className = 'fas fa-eye';
            text.textContent = 'Visibilità Attiva';
        } else {
            showProfileBtn.classList.remove('primary');
            showProfileBtn.classList.add('danger');
            icon.className = 'fas fa-eye-slash';
            text.textContent = 'Visibilità Disattiva';
        }
    }

    /**
     * Popola il selettore delle categorie di avatar.
     */
    function populateCategorySelector(activeCategory) {
        avatarCategorySelector.innerHTML = '';
        Object.keys(AVATAR_CATEGORIES).forEach(category => {
            const button = document.createElement('button');
            button.className = 'control-btn';
            button.textContent = category;
            button.dataset.category = category;
            if (category === activeCategory) button.classList.add('primary');
            
            button.addEventListener('click', () => {
                avatarCategorySelector.querySelectorAll('button').forEach(btn => btn.classList.remove('primary'));
                button.classList.add('primary');
                populateAvatarGrid(category);
            });
            avatarCategorySelector.appendChild(button);
        });
    }

    /**
     * Popola la griglia con gli avatar della categoria selezionata.
     */
    function populateAvatarGrid(categoryName) {
        avatarGrid.innerHTML = '';
        const avatars = AVATAR_CATEGORIES[categoryName] || [];
        avatars.forEach(avatarUrl => {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = 'Avatar';
            img.className = 'avatar-option';
            img.dataset.url = avatarUrl;
            if (avatarUrl === pendingAvatar) img.classList.add('selected');

            img.addEventListener('click', () => {
                pendingAvatar = avatarUrl;
                highlightSelectedAvatar(avatarUrl);
            });
            avatarGrid.appendChild(img);
        });
    }

    /**
     * Evidenzia l'avatar selezionato nella griglia.
     */
    function highlightSelectedAvatar(avatarUrl) {
        avatarGrid.querySelectorAll('.avatar-option').forEach(img => {
            img.classList.toggle('selected', img.dataset.url === avatarUrl);
        });
    }

    /**
     * Salva le impostazioni modificate nelle variabili globali e nel localStorage.
     */
    function saveAllSettings() {
        // Salva le modifiche nelle variabili globali
        userName = userNameInput.value.trim() || 'Anonimo';
        userBio = userBioInput.value.trim();
        
        let profileUpdated = false;
        if (localStorage.getItem('userName') !== userName) profileUpdated = true;
        if (localStorage.getItem('userBio') !== userBio) profileUpdated = true;
        if (localStorage.getItem('showProfile') !== String(showProfile)) profileUpdated = true;
        if (JSON.stringify(userFavoriteSong) !== localStorage.getItem('userFavoriteSong')) profileUpdated = true;

        // Controlla se l'avatar è stato cambiato
        if (currentUserAvatar !== pendingAvatar) {
            currentUserAvatar = pendingAvatar;
            addAvatarChangeMessage(currentUserAvatar, true); // Notifica nella chat
            profileUpdated = true;
        }

        // Salva tutto nel localStorage
        localStorage.setItem('userName', userName);
        localStorage.setItem('userBio', userBio);
        localStorage.setItem('userAvatar', currentUserAvatar);
        localStorage.setItem('showProfile', showProfile);
        localStorage.setItem('userFavoriteSong', JSON.stringify(userFavoriteSong));
        
        updateAvatarDisplay(); // Aggiorna l'avatar nella navbar

        // Se si è connessi e qualcosa è cambiato, notifica il partner
        if (connected && socket && profileUpdated) {
            const myProfile = { avatarUrl: currentUserAvatar, name: userName, bio: userBio, favoriteSong: userFavoriteSong, showProfile };
            socket.emit('update_profile', myProfile);
        }
    }
    
    /**
     * Cerca le canzoni tramite il proxy backend.
     */
    async function searchSongs(query) {
        if (query.length < 3) return;
        songResultsDiv.innerHTML = '<p>Caricamento...</p>';
        try {
            // Assumiamo che serverURL sia una variabile globale definita in script.js
            const response = await fetch(`${socket.io.uri}/api/search-songs?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Risposta del server non valida');
            
            const data = await response.json();
            songResultsDiv.innerHTML = '';

            if (!data.data || data.data.length === 0) {
                songResultsDiv.innerHTML = '<p>Nessun risultato.</p>';
                return;
            }

            data.data.slice(0, 10).forEach(song => { // Limita a 10 risultati
                const card = document.createElement('div');
                card.className = 'song-result-card';
                card.innerHTML = `
                    <img src="${song.album.cover_medium}" alt="Copertina">
                    <h4>${song.title}</h4>
                    <p>${song.artist.name}</p>
                `;
                card.addEventListener('click', () => {
                    userFavoriteSong = { title: song.title, artist: song.artist.name, cover: song.album.cover_medium };
                    selectedSongTitle.textContent = song.title;
                    selectedSongArtist.textContent = song.artist.name;
                    selectedSongCover.src = song.album.cover_medium;
                    selectedSongDisplay.classList.remove('hidden');
                    songResultsDiv.innerHTML = '';
                    userSongSearchInput.value = '';
                });
                songResultsDiv.appendChild(card);
            });
        } catch (error) {
            console.error("Errore ricerca canzone:", error);
            songResultsDiv.innerHTML = '<p style="color:var(--danger-color);">Errore nel caricamento.</p>';
        }
    }

    // --- EVENT LISTENERS ---

    // Quando si clicca sul pulsante delle impostazioni, inizializza la pagina
    settingsNavBtn.addEventListener('click', () => {
        pendingAvatar = currentUserAvatar; // Imposta l'avatar temporaneo a quello corrente

        let currentCategory = DEFAULT_AVATAR_CATEGORY;
        for (const category in AVATAR_CATEGORIES) {
            if (AVATAR_CATEGORIES[category].includes(currentUserAvatar)) {
                currentCategory = category;
                break;
            }
        }
        
        populateCategorySelector(currentCategory);
        populateAvatarGrid(currentCategory);
        loadCurrentSettings();
    });
    
    // Gestione pulsante visibilità profilo
    showProfileBtn.addEventListener('click', () => {
        showProfile = !showProfile;
        updateShowProfileButton();
    });

    // Gestione ricerca canzoni
    songSearchBtn.addEventListener('click', () => searchSongs(userSongSearchInput.value));
    userSongSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchSongs(userSongSearchInput.value);
    });

    // Quando si clicca il pulsante "Salva e Torna"
    backToChatBtn.addEventListener('click', () => {
        saveAllSettings();
        if (chatNavBtn) chatNavBtn.click(); // Torna alla sezione chat
    });
});