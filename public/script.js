// --- VARIABILI DI STATO GLOBALI ---
let connected = false;
let chatLog = [];
let partnerIp = null;
let reportSent = false;
let isTyping = false;
let socket;
let currentUserAvatar;
let partnerAvatar;
let pendingAvatar;
let userName;
let userBio;
let userFavoriteSong = {};
let showProfile = false;
let partnerProfile = {};
let activePalette = null; // Per le reazioni

// --- AVATAR DISPONIBILI ---
const AVATAR_CATEGORIES = {
    'Iconici': ['https://api.dicebear.com/8.x/avataaars/svg?seed=Felix', 'https://api.dicebear.com/8.x/avataaars/svg?seed=Jasper', 'https://api.dicebear.com/8.x/avataaars/svg?seed=Max', 'https://api.dicebear.com/8.x/avataaars/svg?seed=Milo'],
    'Moderni': ['https://api.dicebear.com/8.x/micah/svg?seed=Bella', 'https://api.dicebear.com/8.x/micah/svg?seed=Charlie', 'https://api.dicebear.com/8.x/micah/svg?seed=Lucy', 'https://api.dicebear.com/8.x/micah/svg?seed=Daisy'],
    'Pixel': ['https://api.dicebear.com/8.x/pixel-art/svg?seed=Rocky', 'https://api.dicebear.com/8.x/pixel-art/svg?seed=Annie', 'https://api.dicebear.com/8.x/pixel-art-neutral/svg?seed=Garfield', 'https://api.dicebear.com/8.x/pixel-art-neutral/svg?seed=Sheba'],
    'Creativi': ['https://api.dicebear.com/8.x/bottts/svg?seed=Bandit', 'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=Bubba', 'https://api.dicebear.com/8.x/adventurer/svg?seed=Angel', 'https://api.dicebear.com/8.x/adventurer-neutral/svg?seed=Sassy']
};
const DEFAULT_AVATAR_CATEGORY = 'Iconici';
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😯', '😢', '🙏'];

// --- FUNZIONI UTILITY ---
const debounce = (cb, delay = 1000) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => cb(...a), delay); }; };
const emitStopTyping = debounce(() => { if (isTyping && socket) { socket.emit('stop_typing'); isTyping = false; } }, 2000);
const getFlagEmoji = (code) => code && code.length === 2 ? String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))) : '🌍';

