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
    let partnerId = null;

    let matchmakingInterval = null; // Per il polling del matchmaking (ancora necessario qui)
    let chatSubscription = null; // Per la sottoscrizione Realtime

    // Inizializza il client Supabase nel frontend
    // DEVI SOSTITUIRE QUESTI VALORI CON LA TUA SUPABASE_URL E SUPABASE_ANON_KEY (PUBLIC KEY!)
    const supabaseUrl = 'https://gekoqfinkwoysferyjwm.supabase.co'; // Es: 'https://abcdefghijk.supabase.co'
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdla29xZmlua3dveXNmZXJ5andtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNDk2NjQsImV4cCI6MjA2ODcyNTY2NH0.0gOgyjULefdGKXOANJQOPr1l17IDMYM_Iv2_BRYIeBA'; // La 'anon' o 'public' key
    const supabase = Supabase.createClient(supabaseUrl, supabaseAnonKey);


    // Funzione per generare un ID utente casuale
    function generateUserId() {
        return 'user_' + Math.random().toString(36).substring(2, 9);
    }

    // Funzione per inizializzare/resettare l'interfaccia utente
    function initializeUI() {
        chatContainer.style.display = 'none';
        disconnectButton.style.display = 'none';
        startMatchmakingButton.style.display = 'block';
        statusDiv.textContent = '';
        chatbox.innerHTML = '';
        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;

        if (matchmakingInterval) {
            clearInterval(matchmakingInterval);
            matchmakingInterval = null;
        }
        // Ferma la sottoscrizione Realtime se attiva
        if (chatSubscription) {
            supabase.removeChannel(chatSubscription);
            chatSubscription = null;
        }
    }

    initializeUI(); // Imposta l'interfaccia allo stato iniziale al caricamento

    startMatchmakingButton.addEventListener('click', async () => {
        userId = generateUserId();
        statusDiv.textContent = 'Ricerca di un partner...';
        startMatchmakingButton.style.display = 'none';

        // Avvia il polling per il matchmaking
        findMatch(); // Chiamata immediata
        if (!matchmakingInterval) {
            matchmakingInterval = setInterval(findMatch, 3000); // Poll ogni 3 secondi per trovare un match
        }
    });

    async function findMatch() {
        try {
            const response = await fetch(`/.netlify/functions/matchmaker?action=findMatch&userId=${userId}`);
            const data = await response.json();

            if (data.status === 'matched') {
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

                // *** PARTE REALTIME: Sottoscriviti ai cambiamenti della stanza ***
                subscribeToRoomMessages(roomId);

            } else if (data.status === 'waiting') {
                statusDiv.textContent = 'Ricerca di un partner... (utente in attesa)';
            } else if (data.error) {
                statusDiv.textContent = `Errore di matchmaking: ${data.error}`;
                console.error('Errore di matchmaking:', data.details || data.error);
                initializeUI();
            }

        } catch (error) {
            console.error('Errore durante la chiamata a findMatch:', error);
            statusDiv.textContent = 'Errore di connessione al servizio chat.';
            initializeUI();
        }
    }

    // *** NUOVA FUNZIONE: Sottoscrizione ai messaggi in tempo reale ***
    function subscribeToRoomMessages(currentRoomId) {
        // Rimuovi eventuali sottoscrizioni precedenti per evitare duplicati
        if (chatSubscription) {
            supabase.removeChannel(chatSubscription);
        }

        // Sottoscriviti alla tabella 'rooms' per i cambiamenti nella riga della nostra stanza
        chatSubscription = supabase
            .channel(`room:${currentRoomId}`) // Crea un canale unico per la stanza
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE', // Ascolta solo gli aggiornamenti
                    schema: 'public',
                    table: 'rooms',
                    filter: `room_id=eq.${currentRoomId}` // Filtra solo per la nostra room_id
                },
                (payload) => {
                    // Payload.new contiene la riga aggiornata
                    const updatedRoom = payload.new;
                    if (updatedRoom && updatedRoom.messages) {
                        displayMessages(updatedRoom.messages);
                    }
                }
            )
            .subscribe(); // Avvia la sottoscrizione

        console.log(`Sottoscritto ai cambiamenti della stanza: ${currentRoomId}`);
        // Recupera i messaggi iniziali una volta sottoscritto
        getMessagesAndDisplayInitial(currentRoomId);
    }

    // Funzione per visualizzare i messaggi (chiamata dalla sottoscrizione e all'inizio)
    function displayMessages(messages) {
        const currentMessagesCount = chatbox.children.length;
        if (messages.length > currentMessagesCount) {
            chatbox.innerHTML = '';
            messages.forEach(msg => {
                const p = document.createElement('p');
                const sender = msg.senderId === userId ? 'Tu' : (msg.senderId === 'system' ? 'Sistema' : 'Partner');
                p.textContent = `${sender}: ${msg.text}`;
                chatbox.appendChild(p);
            });
            chatbox.scrollTop = chatbox.scrollHeight;
        }
    }

    // Funzione per recuperare i messaggi iniziali una sola volta al match
    async function getMessagesAndDisplayInitial(currentRoomId) {
        try {
            const response = await fetch(`/.netlify/functions/matchmaker?action=getMessages&roomId=${currentRoomId}`);
            const data = await response.json();
            if (data.messages) {
                displayMessages(data.messages);
            }
        } catch (error) {
            console.error('Errore nel recupero dei messaggi iniziali:', error);
        }
    }


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
                messageInput.value = '';
                // Non c'è bisogno di chiamare displayMessages qui, il realtime si occuperà dell'aggiornamento
            } else if (data.error) {
                console.error('Errore nell\'invio del messaggio:', data.details || data.error);
                statusDiv.textContent = `Errore invio: ${data.error}`;
            }
        } catch (error) {
            console.error('Errore durante la chiamata a sendMessage:', error);
            statusDiv.textContent = 'Errore di connessione al servizio chat.';
        }
    }

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
                initializeUI();
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
