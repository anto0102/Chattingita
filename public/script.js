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
const typingIndicator = document.getElementById('typing-indicator');

// Stato della chat
let connected = false;
let chatLog = [];
let partnerIp = null;
let reportSent = false;
let isTyping = false;
let typingTimeout = null;
const typingDelay = 1000; // Tempo di attesa per l'invio del segnale di stop_typing

// --- FUNZIONI UTILITY ---
function moveActiveIndicator(element) {
    if (element && window.innerWidth > 768) {
        activeIndicator.style.width = `${element.offsetWidth}px`;
        activeIndicator.style.transform = `translateX(${element.offsetLeft}px)`;
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
    hideTypingIndicator();
    chatLog = [];
    partnerIp = null;
    reportSent = false;
    isTyping = false;
}

function addMessage(text, isYou = false) {
    const msgContainer = document.createElement('div');
    msgContainer.className = `message-container ${isYou ? 'you' : 'other'}`;
    msgContainer.innerHTML = `<div class="message">${text}</div>`;
    chatMessages.appendChild(msgContainer);
    
    // Aggiungi reazioni al messaggio
    const reactionPopover = document.createElement('div');
    reactionPopover.className = 'reaction-popover';
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
    reactionPopover.innerHTML = emojis.map(emoji => `<span class="reaction-emoji" data-emoji="${emoji}">${emoji}</span>`).join('');
    msgContainer.appendChild(reactionPopover);

    const reactionDisplay = document.createElement('div');
    reactionDisplay.className = 'reactions-display';
    msgContainer.appendChild(reactionDisplay);

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
        clearTimeout(typingTimeout);
    }
}

function showTypingIndicator() {
    typingIndicator.classList.remove('hidden');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.classList.add('hidden');
}

// --- EVENT LISTENERS ---
startBtn.addEventListener('click', () => {
    if (!connected) {
        socket.emit('start_chat');
        status.textContent = 'In attesa di un altro utente...';
        startBtn.disabled = true;
        disconnectBtn.disabled = false;
        reportBtn.disabled = true;
    }
});

disconnectBtn.addEventListener('click', () => {
    if (connected) {
        socket.emit('disconnect_chat');
        status.textContent = 'Disconnesso. Premi "Inizia Chat" per connetterti';
    } else {
        socket.emit('cancel_waiting');
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

    if (!isTyping) {
        socket.emit('typing');
        isTyping = true;
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop_typing');
        isTyping = false;
    }, typingDelay);
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

    const activeBtn = document.querySelector('.nav-btn.active');
    if (activeBtn) {
        showSection(activeBtn.dataset.section, activeBtn);
    } else {
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

    // Gestione tema
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLightMode = document.body.classList.contains('light-mode');
        themeToggleBtn.innerHTML = isLightMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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

    // --- LOGICA REAZIONI MESSAGGI ---
    let longPressTimer;
    const longPressDuration = 500; // Millisecondi

    chatMessages.addEventListener('mouseenter', (e) => {
        const messageContainer = e.target.closest('.message-container');
        if (messageContainer) {
            const reactionPopover = messageContainer.querySelector('.reaction-popover');
            if (reactionPopover) {
                reactionPopover.classList.add('visible');
            }
        }
    }, true);

    chatMessages.addEventListener('mouseleave', (e) => {
        const messageContainer = e.target.closest('.message-container');
        if (messageContainer) {
            const reactionPopover = messageContainer.querySelector('.reaction-popover');
            if (reactionPopover) {
                reactionPopover.classList.remove('visible');
            }
        }
    }, true);

    chatMessages.addEventListener('mousedown', (e) => {
        const message = e.target.closest('.message');
        if (!message) return;
        longPressTimer = setTimeout(() => {
            const reactionPopover = message.closest('.message-container').querySelector('.reaction-popover');
            reactionPopover.classList.add('visible');
        }, longPressDuration);
    });

    chatMessages.addEventListener('mouseup', (e) => {
        clearTimeout(longPressTimer);
    });

    chatMessages.addEventListener('click', (e) => {
        const emojiBtn = e.target.closest('.reaction-emoji');
        if (emojiBtn) {
            const emoji = emojiBtn.dataset.emoji;
            const messageIndex = Array.from(emojiBtn.closest('#chat-messages').children).indexOf(emojiBtn.closest('.message-container'));
            
            // Invia la reazione tramite socket
            socket.emit('react_message', { messageIndex, emoji });

            // Nascondi il popover
            emojiBtn.closest('.reaction-popover').classList.remove('visible');
            e.stopPropagation();
        }
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
    hideTypingIndicator();
    addMessage(msg, false);
});

socket.on('typing', () => {
    showTypingIndicator();
});

socket.on('stop_typing', () => {
    hideTypingIndicator();
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

socket.on('reaction_received', ({ messageIndex, emoji }) => {
    const messageContainers = chatMessages.querySelectorAll('.message-container');
    if (messageContainers[messageIndex]) {
        const reactionsDisplay = messageContainers[messageIndex].querySelector('.reactions-display');
        reactionsDisplay.innerHTML = `<span class="reaction-emoji">${emoji}</span><span class="reaction-emoji-count">1</span>`;
        reactionsDisplay.classList.add('active');
    }
});
