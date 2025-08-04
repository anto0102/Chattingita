document.addEventListener('DOMContentLoaded', () => {

    // Selettori degli elementi del DOM
    const chatArea = document.getElementById('chat-area');
    const chatMessages = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const onlineCounter = document.getElementById('online-counter');
    const typingIndicator = document.getElementById('typing-indicator');
    const themeToggle = document.getElementById('theme-toggle');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    const navButtons = document.querySelectorAll('.nav-btn');
    const contentSections = document.querySelectorAll('.content-section');
    const faqItems = document.querySelectorAll('.faq-item');

    // Dichiarazione delle variabili di stato
    let connected = false;
    let isTyping = false;
    let typingTimeout;
    const TYPING_TIMEOUT = 1000; // 1 secondo

    // ------------------------------------------
    // 1. CONNESSIONE SOCKET.IO
    // ------------------------------------------

    // Inizializza la connessione a Socket.IO.
    // L'URL 'https://chattingapp-backend.onrender.com' deve puntare al tuo server.
    const socket = io('https://chattingapp-backend.onrender.com', {
        transports: ['websocket', 'polling', 'flashsocket']
    });

    // ------------------------------------------
    // 2. FUNZIONI UTILITY
    // ------------------------------------------

    /**
     * Aggiunge un nuovo messaggio all'area della chat.
     * @param {string} text Il testo del messaggio.
     * @param {boolean} isYou Indica se il messaggio è stato inviato dall'utente corrente.
     */
    function addMessage(text, isYou = false) {
        // Rimuove lo stato "in attesa di un messaggio"
        const statusMsg = document.getElementById('status-message');
        if (statusMsg) {
            statusMsg.remove();
        }

        const msgContainer = document.createElement('div');
        msgContainer.className = `message-container ${isYou ? 'you' : 'other'}`;
    
        // Crea l'elemento del messaggio
        const msg = document.createElement('div');
        msg.className = 'message';
        msg.textContent = text;
        msgContainer.appendChild(msg);
    
        // Aggiungi le reazioni al messaggio
        const reactionPopover = document.createElement('div');
        reactionPopover.className = 'reaction-popover';
        const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
        reactionPopover.innerHTML = emojis.map(emoji => `<span class="reaction-emoji" data-emoji="${emoji}">${emoji}</span>`).join('');
        msgContainer.appendChild(reactionPopover);

        // Aggiungi il display delle reazioni
        const reactionDisplay = document.createElement('div');
        reactionDisplay.className = 'reactions-display';
        msgContainer.appendChild(reactionDisplay);
    
        chatMessages.appendChild(msgContainer);
        
        // Scorri automaticamente in basso
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Mostra l'indicatore di digitazione.
     */
    function showTypingIndicator() {
        if (typingIndicator.classList.contains('hidden')) {
            typingIndicator.classList.remove('hidden');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    /**
     * Nasconde l'indicatore di digitazione.
     */
    function hideTypingIndicator() {
        if (!typingIndicator.classList.contains('hidden')) {
            typingIndicator.classList.add('hidden');
        }
    }

    // ------------------------------------------
    // 3. GESTIONE EVENTI SOCKET.IO
    // ------------------------------------------

    // Evento di connessione avvenuta con successo
    socket.on('connect', () => {
        console.log('Connesso al server Socket.IO');
        connected = true;
    });

    // Evento di disconnessione
    socket.on('disconnect', () => {
        console.log('Disconnesso dal server');
        connected = false;
    });

    // Aggiorna il contatore degli utenti online
    socket.on('online_users', (count) => {
        onlineCounter.textContent = `${count} utente${count !== 1 ? 'i' : ''} online`;
    });

    // Ricezione di un nuovo messaggio
    socket.on('message', (message) => {
        hideTypingIndicator();
        addMessage(message, false);
    });

    // Un utente ha iniziato a digitare
    socket.on('user_typing', () => {
        showTypingIndicator();
    });

    // Un utente ha smesso di digitare
    socket.on('user_stopped_typing', () => {
        hideTypingIndicator();
    });
    
    // Aggiorna le reazioni di un messaggio specifico
    socket.on('reaction_update', (data) => {
        const messages = chatMessages.querySelectorAll('.message-container');
        if (messages.length > data.index) {
            const msgContainer = messages[data.index];
            const reactionDisplay = msgContainer.querySelector('.reactions-display');
            const emojiText = Object.keys(data.reactions).map(emoji => {
                const count = data.reactions[emoji];
                return `${emoji} ${count > 1 ? count : ''}`;
            }).join(' ');

            if (emojiText) {
                reactionDisplay.innerHTML = emojiText;
                reactionDisplay.classList.add('active');
            } else {
                reactionDisplay.classList.remove('active');
            }
        }
    });

    // ------------------------------------------
    // 4. GESTIONE INTERAZIONE UI
    // ------------------------------------------

    /**
     * Invia un messaggio tramite il socket.
     */
    function sendMessage() {
        const message = input.value.trim();
        if (message !== '' && connected) {
            // Emette l'evento 'message' al server
            socket.emit('message', message);
            // Aggiunge il messaggio localmente
            addMessage(message, true);
            input.value = '';
            // Emette l'evento per smettere di digitare
            socket.emit('stop_typing');
            isTyping = false;
            clearTimeout(typingTimeout);
        }
    }

    // Evento click sul pulsante di invio
    sendBtn.addEventListener('click', sendMessage);

    // Evento tasto "Invio" nel campo di testo
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Evento di digitazione per mostrare l'indicatore
    input.addEventListener('input', () => {
        if (!isTyping) {
            isTyping = true;
            socket.emit('start_typing');
        }
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            isTyping = false;
            socket.emit('stop_typing');
        }, TYPING_TIMEOUT);
    });

    // ------------------------------------------
    // 5. GESTIONE NAVBAR, TEMA E ACCORDION
    // ------------------------------------------

    // Gestione della navigazione tra le sezioni
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetSectionId = button.getAttribute('data-target');
            
            // Aggiorna lo stato "active" della navbar
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Nasconde tutte le sezioni
            contentSections.forEach(section => section.classList.remove('active'));
            
            // Mostra la sezione target
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // Nasconde la navbar mobile se è aperta
            if (navLinks.classList.contains('open')) {
                navLinks.classList.remove('open');
                hamburger.classList.remove('open');
            }

            // Aggiorna l'indicatore di selezione
            updateActiveIndicator();
        });
    });

    // Funzione per aggiornare la posizione e la larghezza dell'indicatore di selezione
    function updateActiveIndicator() {
        const activeBtn = document.querySelector('.nav-btn.active');
        const indicator = document.querySelector('.active-indicator');
        if (activeBtn && indicator) {
            indicator.style.width = `${activeBtn.offsetWidth}px`;
            indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
        }
    }
    window.addEventListener('resize', updateActiveIndicator);
    updateActiveIndicator(); // Chiama all'avvio per posizionare l'indicatore

    // Gestione del menu hamburger per mobile
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        hamburger.classList.toggle('open');
    });

    // Gestione del tema chiaro/scuro
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLightMode = document.body.classList.contains('light-mode');
        themeToggle.innerHTML = isLightMode ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    });

    // Gestione dell'accordion per le FAQ
    faqItems.forEach(item => {
        const header = item.querySelector('.faq-header');
        header.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            // Chiudi tutti gli altri item
            faqItems.forEach(faq => faq.classList.remove('active'));
            // Apri o chiudi l'item cliccato
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // ------------------------------------------
    // 6. GESTIONE REAZIONI
    // ------------------------------------------

    chatMessages.addEventListener('mouseenter', (e) => {
        const target = e.target.closest('.message-container');
        if (target) {
            const reactionPopover = target.querySelector('.reaction-popover');
            if (reactionPopover) {
                reactionPopover.classList.add('visible');
            }
        }
    }, true);

    chatMessages.addEventListener('mouseleave', (e) => {
        const target = e.target.closest('.message-container');
        if (target) {
            const reactionPopover = target.querySelector('.reaction-popover');
            if (reactionPopover) {
                reactionPopover.classList.remove('visible');
            }
        }
    }, true);

    chatMessages.addEventListener('click', (e) => {
        const emojiButton = e.target.closest('.reaction-emoji');
        if (emojiButton) {
            const emoji = emojiButton.dataset.emoji;
            const msgContainer = emojiButton.closest('.message-container');
            const messageIndex = Array.from(chatMessages.querySelectorAll('.message-container')).indexOf(msgContainer);

            if (messageIndex !== -1) {
                socket.emit('reaction', {
                    index: messageIndex,
                    emoji: emoji
                });
            }
        }
    });

    // Sostituisci il contatore degli utenti se la chat è vuota
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0 && chatMessages.children.length > 0) {
                const statusMsg = document.getElementById('status-message');
                if (statusMsg) statusMsg.remove();
            }
        });
    });
    observer.observe(chatMessages, { childList: true });

});
