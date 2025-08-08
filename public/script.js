// --- VARIABILI DI STATO GLOBALI ---
let connected = false;
let chatLog = [];
let partnerIp = null;
let reportSent = false;
let isTyping = false;
let socket;
let currentUserAvatar;
let partnerAvatar;
// Variabile per la selezione temporanea dell'avatar (usata da settings.js)
let pendingAvatar;
// Variabili per le impostazioni utente
let userName;
let userBio;
let userFavoriteSong = {};
let showProfile = false;
let partnerProfile = {};

// --- AVATAR DISPONIBILI ---
const AVATAR_CATEGORIES = {
    'Iconici': [
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Felix', 'https://api.dicebear.com/8.x/avataaars/svg?seed=Jasper',
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Max', 'https://api.dicebear.com/8.x/avataaars/svg?seed=Milo',
    ],
    'Moderni': [
        'https://api.dicebear.com/8.x/micah/svg?seed=Bella', 'https://api.dicebear.com/8.x/micah/svg?seed=Charlie',
        'https://api.dicebear.com/8.x/micah/svg?seed=Lucy', 'https://api.dicebear.com/8.x/micah/svg?seed=Daisy',
    ],
    'Pixel Art': [
        'https://api.dicebear.com/8.x/pixel-art/svg?seed=Rocky', 'https://api.dicebear.com/8.x/pixel-art/svg?seed=Annie',
        'https://api.dicebear.com/8.x/pixel-art-neutral/svg?seed=Garfield', 'https://api.dicebear.com/8.x/pixel-art-neutral/svg?seed=Sheba',
    ],
    'Creativi': [
        'https://api.dicebear.com/8.x/bottts/svg?seed=Bandit', 'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=Bubba',
        'https://api.dicebear.com/8.x/adventurer/svg?seed=Angel', 'https://api.dicebear.com/8.x/adventurer-neutral/svg?seed=Sassy'
    ]
};
const DEFAULT_AVATAR_CATEGORY = 'Iconici';

// --- FUNZIONI UTILITY ---
const debounce = (callback, delay = 1000) => { let timeout; const debounced = (...args) => { clearTimeout(timeout); timeout = setTimeout(() => { callback(...args); }, delay); }; debounced.cancel = () => { clearTimeout(timeout); }; return debounced; }
const emitStopTyping = debounce(() => { if (isTyping && socket) { socket.emit('stop_typing'); isTyping = false; } }, 2000);


