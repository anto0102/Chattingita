// --- VARIABILI DI STATO GLOBALI ---
let connected = false;
let chatLog = [];
let partnerIp = null;
let reportSent = false;
let isTyping = false;
let socket;
let currentUserAvatar;
let partnerAvatar;
// Variabile per la selezione temporanea dell'avatar
let pendingAvatar;

// --- NUOVO: SELEZIONE AVATAR FINALE CON I PIÙ POPOLARI DI DICEBEAR ---
const AVATAR_CATEGORIES = {
    'Personaggi Iconici': [
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Felix',
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Jasper',
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Max',
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Milo',
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Leo',
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Sam',
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Simon',
        'https://api.dicebear.com/8.x/avataaars/svg?seed=Toby'
    ],
    'Stile Moderno': [
        'https://api.dicebear.com/8.x/micah/svg?seed=Bella',
        'https://api.dicebear.com/8.x/micah/svg?seed=Charlie',
        'https://api.dicebear.com/8.x/micah/svg?seed=Lucy',
        'https://api.dicebear.com/8.x/micah/svg?seed=Daisy',
        'https://api.dicebear.com/8.x/micah/svg?seed=Sadie',
        'https://api.dicebear.com/8.x/micah/svg?seed=Molly',
        'https://api.dicebear.com/8.x/micah/svg?seed=Zoe',
        'https://api.dicebear.com/8.x/micah/svg?seed=Cleo'
    ],
    'Retrò & Pixel': [
        'https://api.dicebear.com/8.x/pixel-art/svg?seed=Rocky',
        'https://api.dicebear.com/8.x/pixel-art/svg?seed=Annie',
        'https://api.dicebear.com/8.x/pixel-art/svg?seed=Abby',
        'https://api.dicebear.com/8.x/pixel-art/svg?seed=Misty',
        'https://api.dicebear.com/8.x/pixel-art-neutral/svg?seed=Garfield',
        'https://api.dicebear.com/8.x/pixel-art-neutral/svg?seed=Sheba',
        'https://api.dicebear.com/8.x/pixel-art-neutral/svg?seed=Mittens',
        'https://api.dicebear.com/8.x/pixel-art-neutral/svg?seed=Pepper'
    ],
    'Creativi': [
        'https://api.dicebear.com/8.x/bottts/svg?seed=Bandit',
        'https://api.dicebear.com/8.x/bottts/svg?seed=Bear',
        'https://api.dicebear.com/8.x/bottts/svg?seed=Boo',
        'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=Bubba',
        'https://api.dicebear.com/8.x/adventurer/svg?seed=Angel',
        'https://api.dicebear.com/8.x/adventurer/svg?seed=Oreo',
        'https://api.dicebear.com/8.x/adventurer-neutral/svg?seed=Patches',
        'https://api.dicebear.com/8.x/adventurer-neutral/svg?seed=Sassy'
    ]
};
const DEFAULT_AVATAR_CATEGORY = 'Personaggi Iconici';


// --- FUNZIONI UTILITY GLOBALI ---
function debounce(callback, delay = 1000) { let timeout; const debounced = (...args) => { clearTimeout(timeout); timeout = setTimeout(() => { callback(...args); }, delay); }; debounced.cancel = () => { clearTimeout(timeout); }; return debounced; }
const emitStopTyping = debounce(() => { if (isTyping && socket) { socket.emit('stop_typing'); isTyping = false; } }, 2000);

