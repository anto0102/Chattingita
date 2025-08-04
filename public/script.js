const socket = io("https://chattingapp-backend.onrender.com");

// Elementi principali
const navLinks = document.getElementById('nav-links');
const hamburger = document.getElementById('hamburger');
const themeToggleBtn = document.getElementById('themeToggle');
const activeIndicator = document.querySelector('.active-indicator');
const navButtons = document.querySelectorAll('.nav-btn');

// Elementi della chat
const status = document.getElementById('status');
const chatMessages = document.getElementById('chat-messages');
const input = document.getElementById('input');
const inputArea = document.getElementById('input-area');
const startBtn = document.getElementById('startBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const sendBtn = document.getElementById('sendBtn');
const onlineCount = document.getElementById('onlineCount');
const reportBtn = document.getElementById('reportBtn');

// Stato della chat
let connected = false;
let typingIndicator = null;
let chatLog = [];
let partnerIp = null;
let reportSent = false;
let isTyping = false;

// --- FUNZIONI UTILITY ---
function moveActiveIndicator(element) {
    if (element && window.innerWidth > 768) {
        const navBar = document.querySelector('.nav-links');
        activeIndicator.style.width = `${element.offsetWidth}px`;
        activeIndicator.style.transform = `translateX(${element.offsetLeft - navBar.offsetLeft}px)`;
        activeIndicator.style.opacity = 1;
    } else {
        activeIndicator.style.opacity = 0;
    }
}

function showSection(sectionId, element) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    const activeSection = document.getElementById(sectionId + '-section');
    if (activeSection) {
        activeSection.classList.add('active');
    }
    
    navButtons.forEach(btn => btn.classList.remove('active'));
    if (element) {
        element.classList.add('active');
        moveActiveIndicator(element);
    }
    
    if (window.innerWidth <= 768) {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
    }
}

function resetChat() {
    chatMessages.innerHTML = '';
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    inputArea.classList.add('hidden');
    removeTypingIndicator();
    chatLog = [];
    partnerIp = null;
    reportSent = false;
    isTyping = false;
}

function addMessage(text, isYou = false) {
    const msg = document.createElement('div');
    msg.className = 'message ' + (isYou ? 'you' : 'other');
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!isYou) {
        chatLog.push(text);
    }
}

function sendMessage() {
    const message = input.value.trim();
    if (message !== '' && connected) {
        socket.emit('message', message);
        addMessage(message, true);
        input.value = '';
        socket.emit('stop_typing');
        isTyping = false;
    }
}

