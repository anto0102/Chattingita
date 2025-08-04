document.addEventListener('DOMContentLoaded', () => {

    // =========================================
    // 1. SELETTORI DEGLI ELEMENTI DEL DOM
    // =========================================
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

    // =========================================
    // 2. VARIABILI DI STATO E IMPOSTAZIONI
    // =========================================
    let connected = false;
    let isTyping = false;
    let typingTimeout;
    const TYPING_TIMEOUT = 1000; // 1 secondo
    const socket = io('https://chattingapp-backend.onrender.com', {
        transports: ['websocket', 'polling', 'flashsocket']
    });

    // =========================================
    // 3. FUNZIONI UTILITY
    // =========================================

    /**
     * Aggiunge un nuovo messaggio all'area della chat.
     * @param {string} text Il testo del messaggio.
     * @param {boolean} isYou Indica se il messaggio è stato inviato dall'utente corrente.
     */
    function addMessage(text, isYou = false) {
        // Rimuove lo stato "in attesa di un messaggio" se presente
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
    
        // Elementi per le reazioni
        const reactionPopover = document.createElement('div');
        reactionPopover.className = 'reaction-popover';
        const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
        reactionPopover.innerHTML = emojis.map(emoji => `<span class="reaction-emoji" data-emoji="${emoji}">${emoji}</span>`).join('');
        msgContainer.appendChild(reactionPopover);

        const reactionDisplay = document.createElement('div');
        reactionDisplay.className = 'reactions-display';
        msgContainer.appendChild(reactionDisplay);
    
        chatMessages.appendChild(msgContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /** Mostra l'indicatore di digitazione. */
    function showTypingIndicator() {
        if (typingIndicator && typingIndicator.classList.contains('hidden')) {
            typingIndicator.classList.remove('hidden');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    /** Nasconde l'indicatore di digitazione. */
    function hideTypingIndicator() {
        if (typingIndicator && !typingIndicator.classList.contains('hidden')) {
            typingIndicator.classList.add('hidden');
        }
    }

    /** Aggiorna la posizione e la larghezza dell'indicatore di selezione nella navbar. */
    function updateActiveIndicator() {
        const activeBtn = document.querySelector('.nav-btn.active');
        const indicator = document.querySelector('.active-indicator');
        if (activeBtn && indicator) {
            indicator.style.width = `${activeBtn.offsetWidth}px`;
            indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
        }
    }

    // =========================================
    // 4. GESTIONE EVENTI SOCKET.IO
    // =========================================

    socket.on('connect', () => {
        console.log('Connesso al server Socket.IO');
        connected = true;
    });

    socket.on('disconnect', () => {
        console.log('Disconnesso dal server');
        connected = false;
    });

    socket.on('online_users', (count) => {
        if (onlineCounter) {
            onlineCounter.textContent = `${count} utente${count !== 1 ? 'i' : ''} online`;
        }
    });

    socket.on('message', (message) => {
        hideTypingIndicator();
        addMessage(message, false);
    });

    socket.on('user_typing', () => {
        showTypingIndicator();
    });

    socket.on('user_stopped_typing', () => {
        hideTypingIndicator();
    });
    
    socket.on('reaction_update', (data) => {
        const messages = chatMessages.querySelectorAll('.message-container');
        if (messages.length > data.index) {
            const msgContainer = messages[data.index];
            const reactionDisplay = msgContainer.querySelector('.reactions-display');
            const emojiText = Object.keys(data.reactions).map(emoji => {
                const count = data.reactions[emoji];
                return `${emoji} ${count > 1 ? count : ''}`;
            }).join(' ');

            if (reactionDisplay) {
                 if (emojiText) {
                    reactionDisplay.innerHTML = emojiText;
                    reactionDisplay.classList.add('active');
                } else {
                    reactionDisplay.classList.remove('active');
                }
            }
        }
    });

    // =========================================
    // 5. GESTIONE INTERAZIONE UI
    // =========================================
    
    /** Invia un messaggio tramite il socket. */
    function sendMessage() {
        if (!input || !sendBtn) return;

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
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

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
    }

    // Gestione della navigazione tra le sezioni
    if (navButtons.length > 0 && contentSections.length > 0) {
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetSectionId = button.getAttribute('data-target');
                
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                contentSections.forEach(section => section.classList.remove('active'));
                
                const targetSection = document.getElementById(targetSectionId);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
                
                if (navLinks && navLinks.classList.contains('open')) {
                    navLinks.classList.remove('open');
                    if (hamburger) hamburger.classList.remove('open');
                }

                updateActiveIndicator();
            });
        });
        updateActiveIndicator();
    }
    window.addEventListener('resize', updateActiveIndicator);

    // Gestione del menu hamburger per mobile
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            hamburger.classList.toggle('open');
        });
    }

    // Gestione del tema chiaro/scuro
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLightMode = document.body.classList.contains('light-mode');
            themeToggle.innerHTML = isLightMode ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        });
    }

    // Gestione dell'accordion per le FAQ
    if (faqItems.length > 0) {
        faqItems.forEach(item => {
            const header = item.querySelector('.faq-header');
            if (header) {
                header.addEventListener('click', () => {
                    const isActive = item.classList.contains('active');
                    faqItems.forEach(faq => faq.classList.remove('active'));
                    if (!isActive) {
                        item.classList.add('active');
                    }
                });
            }
        });
    }
    
    // Gestione delle reazioni
    if (chatMessages) {
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
        
        // Rimuove il messaggio di stato quando arrivano i messaggi
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0 && chatMessages.children.length > 0) {
                    const statusMsg = document.getElementById('status-message');
                    if (statusMsg) statusMsg.remove();
                }
            });
        });
        observer.observe(chatMessages, { childList: true });
    }
});