// --- LOGICA PRINCIPALE AL CARICAMENTO DELLA PAGINA ---
document.addEventListener('DOMContentLoaded', () => {

    // --- SELETTORI DOM ---
    const navLinks = document.getElementById('nav-links');
    const hamburger = document.getElementById('hamburger');
    const themeToggleBtn = document.getElementById('themeToggle');
    const activeIndicator = document.querySelector('.active-indicator');
    const navButtons = document.querySelectorAll('.nav-btn');
    const status = document.getElementById('status');
    const chatMessages = document.getElementById('chat-messages');
    const input = document.getElementById('input');
    const inputArea = document.getElementById('input-area');
    const startBtn = document.getElementById('startBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const sendBtn = document.getElementById('sendBtn');
    const onlineCount = document.getElementById('onlineCount');
    const reportBtn = document.getElementById('reportBtn');
    const chatContent = document.querySelector('.chat-content');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emoji-picker');
    const currentUserAvatarDisplay = document.getElementById('currentUserAvatarDisplay');
    const viewPartnerProfileBtn = document.getElementById('viewPartnerProfileBtn');
    const partnerProfileModal = document.getElementById('partner-profile-modal');
    const closePartnerProfileBtn = document.getElementById('closePartnerProfileBtn');
    const partnerProfileName = document.getElementById('partnerProfileName');
    const partnerProfileAvatar = document.getElementById('partnerProfileAvatar');
    const partnerProfileBio = document.getElementById('partnerProfileBio');
    const partnerProfileSongDisplay = document.getElementById('partnerProfileSongDisplay');
    const partnerProfileSongCover = document.getElementById('partnerProfileSongCover');
    const partnerProfileSongTitle = document.getElementById('partnerProfileSongTitle');
    const partnerProfileSongArtist = document.getElementById('partnerProfileSongArtist');
    const partnerProfileSongFallback = document.getElementById('partnerProfileSongFallback');

    // --- CONNESSIONE AL SERVER ---
    const serverURL = "https://chattingapp-backend.onrender.com"; // URL pubblico di default
    socket = io(serverURL);
    
    // --- FUNZIONI DI MANIPOLAZIONE DELL'INTERFACCIA ---
    const moveActiveIndicator = (element) => { if (element && window.innerWidth > 768) { activeIndicator.style.width = `${element.offsetWidth}px`; activeIndicator.style.transform = `translateX(${element.offsetLeft}px)`; activeIndicator.style.opacity = 1; } else { activeIndicator.style.opacity = 0; } }
    
    const showSection = (sectionId, element) => { 
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        const activeSection = document.getElementById(sectionId + '-section');
        if (activeSection) activeSection.classList.add('active');
        navButtons.forEach(btn => btn.classList.remove('active'));
        if (element) { element.classList.add('active'); moveActiveIndicator(element); }
        if (window.innerWidth <= 768 && navLinks.classList.contains('open')) {
            navLinks.classList.remove('open');
            hamburger.classList.remove('open');
        }
    };

    const resetChatUI = () => {
        chatMessages.innerHTML = '';
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        sendBtn.classList.remove('active-animation');
        inputArea.classList.add('hidden');
        removeTypingIndicator();
        chatLog = [];
        partnerIp = null;
        reportSent = false;
        isTyping = false;
        startBtn.disabled = false;
        disconnectBtn.disabled = true;
        reportBtn.disabled = true;
        viewPartnerProfileBtn.classList.add('hidden');
    };

    const scrollToBottom = () => { if (chatContent) chatContent.scrollTop = chatContent.scrollHeight; };
    const updateAvatarDisplay = () => { currentUserAvatarDisplay.src = currentUserAvatar; };

    const addMessage = (messageObject) => {
        const { id, text, senderId, avatarUrl } = messageObject;
        const isYou = senderId === socket.id;
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isYou ? 'you' : 'other'}`;
        wrapper.innerHTML = `
            <img src="${avatarUrl}" alt="Avatar" class="chat-avatar">
            <div class="message-and-button-container">
                <div class="message ${isYou ? 'you' : 'other'}" data-id="${id}">${text}</div>
            </div>
        `;
        chatMessages.appendChild(wrapper);
        scrollToBottom();
        if (!isYou) chatLog.push(text);
    };

    const addSystemMessage = (text) => {
        const sysMsg = document.createElement('div');
        sysMsg.className = 'system-message';
        sysMsg.innerHTML = text;
        chatMessages.appendChild(sysMsg);
        scrollToBottom();
        setTimeout(() => sysMsg.classList.add('visible'), 10);
    };
    
    const addAvatarChangeMessage = (newAvatarUrl, isSelf = false) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = isSelf ? 'self-avatar-change-message' : 'avatar-change-message';
        msgDiv.innerHTML = `
            <img src="${newAvatarUrl}" alt="Nuovo Avatar">
            <p>${isSelf ? 'Hai cambiato il tuo avatar.' : 'Il tuo partner ha cambiato avatar.'}</p>
        `;
        chatMessages.appendChild(msgDiv);
        scrollToBottom();
        setTimeout(() => msgDiv.classList.add('visible'), 10);
    };

    const showTypingIndicator = () => {
        if (document.getElementById('typing-indicator-wrapper')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper other';
        wrapper.id = 'typing-indicator-wrapper';
        wrapper.innerHTML = `
            <img src="${partnerAvatar}" alt="Partner Avatar" class="chat-avatar">
            <div class="message other typing-indicator"><div class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>
        `;
        chatMessages.appendChild(wrapper);
        scrollToBottom();
    };
    
    const removeTypingIndicator = () => { const el = document.getElementById('typing-indicator-wrapper'); if (el) el.remove(); };
    const getFlagEmoji = (code) => code && code.length === 2 ? String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))) : '🌍';

    const showLoadingAnimation = (text) => {
        chatMessages.innerHTML = `<div class="status-message">${text}</div>`;
    };
    
    const sendMessage = () => {
        const messageText = input.value.trim();
        if (messageText && connected) {
            emitStopTyping.cancel();
            socket.emit('message', messageText);
            addMessage({ id: Date.now(), text: messageText, senderId: socket.id, avatarUrl: currentUserAvatar });
            input.value = '';
            if (isTyping) { socket.emit('stop_typing'); isTyping = false; }
            sendBtn.disabled = true;
            sendBtn.classList.remove('active-animation');
        }
    };
    
    // --- GESTIONE IMPOSTAZIONI UTENTE ---
    const loadUserSettings = () => {
        userName = localStorage.getItem('userName') || 'Anonimo';
        userBio = localStorage.getItem('userBio') || '';
        currentUserAvatar = localStorage.getItem('userAvatar') || AVATAR_CATEGORIES[DEFAULT_AVATAR_CATEGORY][0];
        showProfile = localStorage.getItem('showProfile') === 'true';
        try {
            userFavoriteSong = JSON.parse(localStorage.getItem('userFavoriteSong')) || {};
        } catch {
            userFavoriteSong = {};
        }
        updateAvatarDisplay();
    };

    // --- EVENTI SOCKET.IO ---
    socket.on('online_count', (count) => { onlineCount.textContent = count; });
    
    socket.on('waiting', () => { showLoadingAnimation('In attesa di un altro utente...'); });

    socket.on('match', (data) => {
        chatMessages.innerHTML = '';
        status.textContent = 'Connesso! Puoi iniziare a chattare.';
        inputArea.classList.remove('hidden');
        input.disabled = false;
        disconnectBtn.disabled = false;
        reportBtn.disabled = false;
        connected = true;
        partnerIp = data.partnerIp;
        partnerProfile = data.partnerProfile || {};
        partnerAvatar = partnerProfile.avatarUrl || 'unknown.png';
        viewPartnerProfileBtn.classList.remove('hidden');
        
        const countryName = data.partnerCountry !== 'Sconosciuto' ? new Intl.DisplayNames(['it'], { type: 'country' }).of(data.partnerCountry) : null;
        const flag = countryName ? getFlagEmoji(data.partnerCountry) : '🌍';
        addSystemMessage(countryName ? `Sei connesso con un utente da: ${countryName} ${flag}` : 'Sei stato connesso con un altro utente 🌍');
    });

    socket.on('update_profile_from_partner', (profileData) => {
        if (!profileData) return;
        if (partnerAvatar !== profileData.avatarUrl) {
            addAvatarChangeMessage(profileData.avatarUrl, false);
        } else {
            addSystemMessage('Il partner ha aggiornato il suo profilo.');
        }
        partnerProfile = profileData;
        partnerAvatar = profileData.avatarUrl;
    });

    socket.on('new_message', (messageObject) => {
        removeTypingIndicator();
        addMessage(messageObject);
    });
    
    socket.on('typing', showTypingIndicator);
    socket.on('stop_typing', removeTypingIndicator);
    
    socket.on('partner_disconnected', () => {
        status.textContent = 'Il tuo partner si è disconnesso.';
        resetChatUI();
        connected = false;
    });

    socket.on('connect_error', (err) => {
        status.textContent = `Errore di connessione: ${err.message}. Riprova più tardi.`;
        resetChatUI();
        connected = false;
    });

    // --- EVENT LISTENERS ---
    startBtn.addEventListener('click', () => { 
        if (!connected) {
            const myProfile = { avatarUrl: currentUserAvatar, name: userName, bio: userBio, favoriteSong: userFavoriteSong, showProfile };
            socket.emit('start_chat', myProfile);
            startBtn.disabled = true;
            showLoadingAnimation('Ricerca di un partner...');
        }
    });

    disconnectBtn.addEventListener('click', () => {
        socket.emit('disconnect_chat');
        status.textContent = 'Disconnesso. Premi "Inizia Chat" per connetterti';
        resetChatUI();
        connected = false;
    });
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !sendBtn.disabled) sendMessage(); });
    input.addEventListener('input', () => {
        if (!connected) return;
        sendBtn.disabled = input.value.trim().length === 0;
        sendBtn.classList.toggle('active-animation', !sendBtn.disabled);
        if (!isTyping) { socket.emit('typing'); isTyping = true; }
        emitStopTyping();
    });

    reportBtn.addEventListener('click', () => {
        if (!connected || !partnerIp) return alert("Nessun partner da segnalare.");
        if (reportSent) return alert("Hai già segnalato questo utente.");
        socket.emit("report_user", { partnerIp, chatLog });
        alert("Segnalazione inviata. Il partner è stato disconnesso.");
        reportSent = true;
        socket.emit('disconnect_chat');
        status.textContent = 'Hai segnalato il partner. Premi "Inizia Chat" per riconnetterti.';
        resetChatUI();
        connected = false;
    });

    // --- Navigazione, Tema e UI secondaria ---
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') document.body.classList.add('light-mode');
    themeToggleBtn.innerHTML = document.body.classList.contains('light-mode') ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    
    navButtons.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); showSection(btn.dataset.section, btn); }));
    
    document.querySelectorAll('.faq-header').forEach(h => h.addEventListener('click', () => h.closest('.faq-item').classList.toggle('active')));
    
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        themeToggleBtn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
    
    hamburger.addEventListener('click', () => { navLinks.classList.toggle('open'); hamburger.classList.toggle('open'); });
    window.addEventListener('resize', () => moveActiveIndicator(document.querySelector('.nav-btn.active')));
    
    emojiBtn.addEventListener('click', (e) => { e.stopPropagation(); emojiPicker.hidden = !emojiPicker.hidden; });
    emojiPicker.addEventListener('emoji-click', e => { input.value += e.detail.unicode; input.dispatchEvent(new Event('input')); });

    // Modale profilo partner
    viewPartnerProfileBtn.addEventListener('click', () => {
        if (partnerProfile.showProfile) {
            partnerProfileName.textContent = partnerProfile.name || 'Anonimo';
            partnerProfileAvatar.src = partnerProfile.avatarUrl || 'unknown.png';
            partnerProfileBio.textContent = partnerProfile.bio || 'Nessuna bio.';
            if (partnerProfile.favoriteSong?.title) {
                partnerProfileSongTitle.textContent = partnerProfile.favoriteSong.title;
                partnerProfileSongArtist.textContent = partnerProfile.favoriteSong.artist;
                partnerProfileSongCover.src = partnerProfile.favoriteSong.cover;
                partnerProfileSongDisplay.classList.remove('hidden');
                partnerProfileSongFallback.classList.add('hidden');
            } else {
                partnerProfileSongDisplay.classList.add('hidden');
                partnerProfileSongFallback.classList.remove('hidden');
            }
        } else {
            partnerProfileName.textContent = 'Profilo Privato';
            partnerProfileAvatar.src = 'unknown.png';
            partnerProfileBio.textContent = 'Questo utente ha scelto di non condividere il suo profilo.';
            partnerProfileSongDisplay.classList.add('hidden');
            partnerProfileSongFallback.classList.remove('hidden');
        }
        partnerProfileModal.classList.remove('hidden');
    });
    
    closePartnerProfileBtn.addEventListener('click', () => partnerProfileModal.classList.add('hidden'));

    // --- Inizializzazione ---
    loadUserSettings();
    resetChatUI();
    showSection('chat', document.querySelector('.nav-btn[data-section="chat"]'));
});