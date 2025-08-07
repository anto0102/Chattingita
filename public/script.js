// --- VARIABILI DI STATO GLOBALI ---
let connected = false;
let chatLog = [];
let partnerIp = null;
let reportSent = false;
let isTyping = false;
let socket; 

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
    function resetChat() { chatMessages.innerHTML = ''; input.value = ''; input.disabled = true; sendBtn.disabled = true; sendBtn.classList.remove('active-animation'); inputArea.classList.add('hidden'); removeTypingIndicator(); chatLog = []; partnerIp = null; reportSent = false; isTyping = false; startBtn.disabled = false; disconnectBtn.disabled = true; reportBtn.disabled = true; }
    function scrollToBottom() { if (chatContent) { chatContent.scrollTop = chatContent.scrollHeight; } }

    function addMessage(messageObject) {
        const { id, text, senderId } = messageObject;
        const isYou = senderId === socket.id;
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'message-wrapper ' + (isYou ? 'you' : 'other');
        wrapperDiv.innerHTML = `<div class="message ${isYou ? 'you' : 'other'}" data-id="${id}"><div class="message-content"><p class="message-text">${text}</p></div><div class="reactions-display"></div></div><button class="add-reaction-btn" data-message-id="${id}">+</button>`;
        chatMessages.append(wrapperDiv);
        scrollToBottom();
        if (!isYou) { chatLog.push(text); }
    }

    // MODIFICA: La funzione ora attiva l'animazione CSS
    function addSystemMessage(text) {
        const sysMsgDiv = document.createElement('div');
        sysMsgDiv.className = 'system-message';
        sysMsgDiv.innerHTML = text;
        chatMessages.append(sysMsgDiv);
        scrollToBottom();

        // Aggiunge la classe 'visible' dopo un istante per attivare la transizione CSS
        setTimeout(() => {
            sysMsgDiv.classList.add('visible');
        }, 10);
    }

    function sendMessage() { const messageText = input.value.trim(); if (messageText !== '' && connected) { emitStopTyping.cancel(); socket.emit('message', messageText); input.value = ''; if (isTyping) { socket.emit('stop_typing'); isTyping = false; } sendBtn.disabled = true; sendBtn.classList.remove('active-animation'); if (!emojiPicker.hidden) { emojiPicker.hidden = true; } } }
    function showTypingIndicator() { if (typingIndicatorContainer.innerHTML === '') { typingIndicatorContainer.innerHTML = `<div class="typing-indicator"><span>Il partner sta scrivendo</span><div class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`; scrollToBottom(); } }
    function removeTypingIndicator() { typingIndicatorContainer.innerHTML = ''; }

    function getFlagEmoji(countryCode) {
        if (!countryCode || countryCode.length !== 2) { return '🌍'; }
        const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
        return String.fromCodePoint(...codePoints);
    }

    // --- LOGICA PER LE REAZIONI ---
    const REACTION_EMOJIS = ['👍', '❤️', '😂', '😯', '😢', '🙏'];
    let activePalette = null;
    function createReactionPalette(messageId) { const palette = document.createElement('div'); palette.className = 'reaction-palette'; palette.dataset.messageId = messageId; REACTION_EMOJIS.forEach(emoji => { const emojiSpan = document.createElement('span'); emojiSpan.className = 'palette-emoji'; emojiSpan.textContent = emoji; palette.appendChild(emojiSpan); }); return palette; }
    chatMessages.addEventListener('click', (event) => { const target = event.target; if (target.classList.contains('palette-emoji')) { const palette = target.closest('.reaction-palette'); const messageId = palette.dataset.messageId; const emoji = target.textContent; socket.emit('add_reaction', { messageId, emoji }); if (activePalette) { activePalette.remove(); activePalette = null; } return; } if (activePalette) { activePalette.remove(); activePalette = null; } if (target.classList.contains('add-reaction-btn')) { const messageId = target.dataset.messageId; const messageWrapper = target.closest('.message-wrapper'); activePalette = createReactionPalette(messageId); messageWrapper.appendChild(activePalette); setTimeout(() => { activePalette.classList.add('visible'); }, 10); } });

    // --- EVENT LISTENERS GENERALI ---
    startBtn.addEventListener('click', () => { if (!connected) { socket.emit('start_chat'); status.textContent = 'In attesa di un altro utente...'; startBtn.disabled = true; disconnectBtn.disabled = false; } });
    disconnectBtn.addEventListener('click', () => { socket.emit('disconnect_chat'); status.textContent = 'Disconnesso. Premi "Inizia Chat" per connetterti'; resetChat(); connected = false; });
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !sendBtn.disabled) sendMessage(); });
    input.addEventListener('input', () => { if (!connected) return; if (input.value.trim().length > 0) { sendBtn.disabled = false; sendBtn.classList.add('active-animation'); } else { sendBtn.disabled = true; sendBtn.classList.remove('active-animation'); } if (!isTyping) { socket.emit('typing'); isTyping = true; } emitStopTyping(); });
    reportBtn.addEventListener('click', () => { if (!connected || !partnerIp) { alert("Nessun partner da segnalare."); return; } if (reportSent) { alert("Hai già segnalato questo utente. La segnalazione è in revisione."); return; } socket.emit("report_user", { partnerIp, chatLog }); alert("Segnalazione inviata. Il tuo partner è stato disconnesso."); reportSent = true; socket.emit('disconnect_chat'); status.textContent = 'Hai segnalato il partner. Premi "Inizia Chat" per connetterti'; resetChat(); connected = false; });
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

    // --- EVENTI SOCKET.IO ---
    socket.on('online_count', (count) => { onlineCount.textContent = count; });
    socket.on('waiting', () => { status.textContent = 'In attesa di un altro utente...'; });
    socket.on('match', (data) => {
        status.textContent = 'Connesso! Puoi iniziare a chattare.';
        inputArea.classList.remove('hidden');
        input.disabled = false;
        disconnectBtn.disabled = false;
        reportBtn.disabled = false;
        connected = true;
        reportSent = false;
        isTyping = false;
        if (data && data.partnerIp) { partnerIp = data.partnerIp; }
        if (data && data.partnerCountry && data.partnerCountry !== 'Sconosciuto') {
            if (data.partnerCountry === 'Localhost') {
                addSystemMessage(`Sei connesso con un utente in locale 💻`);
            } else {
                try {
                    const countryName = new Intl.DisplayNames(['it'], { type: 'country' }).of(data.partnerCountry);
                    const flag = getFlagEmoji(data.partnerCountry);
                    addSystemMessage(`Sei connesso con un utente da: ${countryName} ${flag}`);
                } catch (e) { addSystemMessage(`Sei connesso con un altro utente 🌍`); }
            }
        } else { addSystemMessage(`Sei stato connesso con un altro utente 🌍`); }
    });
    socket.on('new_message', (messageObject) => { removeTypingIndicator(); addMessage(messageObject); });
    socket.on('update_reactions', ({ messageId, reactions }) => { const messageWrapper = document.querySelector(`.message-wrapper .message[data-id="${messageId}"]`); if (!messageWrapper) return; const reactionsDisplay = messageWrapper.querySelector('.reactions-display'); if (!reactionsDisplay) return; reactionsDisplay.innerHTML = ''; let reactionsHTML = ''; for (const emoji in reactions) { const count = reactions[emoji]; if (count > 0) { reactionsHTML += `<span class="reaction-chip">${emoji} ${count}</span>`; } } reactionsDisplay.innerHTML = reactionsHTML; });
    socket.on('typing', () => { showTypingIndicator(); });
    socket.on('stop_typing', () => { removeTypingIndicator(); });
    socket.on('partner_disconnected', () => { status.textContent = 'Il tuo partner si è disconnesso.'; resetChat(); connected = false; });
    socket.on('connect_error', (err) => { status.textContent = 'Errore di connessione: ' + err.message; resetChat(); connected = false; });
});
