document.addEventListener('DOMContentLoaded', () => {
    const startMatchmakingButton = document.getElementById('start-matchmaking');
    const statusDiv = document.getElementById('status');
    const chatContainer = document.getElementById('chat-container');
    const chatbox = document.getElementById('chatbox');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const disconnectButton = document.getElementById('disconnect-button');

    let userId = null;
    let roomId = null;
    let partnerId = null; // Potrebbe essere utile per mostrare all'utente con chi sta parlando

    let matchmakingInterval = null; // Per il polling del matchmaking
    let messagePollingInterval = null; // Per il polling dei messaggi

    // Funzione per generare un ID utente casuale
    function generateUserId() {
        return 'user_' + Math.random().toString(36).substring(2, 9);
    }

    // Funzione per inizializzare l'interfaccia utente
    function initializeUI() {
        chatContainer.style.display = 'none';
        disconnectButton.style.display = 'none';
        startMatchmakingButton.style.display = 'block';
        statusDiv.textContent = '';
        chatbox.innerHTML = '';
        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;
        
        // Pulisci gli intervalli precedenti se esistono
        if (matchmakingInterval) {
            clearInterval(matchmakingInterval);
            matchmakingInterval = null;
        }
        if (messagePollingInterval) {
            clearInterval(messagePollingInterval);
            messagePollingInterval = null;
        }
    }

    // Chiamata iniziale per impostare l'interfaccia
    initializeUI();

    // Gestore per il pulsante "Avvia Nuova Chat"
    startMatchmakingButton.addEventListener('click', async () => {
        userId = generateUserId(); // Genera un nuovo ID utente per ogni nuova chat
        statusDiv.textContent = 'Ricerca di un partner...';
        startMatchmakingButton.style.display = 'none'; // Nascondi il pulsante

        // Avvia il polling per il matchmaking
        // La prima chiamata avviene immediatamente, poi ogni 3 secondi
        findMatch(); // Chiamata immediata
        if (!matchmakingInterval) { // Impedisce di avviare più intervalli
            matchmakingInterval = setInterval(findMatch, 3000); // Poll ogni 3 secondi
        }
    });

    // Funzione per la chiamata alla Netlify Function per il matchmaking
    async function findMatch() {
        try {
            const response = await fetch(`/.netlify/functions/matchmaker?action=findMatch&userId=${userId}`);
            const data = await response.json();

            if (data.status === 'matched') {
                // Partner trovato, aggiorna l'interfaccia e inizia la chat
                roomId = data.roomId;
                partnerId = data.partnerId;
                statusDiv.textContent = `Sei in chat con il partner ${partnerId}. Room ID: ${roomId}`;
                
                chatContainer.style.display = 'block';
                disconnectButton.style.display = 'block';
                messageInput.disabled = false;
                sendButton.disabled = false;

                // Ferma il polling del matchmaking
                if (matchmakingInterval) {
                    clearInterval(matchmakingInterval);
                    matchmakingInterval = null;
                }

                // Avvia il polling per i messaggi (se non è già attivo)
                if (!messagePollingInterval) {
                    messagePollingInterval = setInterval(getMessagesAndDisplay, 1500); // Poll ogni 1.5 secondi
                }
                getMessagesAndDisplay(); // Recupera subito i messaggi iniziali
                

            } else if (data.status === 'waiting') {
                // Nessun partner trovato, rimane in attesa
                statusDiv.textContent = 'Ricerca di un partner... (utente in attesa)';
                // Continua il polling per findMatch (gestito dall'intervallo sopra)

            } else if (data.error) {
                statusDiv.textContent = `Errore di matchmaking: ${data.error}`;
                console.error('Errore di matchmaking:', data.details || data.error);
                // In caso di errore grave, ferma il polling e resetta l'UI
                initializeUI();
            }

        } catch (error) {
            console.error('Errore durante la chiamata a findMatch:', error);
            statusDiv.textContent = 'Errore di connessione al servizio chat.';
            // In caso di errore di rete, potresti voler riprovare o dare un messaggio all'utente
            initializeUI(); // Resetta l'UI in caso di errore critico
        }
    }

    // Funzione per recuperare e visualizzare i messaggi
    async function getMessagesAndDisplay() {
        if (!roomId) return; // Non recuperare messaggi se non c'è una roomId

        try {
            const response = await fetch(`/.netlify/functions/matchmaker?action=getMessages&roomId=${roomId}`);
            const data = await response.json();

            if (data.messages) {
                // Aggiorna solo se ci sono nuovi messaggi per evitare flicker
                const currentMessagesCount = chatbox.children.length;
                if (data.messages.length > currentMessagesCount) {
                    chatbox.innerHTML = ''; // Pulisci la chatbox
                    data.messages.forEach(msg => {
                        const p = document.createElement('p');
                        const sender = msg.senderId === userId ? 'Tu' : (msg.senderId === 'system' ? 'Sistema' : 'Partner');
                        p.textContent = `${sender}: ${msg.text}`;
                        chatbox.appendChild(p);
                    });
                    chatbox.scrollTop = chatbox.scrollHeight; // Scorri fino in fondo
                }
            }
        } catch (error) {
            console.error('Errore durante il recupero dei messaggi:', error);
            // Non resettare l'UI qui, ma potresti mostrare un piccolo avviso temporaneo
        }
    }

    // Gestore per l'invio del messaggio
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    async function sendMessage() {
        const text = messageInput.value.trim();
        if (text === '' || !roomId || !userId) return;

        try {
            const response = await fetch('/.netlify/functions/matchmaker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sendMessage', roomId, senderId: userId, text })
            });
            const data = await response.json();

            if (data.status === 'Message sent') {
                messageInput.value = ''; // Pulisci l'input
                getMessagesAndDisplay(); // Aggiorna subito i messaggi dopo averne inviato uno
            } else if (data.error) {
                console.error('Errore nell\'invio del messaggio:', data.details || data.error);
                statusDiv.textContent = `Errore invio: ${data.error}`;
            }
        } catch (error) {
            console.error('Errore durante la chiamata a sendMessage:', error);
            statusDiv.textContent = 'Errore di connessione al servizio chat.';
        }
    }

    // Gestore per il pulsante "Disconnetti"
    disconnectButton.addEventListener('click', async () => {
        if (!roomId || !userId) return;

        try {
            const response = await fetch('/.netlify/functions/matchmaker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'disconnect', roomId, userId: userId })
            });
            const data = await response.json();

            if (data.status === 'Disconnected') {
                alert('Ti sei disconnesso dalla chat.');
                initializeUI(); // Resetta l'interfaccia
                userId = null;
                roomId = null;
                partnerId = null;
            } else if (data.error) {
                console.error('Errore nella disconnessione:', data.details || data.error);
                statusDiv.textContent = `Errore disconnessione: ${data.error}`;
            }
        } catch (error) {
            console.error('Errore durante la chiamata a disconnect:', error);
            statusDiv.textContent = 'Errore di connessione al servizio.';
        }
    });
});
