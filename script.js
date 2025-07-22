document.addEventListener('DOMContentLoaded', () => {
    const startChatBtn = document.getElementById('startChatBtn');
    const statusDiv = document.getElementById('status');
    const chatWindow = document.getElementById('chatWindow');
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    let currentRoomId = null;
    let userId = null; // Un ID univoco per questo utente
    let pollingInterval = null; // Per il polling dei messaggi

    // Genera un ID utente casuale una volta al caricamento della pagina
    userId = `user_${Math.random().toString(36).substring(2, 9)}`;

    const API_BASE_URL = '/.netlify/functions'; // Percorso per le Netlify Functions

    /**
     * Invia un messaggio alla chat.
     * @param {string} type 'self' o 'other'
     * @param {string} text Il contenuto del messaggio
     */
    function displayMessage(type, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        messageElement.textContent = text;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scorri in fondo
    }

    /**
     * Avvia il polling per i nuovi messaggi.
     */
    async function startPolling() {
        if (pollingInterval) clearInterval(pollingInterval);

        let lastMessageIndex = 0; // Tieni traccia dell'ultimo messaggio letto

        // La funzione di polling
        const pollForMessages = async () => {
            if (!currentRoomId) return;

            try {
                const response = await fetch(`${API_BASE_URL}/matchmaker?action=getMessages&roomId=${currentRoomId}`);
                const data = await response.json();

                if (data.messages && data.messages.length > lastMessageIndex) {
                    // Elabora solo i nuovi messaggi
                    for (let i = lastMessageIndex; i < data.messages.length; i++) {
                        const msg = data.messages[i];
                        if (msg.senderId === userId) {
                            displayMessage('self', msg.text);
                        } else {
                            displayMessage('other', msg.text);
                        }
                    }
                    lastMessageIndex = data.messages.length; // Aggiorna l'indice dell'ultimo messaggio letto
                }
            } catch (error) {
                console.error('Errore durante il polling dei messaggi:', error);
                // Puoi aggiungere una logica per gestire la disconnessione
            }
        };

        // Esegui il polling ogni 2 secondi
        pollingInterval = setInterval(pollForMessages, 2000);
        pollForMessages(); // Esegui subito una volta all'avvio
    }

    /**
     * Ferma il polling.
     */
    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    /**
     * Resetta l'interfaccia utente allo stato iniziale.
     */
    function resetUI() {
        stopPolling();
        currentRoomId = null;
        messagesDiv.innerHTML = '';
        messageInput.value = '';
        chatWindow.style.display = 'none';
        startChatBtn.style.display = 'block';
        startChatBtn.textContent = 'Avvia Nuova Chat';
        statusDiv.textContent = 'Clicca "Avvia Nuova Chat" per trovare qualcuno.';
        startChatBtn.disabled = false;
    }

    startChatBtn.addEventListener('click', async () => {
        startChatBtn.disabled = true;
        statusDiv.textContent = 'Ricerca di un partner...';
        messagesDiv.innerHTML = ''; // Pulisci i messaggi precedenti

        try {
            const response = await fetch(`${API_BASE_URL}/matchmaker?action=findMatch&userId=${userId}`);
            const data = await response.json();

            if (data.roomId) {
                currentRoomId = data.roomId;
                statusDiv.textContent = `Connesso alla chat room ${currentRoomId}.`;
                chatWindow.style.display = 'block';
                startChatBtn.style.display = 'none'; // Nasconde il bottone Avvia Chat
                startPolling(); // Inizia a ricevere messaggi
            } else if (data.status === 'waiting') {
                statusDiv.textContent = 'Nessun partner trovato, in attesa di qualcuno...';
                // Puoi aggiungere un meccanismo di polling qui per controllare lo stato del matchmaking
                // Per semplicità, in questo esempio l'utente dovrà cliccare di nuovo o aspettare
                // una notifica push (non implementata qui)
                startChatBtn.disabled = false; // Permetti di ritentare
            }
        } catch (error) {
            console.error('Errore durante la ricerca di un partner:', error);
            statusDiv.textContent = 'Errore di connessione. Riprova.';
            startChatBtn.disabled = false;
        }
    });

    sendMessageBtn.addEventListener('click', async () => {
        const messageText = messageInput.value.trim();
        if (messageText && currentRoomId) {
            try {
                // Invia il messaggio tramite una Netlify Function
                await fetch(`${API_BASE_URL}/matchmaker`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'sendMessage',
                        roomId: currentRoomId,
                        senderId: userId,
                        text: messageText,
                        timestamp: Date.now()
                    })
                });
                messageInput.value = ''; // Pulisci l'input
                // Il messaggio verrà visualizzato dal polling, non aggiungerlo qui direttamente per evitare duplicati
            } catch (error) {
                console.error('Errore durante l\'invio del messaggio:', error);
            }
        }
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessageBtn.click();
        }
    });

    disconnectBtn.addEventListener('click', async () => {
        if (currentRoomId) {
            try {
                // Notifica al server la disconnessione
                await fetch(`${API_BASE_URL}/matchmaker`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'disconnect',
                        roomId: currentRoomId,
                        userId: userId
                    })
                });
            } catch (error) {
                console.error('Errore durante la disconnessione:', error);
            } finally {
                resetUI(); // Resetta l'interfaccia utente
            }
        } else {
            resetUI();
        }
    });

    // Inizializza l'interfaccia
    resetUI();
});