// --- LOGICA PRINCIPALE ---
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
    const currentUserAvatarDisplay = document.getElementById('currentUserAvatarDisplay');
    // ... (aggiungere altri selettori se necessario)

    // --- CONNESSIONE AL SERVER ---
    const serverURL = "https://chattingapp-backend.onrender.com";
    socket = io(serverURL);

    // --- FUNZIONI DI MANIPOLAZIONE UI ---
    const updateAvatarDisplay = () => { if(currentUserAvatarDisplay) currentUserAvatarDisplay.src = currentUserAvatar; };
    const scrollToBottom = () => { if (chatContent) chatContent.scrollTop = chatContent.scrollHeight; };
    
    const showLoadingAnimation = (text) => {
        chatMessages.innerHTML = `<div class="loading-container"><div class="orb-canvas"></div><p class="loading-text">${text}</p></div>`;
    };

    const resetChatUI = () => {
        chatMessages.innerHTML = '';
        status.textContent = 'Premi "Inizia Chat" per connetterti';
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        inputArea.classList.add('hidden');
        removeTypingIndicator();
        chatLog = [];
        partnerIp = null;
        reportSent = false;
        isTyping = false;
        startBtn.disabled = false;
        disconnectBtn.disabled = true;
        reportBtn.disabled = true;
        document.getElementById('viewPartnerProfileBtn').classList.add('hidden');
    };

    const addMessage = (msg) => {
        const { id, text, senderId, avatarUrl, reactions } = msg;
        const isYou = senderId === socket.id;
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isYou ? 'you' : 'other'}`;
        wrapper.innerHTML = `
            <img src="${avatarUrl || 'unknown.png'}" alt="Avatar" class="chat-avatar">
            <div class="message-container">
                <div class="message-content ${isYou ? 'you' : 'other'}" data-id="${id}">${text}</div>
                <div class="reactions-display"></div>
                <button class="add-reaction-btn" data-message-id="${id}">+</button>
            </div>
        `;
        chatMessages.appendChild(wrapper);
        updateReactions(wrapper, reactions);
        scrollToBottom();
        if (!isYou) chatLog.push(text);
    };
    
    const updateReactions = (messageWrapper, reactions) => {
        const display = messageWrapper.querySelector('.reactions-display');
        if (!display) return;
        display.innerHTML = '';
        if (reactions) {
            for (const emoji in reactions) {
                if (reactions[emoji] > 0) {
                    const chip = document.createElement('span');
                    chip.className = 'reaction-chip';
                    chip.textContent = `${emoji} ${reactions[emoji]}`;
                    display.appendChild(chip);
                }
            }
        }
    };

    const addSystemMessage = (text, type = 'system') => {
        const msgDiv = document.createElement('div');
        msgDiv.className = type === 'avatar' ? 'avatar-change-message' : 'system-message';
        msgDiv.innerHTML = text;
        chatMessages.appendChild(msgDiv);
        scrollToBottom();
    };

    const sendMessage = () => {
        const messageText = input.value.trim();
        if (messageText && connected) {
            emitStopTyping.cancel();
            socket.emit('message', messageText);
            input.value = '';
            isTyping = false;
            sendBtn.disabled = true;
        }
    };
    
    const removeTypingIndicator = () => { document.getElementById('typing-indicator-wrapper')?.remove(); };

    // --- CARICAMENTO IMPOSTAZIONI ---
    const loadUserSettings = () => {
        userName = localStorage.getItem('userName') || 'Anonimo';
        userBio = localStorage.getItem('userBio') || '';
        currentUserAvatar = localStorage.getItem('userAvatar') || AVATAR_CATEGORIES[DEFAULT_AVATAR_CATEGORY][0];
        showProfile = localStorage.getItem('showProfile') === 'true';
        try { userFavoriteSong = JSON.parse(localStorage.getItem('userFavoriteSong')) || {}; } catch { userFavoriteSong = {}; }
        updateAvatarDisplay();
    };

    // --- EVENTI SOCKET.IO ---
    socket.on('online_count', count => onlineCount.textContent = count);
    socket.on('waiting', () => showLoadingAnimation('In attesa di un altro utente...'));

    socket.on('match', (data) => {
        chatMessages.innerHTML = '';
        status.textContent = 'Connesso! Puoi iniziare a chattare.';
        inputArea.classList.remove('hidden');
        input.disabled = false;
        reportBtn.disabled = false;
        connected = true;
        partnerIp = data.partnerIp;
        partnerProfile = data.partnerProfile || {};
        partnerAvatar = partnerProfile.avatarUrl || 'unknown.png';
        document.getElementById('viewPartnerProfileBtn').classList.remove('hidden');
        
        const country = data.partnerCountry ? new Intl.DisplayNames(['it'], { type: 'country' }).of(data.partnerCountry) : null;
        const flag = country ? getFlagEmoji(data.partnerCountry) : '🌍';
        addSystemMessage(country ? `Sei connesso con un utente da: ${country} ${flag}` : 'Sei stato connesso con un altro utente 🌍');
    });

    socket.on('new_message', msg => { removeTypingIndicator(); addMessage(msg); });
    socket.on('update_reactions', ({ messageId, reactions }) => {
        const msgEl = document.querySelector(`.message-content[data-id="${messageId}"]`);
        if (msgEl) updateReactions(msgEl.closest('.message-wrapper'), reactions);
    });
    
    socket.on('update_profile_from_partner', (profile) => {
        if (partnerAvatar !== profile.avatarUrl) addSystemMessage(`<img src="${profile.avatarUrl}" alt="avatar"> Il partner ha cambiato avatar`, 'avatar');
        else addSystemMessage('Il partner ha aggiornato il suo profilo.');
        partnerProfile = profile;
        partnerAvatar = profile.avatarUrl;
    });

    socket.on('typing', () => {
        if (!document.getElementById('typing-indicator-wrapper')) {
            const ind = document.createElement('div');
            ind.id = 'typing-indicator-wrapper';
            ind.className = 'message-wrapper other';
            ind.innerHTML = `<img src="${partnerAvatar}" alt="Avatar" class="chat-avatar"><div class="message-content other typing-indicator">...</div>`;
            chatMessages.appendChild(ind);
            scrollToBottom();
        }
    });
    socket.on('stop_typing', removeTypingIndicator);
    
    socket.on('partner_disconnected', () => { addSystemMessage('Il tuo partner si è disconnesso.'); resetChatUI(); connected = false; });
    socket.on('connect_error', err => { status.textContent = `Errore di connessione. Riprova.`; resetChatUI(); });

    // --- EVENT LISTENERS UI ---
    startBtn.addEventListener('click', () => {
        if (connected) return;
        const profile = { avatarUrl: currentUserAvatar, name: userName, bio: userBio, favoriteSong: userFavoriteSong, showProfile };
        socket.emit('start_chat', profile);
        startBtn.disabled = true;
        disconnectBtn.disabled = false;
        showLoadingAnimation('Ricerca di un partner...');
    });

    disconnectBtn.addEventListener('click', () => {
        socket.emit('disconnect_chat');
        addSystemMessage('Ti sei disconnesso.');
        resetChatUI();
        connected = false;
    });
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
    input.addEventListener('input', () => {
        if (!connected) return;
        sendBtn.disabled = input.value.trim().length === 0;
        if (!isTyping) { socket.emit('typing'); isTyping = true; }
        emitStopTyping();
    });
    
    chatMessages.addEventListener('click', e => {
        if (e.target.classList.contains('add-reaction-btn')) {
            const messageId = e.target.dataset.messageId;
            const container = e.target.closest('.message-container');
            if (activePalette) activePalette.remove();
            activePalette = document.createElement('div');
            activePalette.className = 'reaction-palette';
            REACTION_EMOJIS.forEach(emoji => {
                const span = document.createElement('span');
                span.className = 'palette-emoji';
                span.textContent = emoji;
                span.onclick = () => {
                    socket.emit('add_reaction', { messageId, emoji });
                    activePalette.remove();
                    activePalette = null;
                };
                activePalette.appendChild(span);
            });
            container.appendChild(activePalette);
        } else if (activePalette && !activePalette.contains(e.target)) {
            activePalette.remove();
            activePalette = null;
        }
    });

    // --- UI Iniziale ---
    loadUserSettings();
    resetChatUI();
    // ... (altri listener per nav, tema, etc. da file originale se necessario)
});