function showTypingIndicator() {
    if (!typingIndicator) {
        typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `
            <span>Il partner sta scrivendo</span>
            <div class="typing-dots">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function removeTypingIndicator() {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }
}

// --- EVENT LISTENERS ---
startBtn.addEventListener('click', () => {
    if (!connected) {
        socket.emit('start_chat');
        status.textContent = 'In attesa di un altro utente...';
        startBtn.disabled = true;
        disconnectBtn.disabled = false;
    }
});

disconnectBtn.addEventListener('click', () => {
    if (connected) {
        socket.emit('disconnect_chat');
        status.textContent = 'Disconnesso. Premi "Inizia Chat" per connetterti';
    } else {
        socket.emit('cancel_waiting'); // Aggiunto per annullare l'attesa
        status.textContent = 'Disconnesso. Premi "Inizia Chat" per connetterti';
        resetChat();
        connected = false;
        startBtn.disabled = false;
        disconnectBtn.disabled = true;
        reportBtn.disabled = true;
    }
});

sendBtn.addEventListener('click', sendMessage);

input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

input.addEventListener('input', () => {
    if (!connected) return;
    if (input.value.trim().length > 0 && !isTyping) {
        socket.emit('typing');
        isTyping = true;
    } else if (input.value.trim().length === 0 && isTyping) {
        socket.emit('stop_typing');
        isTyping = false;
    }
});

reportBtn.addEventListener('click', () => {
    if (!connected || !partnerIp) {
        alert("Nessun partner da segnalare.");
        return;
    }
    if (reportSent) {
        alert("Hai già segnalato questo utente. La segnalazione è in revisione.");
        return;
    }

    socket.emit("report_user", { partnerIp, chatLog });
    alert("Segnalazione inviata. Grazie per il tuo contributo.");
    reportSent = true;
});

document.addEventListener('DOMContentLoaded', () => {
    // --- Gestione e persistenza del tema (MODIFICATO) ---
    // Carica il tema salvato o usa quello di sistema come predefinito
    const savedTheme = localStorage.getItem('theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

    if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
        document.body.classList.add('light-mode');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('light-mode');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
    
    // Gestione visualizzazione sezioni al click dei bottoni della navbar
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = btn.dataset.section;
            if (sectionId) {
                showSection(sectionId, btn);
            }
        });
    });

    // Spostamento indicatore all'avvio
    const activeBtn = document.querySelector('.nav-btn.active');
    if (activeBtn) {
        showSection(activeBtn.dataset.section, activeBtn);
    } else {
        // Fallback per la sezione iniziale se non ne viene trovata nessuna attiva
        const initialSection = document.getElementById('chat-section');
        if (initialSection) {
            initialSection.classList.add('active');
            const chatBtn = document.querySelector('[data-section="chat"]');
            if (chatBtn) {
                 moveActiveIndicator(chatBtn);
                 chatBtn.classList.add('active');
            }
        }
    }


    // Gestione FAQ
    document.querySelectorAll('.faq-header').forEach(header => {
        header.addEventListener('click', () => {
            const faqItem = header.closest('.faq-item');
            faqItem.classList.toggle('active');
        });
    });

    // Gestione tema (MODIFICATO)
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLightMode = document.body.classList.contains('light-mode');
        themeToggleBtn.innerHTML = isLightMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        // Salva lo stato nel localStorage
        localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
    });

    // Gestione hamburger menu
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        hamburger.classList.toggle('open');
    });

    // Gestione ridimensionamento finestra per navbar
    window.addEventListener('resize', () => {
        const activeBtn = document.querySelector('.nav-btn.active');
        if (activeBtn) {
            moveActiveIndicator(activeBtn);
        }
    });

    // Gestione form contatti
    const contactForm = document.getElementById('contact-form');
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const statusMessage = document.getElementById('contact-status');
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());

        console.log("Dati del form inviati:", data);
        statusMessage.textContent = "Messaggio inviato con successo!";
        statusMessage.style.color = 'var(--success-color)';
        contactForm.reset();
        
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 5000);
    });
});

// --- EVENTI SOCKET.IO ---
socket.on('online_count', (count) => {
    onlineCount.textContent = count;
});

socket.on('waiting', () => {
    status.textContent = 'In attesa di un altro utente...';
});

socket.on('match', (data) => {
    status.textContent = 'Connesso! Puoi iniziare a chattare.';
    inputArea.classList.remove('hidden');
    input.disabled = false;
    sendBtn.disabled = false;
    disconnectBtn.disabled = false;
    reportBtn.disabled = false;
    connected = true;
    reportSent = false;
    isTyping = false;

    if (data && data.partnerIp) {
        partnerIp = data.partnerIp;
    }
});

socket.on('message', (msg) => {
    removeTypingIndicator();
    addMessage(msg, false);
});

socket.on('typing', () => {
    showTypingIndicator();
});

socket.on('stop_typing', () => {
    removeTypingIndicator();
});

socket.on('partner_disconnected', () => {
    status.textContent = 'Il tuo partner si è disconnesso.';
    resetChat();
    connected = false;
    startBtn.disabled = false;
    disconnectBtn.disabled = true;
    reportBtn.disabled = true;
});

socket.on('connect_error', (err) => {
    status.textContent = 'Errore di connessione: ' + err.message;
    resetChat();
    connected = false;
    startBtn.disabled = false;
    disconnectBtn.disabled = true;
    reportBtn.disabled = true;
});

// Aggiungi un nuovo array per salvare le reazioni in memoria (facoltativo, ma utile per la UI)
// let reactions = {}; // Oltre a chatLog, non lo usi per ora, ma tienilo a mente

// Modifica la funzione addMessage per aggiungere un ID univoco e un listener
function addMessage(text, isYou = false) {
    const msg = document.createElement('div');
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // ID unico
    msg.id = messageId;
    msg.className = 'message ' + (isYou ? 'you' : 'other');
    msg.textContent = text;
    
    // Aggiungi un contenitore per le reazioni
    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'reactions-container';
    msg.appendChild(reactionsContainer);

    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!isYou) {
        chatLog.push(text);
    }

    // Aggiungi il listener per mostrare le reazioni al passaggio del mouse
    msg.addEventListener('mouseenter', () => {
        showReactionPicker(msg, messageId);
    });
    msg.addEventListener('mouseleave', () => {
        hideReactionPicker(msg);
    });

    // Per mobile: mostra le reazioni con un tap lungo
    msg.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Impedisce il comportamento predefinito
        showReactionPicker(msg, messageId);
    });
}

function showReactionPicker(messageElement, messageId) {
    // Rimuovi eventuali picker già aperti per evitare sovrapposizioni
    document.querySelectorAll('.reaction-picker').forEach(picker => picker.remove());

    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥']; // Scegli le tue emoji

    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.className = 'reaction-emoji';
        span.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita che il click sul picker nasconda il picker stesso
            if (connected) {
                // Invia la reazione al server, includendo l'ID del messaggio
                socket.emit('react', { messageId: messageId, emoji: emoji });
            }
            picker.remove(); // Nascondi il picker dopo il click
        });
        picker.appendChild(span);
    });

    // Posiziona il picker
    picker.style.top = `${messageElement.offsetTop}px`;
    picker.style.left = `${messageElement.offsetLeft + messageElement.offsetWidth / 2 - picker.offsetWidth / 2}px`;

    chatMessages.appendChild(picker);
}

function hideReactionPicker(messageElement) {
    const picker = messageElement.querySelector('.reaction-picker');
    if (picker) {
        // Puoi aggiungere una logica per nascondere il picker dopo un po'
        // o al mouseleave
    }
}

function updateReactions(messageId, emoji) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;

    let reactionsContainer = messageElement.querySelector('.reactions-container');
    if (!reactionsContainer) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'reactions-container';
        messageElement.appendChild(reactionsContainer);
    }
    
    // Controlla se l'emoji esiste già
    let emojiSpan = reactionsContainer.querySelector(`[data-emoji="${emoji}"]`);
    if (!emojiSpan) {
        emojiSpan = document.createElement('span');
        emojiSpan.className = 'reaction-emoji-count';
        emojiSpan.dataset.emoji = emoji;
        emojiSpan.textContent = `${emoji} 1`;
        reactionsContainer.appendChild(emojiSpan);
    } else {
        let count = parseInt(emojiSpan.textContent.split(' ')[1]) + 1;
        emojiSpan.textContent = `${emoji} ${count}`;
    }
}

// Aggiungi un nuovo evento socket.on per ricevere le reazioni
socket.on('reaction', ({ messageId, emoji }) => {
    updateReactions(messageId, emoji);
});
