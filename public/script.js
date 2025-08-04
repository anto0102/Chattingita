document.addEventListener('DOMContentLoaded', () => {

    // =========================================
    // 1. SELETTORI DEGLI ELEMENTI DEL DOM
    // =========================================
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const navButtons = document.querySelectorAll('.nav-btn');
    const contentSections = document.querySelectorAll('.content-section');
    const themeToggle = document.getElementById('theme-toggle');

    // =========================================
    // 2. LOGICA DI CONNESSIONE E CHAT (Socket.IO)
    // =========================================
    const socket = io();

    socket.on('disconnect', () => {
        addStatusMessage("Sei stato disconnesso.");
    });
    
    socket.on('chat message', (msg) => {
        addMessage(msg, false);
    });

    // =========================================
    // 3. FUNZIONI UTILITY
    // =========================================
    function addMessage(text, isYou = false) {
        // Rimuovi il messaggio di stato quando arriva il primo messaggio
        const statusMsg = document.getElementById('status-message');
        if (statusMsg) {
            statusMsg.remove();
        }

        const msgContainer = document.createElement('div');
        msgContainer.className = `message-container ${isYou ? 'you' : 'other'}`;
    
        const msg = document.createElement('div');
        msg.className = 'message';
        msg.textContent = text;
        msgContainer.appendChild(msg);
        
        chatMessages.prepend(msgContainer); // Messaggi in alto, per via del flex-direction: column-reverse;
    }

    function addStatusMessage(text) {
        const statusMsg = document.createElement('div');
        statusMsg.id = 'status-message';
        statusMsg.className = 'status-message';
        statusMsg.textContent = text;
        chatMessages.appendChild(statusMsg);
    }

    function sendMessage() {
        const message = chatInput.value.trim();
        if (message !== '') {
            socket.emit('chat message', message);
            addMessage(message, true);
            chatInput.value = '';
        }
    }

    // =========================================
    // 4. GESTIONE INTERAZIONE UI
    // =========================================
    
    // Gestione invio messaggio
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Gestione della navigazione tra le sezioni
    if (navButtons.length > 0 && contentSections.length > 0) {
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                contentSections.forEach(section => section.classList.remove('active'));
                
                const targetSectionId = button.getAttribute('data-section');
                const targetSection = document.getElementById(targetSectionId);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
            });
        });
    }

    // Gestione del tema chiaro/scuro
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLightMode = document.body.classList.contains('light-mode');
            themeToggle.innerHTML = isLightMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    }
});