// --- TUTTA LA LOGICA PARTE QUANDO LA PAGINA È PRONTA ---
document.addEventListener('DOMContentLoaded', () => {

    // --- SELETTORI DEGLI ELEMENTI DEL DOM ---
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
    const typingIndicatorContainer = document.getElementById('typing-indicator-container');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emoji-picker');
    const settingsBtn = document.getElementById('settingsBtn');
    const avatarModal = document.getElementById('avatar-modal');
    const avatarGrid = document.getElementById('avatar-grid');
    const closeAvatarModalBtn = document.getElementById('closeAvatarModal');
    const avatarCategorySelector = document.getElementById('avatar-category-selector');
    
    // NUOVO: Selettore per l'avatar nella navbar
    const currentUserAvatarDisplay = document.getElementById('currentUserAvatarDisplay');


    // --- CONNESSIONE DINAMICA AL SERVER ---
    const publicServerURL = "https://chattingapp-backend.onrender.com";
    const betaServerURL = "https://chattingapp-backend-production.up.railway.app";
    let serverURL;
    const currentHostname = window.location.hostname;
    if (currentHostname === "chatita.me" || currentHostname === "www.chatita.me") { serverURL = publicServerURL; }
    else if (currentHostname === "chattingitabeta.netlify.app") { serverURL = betaServerURL; }
    else { serverURL = betaServerURL; }
    socket = io(serverURL);

    // --- FUNZIONI CHE MANIPOLANO IL DOM ---
    function moveActiveIndicator(element) { if (element && window.innerWidth > 768) { activeIndicator.style.width = `${element.offsetWidth}px`; activeIndicator.style.transform = `translateX(${element.offsetLeft}px)`; activeIndicator.style.opacity = 1; } else { activeIndicator.style.opacity = 0; } }
    function showSection(sectionId, element) { const sections = document.querySelectorAll('.content-section'); sections.forEach(section => { section.classList.remove('active'); }); const activeSection = document.getElementById(sectionId + '-section'); if (activeSection) { activeSection.classList.add('active'); } navButtons.forEach(btn => btn.classList.remove('active')); if (element) { element.classList.add('active'); moveActiveIndicator(element); } if (window.innerWidth <= 768) { navLinks.classList.remove('open'); hamburger.classList.remove('open'); } }

    function resetChat() {
        chatMessages.innerHTML = '';
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        sendBtn.classList.remove('active-animation');
        inputArea.classList.add('hidden');
        removeTypingIndicator();
        hideLoadingAnimation();
        chatLog = [];
        partnerIp = null;
        reportSent = false;
        isTyping = false;
        startBtn.disabled = false;
        disconnectBtn.disabled = true;
        reportBtn.disabled = true;
    }

    function scrollToBottom() { if (chatContent) { chatContent.scrollTop = chatContent.scrollHeight; } }
    
    // Funzione per aggiornare l'avatar visualizzato
    function updateAvatarDisplay() {
        currentUserAvatarDisplay.src = currentUserAvatar;
    }


    function addMessage(messageObject) {
        const { id, text, senderId, avatarUrl } = messageObject;
        const isYou = senderId === socket.id;
        const currentAvatar = avatarUrl; 

        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'message-wrapper ' + (isYou ? 'you' : 'other');

        wrapperDiv.innerHTML = `
            <img src="${currentAvatar}" alt="Avatar" class="chat-avatar">
            <div class="message-and-button-container">
                <div class="message-content-wrapper">
                    <div class="message ${isYou ? 'you' : 'other'}" data-id="${id}">
                        <p class="message-text">${text}</p>
                    </div>
                    <div class="reactions-display"></div>
                </div>
                <button class="add-reaction-btn" data-message-id="${id}">+</button>
            </div>
        `;
        chatMessages.append(wrapperDiv);
        scrollToBottom();
        if (!isYou) { chatLog.push(text); }
    }


    function addSystemMessage(text) {
        const sysMsgDiv = document.createElement('div');
        sysMsgDiv.className = 'system-message';
        sysMsgDiv.innerHTML = text;
        chatMessages.append(sysMsgDiv);
        scrollToBottom();
        setTimeout(() => { sysMsgDiv.classList.add('visible'); }, 10);
    }

    function addAvatarChangeMessage(newAvatarUrl) {
        const avatarMsgDiv = document.createElement('div');
        avatarMsgDiv.className = 'avatar-change-message';
        avatarMsgDiv.innerHTML = `
            <img src="${newAvatarUrl}" alt="Nuovo Avatar">
            <p>Il tuo partner ha cambiato avatar.</p>
        `;
        chatMessages.append(avatarMsgDiv);
        scrollToBottom();
        setTimeout(() => { avatarMsgDiv.classList.add('visible'); }, 10);
    }
    
    function addSelfAvatarChangeMessage(newAvatarUrl) {
        const avatarMsgDiv = document.createElement('div');
        avatarMsgDiv.className = 'self-avatar-change-message';
        avatarMsgDiv.innerHTML = `
            <img src="${newAvatarUrl}" alt="Il tuo nuovo avatar">
            <p>Hai cambiato il tuo avatar.</p>
        `;
        chatMessages.append(avatarMsgDiv);
        scrollToBottom();
        setTimeout(() => { avatarMsgDiv.classList.add('visible'); }, 10);
    }

    function sendMessage() {
        const messageText = input.value.trim();
        if (messageText !== '' && connected) {
            emitStopTyping.cancel();
            socket.emit('message', messageText);
            input.value = '';
            if (isTyping) {
                socket.emit('stop_typing');
                isTyping = false;
            }
            sendBtn.disabled = true;
            sendBtn.classList.remove('active-animation');
            if (!emojiPicker.hidden) {
                emojiPicker.hidden = true;
            }
        }
    }

    function showTypingIndicator() {
      if (document.getElementById('typing-indicator-wrapper')) return;
      const wrapperDiv = document.createElement('div');
      wrapperDiv.className = 'message-wrapper other';
      wrapperDiv.id = 'typing-indicator-wrapper';
      wrapperDiv.innerHTML = `
          <img src="${partnerAvatar}" alt="Partner Avatar" class="chat-avatar">
          <div class="message other typing-indicator">
              <div class="typing-dots">
                  <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
              </div>
          </div>
      `;
      chatMessages.append(wrapperDiv);
      scrollToBottom();
    }


    function removeTypingIndicator() { const indicator = document.getElementById('typing-indicator-wrapper'); if (indicator) { indicator.remove(); } }
    function getFlagEmoji(countryCode) { if (!countryCode || countryCode.length !== 2) { return '🌍'; } const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt()); return String.fromCodePoint(...codePoints); }
    function showLoadingAnimation() { chatMessages.innerHTML = ''; status.style.display = 'none'; const loadingHTML = `<div class="loading-container" id="loading-container"><div class="orb-canvas"><div class="orb orb-1"></div><div class="orb orb-2"></div></div><p class="loading-text">In attesa di un altro utente...</p></div>`; chatContent.insertAdjacentHTML('beforeend', loadingHTML); setTimeout(() => { const loadingContainer = document.getElementById('loading-container'); if (loadingContainer) { loadingContainer.classList.add('visible'); } }, 10); }
    function hideLoadingAnimation() { const loadingContainer = document.getElementById('loading-container'); if (loadingContainer) { loadingContainer.remove(); } status.style.display = 'block'; }
    const REACTION_EMOJIS = ['👍', '❤️', '😂', '😯', '😢', '🙏'];
    let activePalette = null;
    function createReactionPalette(messageId) { const palette = document.createElement('div'); palette.className = 'reaction-palette'; palette.dataset.messageId = messageId; REACTION_EMOJIS.forEach(emoji => { const emojiSpan = document.createElement('span'); emojiSpan.className = 'palette-emoji'; emojiSpan.textContent = emoji; palette.appendChild(emojiSpan); }); return palette; }
    chatMessages.addEventListener('click', (event) => { const target = event.target; if (target.classList.contains('palette-emoji')) { const palette = target.closest('.reaction-palette'); const messageId = palette.dataset.messageId; const emoji = target.textContent; socket.emit('add_reaction', { messageId, emoji }); if (activePalette) { activePalette.remove(); activePalette = null; } return; } if (activePalette) { activePalette.remove(); activePalette = null; } if (target.classList.contains('add-reaction-btn')) { const messageId = target.dataset.messageId; const buttonContainer = target.closest('.message-and-button-container'); activePalette = createReactionPalette(messageId); buttonContainer.appendChild(activePalette); setTimeout(() => { activePalette.classList.add('visible'); }, 10); } });

    // Logica dei pulsanti principali
    startBtn.addEventListener('click', () => { if (!connected) { socket.emit('start_chat', { avatarUrl: currentUserAvatar }); startBtn.disabled = true; disconnectBtn.disabled = false; }});
    disconnectBtn.addEventListener('click', () => { socket.emit('disconnect_chat'); status.textContent = 'Disconnesso. Premi "Inizia Chat" per connetterti'; resetChat(); connected = false; });
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !sendBtn.disabled) sendMessage(); });
    input.addEventListener('input', () => { if (!connected) return; if (input.value.trim().length > 0) { sendBtn.disabled = false; sendBtn.classList.add('active-animation'); } else { sendBtn.disabled = true; sendBtn.classList.remove('active-animation'); } if (!isTyping) { socket.emit('typing'); isTyping = true; } emitStopTyping(); });
    reportBtn.addEventListener('click', () => { if (!connected || !partnerIp) { alert("Nessun partner da segnalare."); return; } if (reportSent) { alert("Hai già segnalato questo utente. La segnalazione è in revisione."); return; } socket.emit("report_user", { partnerIp, chatLog }); alert("Segnalazione inviata. Il tuo partner è stato disconnesso."); reportSent = true; socket.emit('disconnect_chat'); status.textContent = 'Hai segnalato il partner. Premi "Inizia Chat" per connetterti'; resetChat(); connected = false; });

    // Logica di navigazione e tema
    const savedTheme = localStorage.getItem('theme'); const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches; if (savedTheme === 'light' || (!savedTheme && prefersLight)) { document.body.classList.add('light-mode'); themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>'; } else { document.body.classList.remove('light-mode'); themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>'; }
    navButtons.forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); const sectionId = btn.dataset.section; if (sectionId) { showSection(sectionId, btn); } }); });
    const activeBtn = document.querySelector('.nav-btn.active'); if (activeBtn) { showSection(activeBtn.dataset.section, activeBtn); } else { const initialSection = document.getElementById('chat-section'); if (initialSection) { initialSection.classList.add('active'); const chatBtn = document.querySelector('[data-section="chat"]'); if (chatBtn) { moveActiveIndicator(chatBtn); chatBtn.classList.add('active'); } } }
    document.querySelectorAll('.faq-header').forEach(header => { header.addEventListener('click', () => { const faqItem = header.closest('.faq-item'); faqItem.classList.toggle('active'); }); });
    themeToggleBtn.addEventListener('click', () => { document.body.classList.toggle('light-mode'); const isLightMode = document.body.classList.contains('light-mode'); themeToggleBtn.innerHTML = isLightMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; localStorage.setItem('theme', isLightMode ? 'light' : 'dark'); emojiPicker.classList.toggle('dark', !isLightMode); emojiPicker.classList.toggle('light', isLightMode); });
    hamburger.addEventListener('click', () => { navLinks.classList.toggle('open'); hamburger.classList.toggle('open'); });
    window.addEventListener('resize', () => { const activeBtn = document.querySelector('.nav-btn.active'); if (activeBtn) { moveActiveIndicator(activeBtn); } });
    const contactForm = document.getElementById('contact-form'); contactForm.addEventListener('submit', (e) => { e.preventDefault(); });
    emojiBtn.addEventListener('click', (event) => { event.stopPropagation(); emojiPicker.hidden = !emojiPicker.hidden; });
    emojiPicker.addEventListener('emoji-click', event => { input.value += event.detail.unicode; input.focus(); if (sendBtn.disabled) { sendBtn.disabled = false; sendBtn.classList.add('active-animation'); } });
    document.body.addEventListener('click', () => { if (!emojiPicker.hidden) { emojiPicker.hidden = true; } });
    const isLightModeOnLoad = document.body.classList.contains('light-mode'); emojiPicker.classList.toggle('dark', !isLightModeOnLoad); emojiPicker.classList.toggle('light', isLightModeOnLoad);

    // --- LOGICA AVATAR CONFERMATA ALLA CHIUSURA ---

    function populateAvatarGrid(category) {
        avatarGrid.innerHTML = '';
        const avatars = AVATAR_CATEGORIES[category] || [];
        avatars.forEach(avatarSrc => {
            const img = document.createElement('img');
            img.src = avatarSrc;
            img.className = 'avatar-choice';
            img.dataset.src = avatarSrc;
            if (avatarSrc === pendingAvatar) {
                img.classList.add('selected');
            }
            avatarGrid.appendChild(img);
        });
    }

    function populateCategorySelector(activeCategory) {
        avatarCategorySelector.innerHTML = '';
        Object.keys(AVATAR_CATEGORIES).forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = category;
            btn.dataset.category = category;
            if (category === activeCategory) {
                btn.classList.add('active');
            }
            avatarCategorySelector.appendChild(btn);
        });
    }

    function handleAvatarSelection(avatarSrc) {
        pendingAvatar = avatarSrc;
        const currentSelected = avatarGrid.querySelector('.selected');
        if (currentSelected) { currentSelected.classList.remove('selected'); }
        const newSelected = avatarGrid.querySelector(`[data-src="${avatarSrc}"]`);
        if (newSelected) { newSelected.classList.add('selected'); }
    }
    
    function finalizeAvatarChange() {
        if (pendingAvatar && pendingAvatar !== currentUserAvatar) {
            currentUserAvatar = pendingAvatar;
            localStorage.setItem('userAvatar', currentUserAvatar);
            
            // NUOVO: Aggiorna l'avatar nella navbar
            updateAvatarDisplay();

            if(connected) {
                addSelfAvatarChangeMessage(currentUserAvatar);
            }

            if (socket && connected) {
                socket.emit('update_avatar', { avatarUrl: currentUserAvatar });
            }
        }
        avatarModal.classList.add('hidden');
    }
    
    currentUserAvatar = localStorage.getItem('userAvatar') || AVATAR_CATEGORIES[DEFAULT_AVATAR_CATEGORY][0];

    // NUOVO: Aggiorna l'avatar all'avvio della pagina
    updateAvatarDisplay();

    settingsBtn.addEventListener('click', () => {
        pendingAvatar = currentUserAvatar; 
        
        let currentCategory = DEFAULT_AVATAR_CATEGORY;
        for (const category in AVATAR_CATEGORIES) {
            if (AVATAR_CATEGORIES[category].includes(currentUserAvatar)) {
                currentCategory = category;
                break;
            }
        }
        
        populateCategorySelector(currentCategory);
        populateAvatarGrid(currentCategory);
        avatarModal.classList.remove('hidden');
    });

    closeAvatarModalBtn.addEventListener('click', finalizeAvatarChange);
    avatarModal.addEventListener('click', (e) => { 
        if (e.target === avatarModal) {
            finalizeAvatarChange();
        } 
    });
    
    avatarGrid.addEventListener('click', (e) => { 
        if (e.target.classList.contains('avatar-choice')) { 
            handleAvatarSelection(e.target.dataset.src);
        } 
    });

    avatarCategorySelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-btn')) {
            const category = e.target.dataset.category;
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            populateAvatarGrid(category);
        }
    });

    // NUOVO: Aggiungi un event listener per aprire il modale cliccando sull'avatar
    if (currentUserAvatarDisplay) {
        currentUserAvatarDisplay.addEventListener('click', () => {
            settingsBtn.click();
        });
    }

    // --- EVENTI SOCKET.IO ---
    socket.on('online_count', (count) => { onlineCount.textContent = count; });
    socket.on('waiting', () => { showLoadingAnimation(); });

    socket.on('match', (data) => {
        hideLoadingAnimation(); status.textContent = 'Connesso! Puoi iniziare a chattare.'; status.style.display = 'block'; inputArea.classList.remove('hidden'); input.disabled = false; disconnectBtn.disabled = false; reportBtn.disabled = false; connected = true; reportSent = false; isTyping = false;
        partnerAvatar = data.partnerAvatar || AVATAR_CATEGORIES[DEFAULT_AVATAR_CATEGORY][1];
        partnerIp = data.partnerIp;
        if (data.partnerCountry && data.partnerCountry !== 'Sconosciuto') { if (data.partnerCountry === 'Localhost') { addSystemMessage(`Sei connesso con un utente in locale 💻`); } else { try { const countryName = new Intl.DisplayNames(['it'], { type: 'country' }).of(data.partnerCountry); const flag = getFlagEmoji(data.partnerCountry); addSystemMessage(`Sei connesso con un utente da: ${countryName} ${flag}`); } catch (e) { addSystemMessage(`Sei stato connesso con un altro utente 🌍`); } } } else { addSystemMessage(`Sei stato connesso con un altro utente 🌍`); }
    });

    socket.on('new_message', (messageObject) => {
        removeTypingIndicator();
        addMessage(messageObject);
    });
    
    socket.on('partner_avatar_updated', (data) => {
        const newAvatarUrl = data.avatarUrl;
        partnerAvatar = newAvatarUrl; 
        addAvatarChangeMessage(newAvatarUrl); 
    });

    socket.on('update_reactions', ({ messageId, reactions }) => { const messageElem = document.querySelector(`.message[data-id="${messageId}"]`); if (!messageElem) return; const reactionsDisplay = messageElem.parentElement.querySelector('.reactions-display'); if (!reactionsDisplay) return; reactionsDisplay.innerHTML = ''; let reactionsHTML = ''; for (const emoji in reactions) { const count = reactions[emoji]; if (count > 0) { reactionsHTML += `<span class="reaction-chip">${emoji} ${count}</span>`; } } reactionsDisplay.innerHTML = reactionsHTML; });
    socket.on('typing', () => { showTypingIndicator(); });
    socket.on('stop_typing', () => { removeTypingIndicator(); });
    socket.on('partner_disconnected', () => { status.textContent = 'Il tuo partner si è disconnesso.'; resetChat(); connected = false; });
    socket.on('connect_error', (err) => { status.textContent = 'Errore di connessione: ' + err.message; resetChat(); connected = false; });
});
