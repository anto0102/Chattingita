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
    // Gestione visualizzazione sezioni al click dei bottoni della navbar
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Previene il comportamento predefinito del link
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
