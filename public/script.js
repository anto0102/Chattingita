const { createApp, ref, onMounted, onBeforeUnmount } = Vue; // Importa le funzioni necessarie da Vue

createApp({
    setup() {
        // Stato dell'applicazione (queste variabili sono reattive)
        const userId = ref(null);
        const roomId = ref(null);
        const partnerId = ref(null);
        const isMatched = ref(false);
        const statusMessage = ref('Pronto per trovare una chat!');
        const messages = ref([]);
        const messageInput = ref('');

        let matchmakingInterval = null; // Per il polling del matchmaking
        let chatSubscription = null; // Per la sottoscrizione Realtime Supabase
        let supabase = null; // Inizializzato in onMounted

        // Funzione per inizializzare Supabase (chiamata una sola volta)
        const initSupabase = () => {
            const supabaseUrl = 'https://gekoqfinkwoysferyjwm.supabase.co'; // DEVI INSERIRE IL TUO VERO URL
            const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdla29xZmlua3dveXNmZXJ5andtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNDk2NjQsImV4cCI6MjA2ODcyNTY2NH0.0gOgyjULefdGKXOANJQOPr1l17IDMYM_Iv2_BRYIeBA'; // DEVI INSERIRE LA TUA VERA CHIAVE ANONIMA (PUBLIC KEY)
            supabase = Supabase.createClient(supabaseUrl, supabaseAnonKey);
            console.log("Supabase client inizializzato.");
        };

        // Funzione per generare un ID utente casuale
        const generateUserId = () => {
            return 'user_' + Math.random().toString(36).substring(2, 9);
        };

        // Funzione per avviare il matchmaking
        const startMatchmaking = async () => {
            userId.value = generateUserId();
            statusMessage.value = 'Ricerca di un partner...';
            isMatched.value = false; // Assicurati che la chat non sia visibile

            // Avvia il polling per il matchmaking
            findMatch(); // Chiamata immediata
            if (!matchmakingInterval) {
                matchmakingInterval = setInterval(findMatch, 3000); // Poll ogni 3 secondi
            }
        };

        // Funzione per trovare un match (chiamata dal polling)
        const findMatch = async () => {
            try {
                const response = await fetch(`/.netlify/functions/matchmaker?action=findMatch&userId=${userId.value}`);
                const data = await response.json();

                if (data.status === 'matched') {
                    roomId.value = data.roomId;
                    partnerId.value = data.partnerId;
                    statusMessage.value = `Sei in chat con il partner ${partnerId.value}. Room ID: ${roomId.value}`;
                    isMatched.value = true; // Mostra la chat

                    // Ferma il polling del matchmaking
                    if (matchmakingInterval) {
                        clearInterval(matchmakingInterval);
                        matchmakingInterval = null;
                    }

                    // *** PARTE REALTIME: Sottoscriviti ai cambiamenti della stanza ***
                    subscribeToRoomMessages(roomId.value);

                } else if (data.status === 'waiting') {
                    statusMessage.value = 'Ricerca di un partner... (utente in attesa)';
                } else if (data.error) {
                    statusMessage.value = `Errore di matchmaking: ${data.error}`;
                    console.error('Errore di matchmaking:', data.details || data.error);
                    disconnect(); // Reset UI on error
                }

            } catch (error) {
                console.error('Errore durante la chiamata a findMatch:', error);
                statusMessage.value = 'Errore di connessione al servizio chat.';
                disconnect(); // Reset UI on error
            }
        };

        // Sottoscrizione ai messaggi in tempo reale
        const subscribeToRoomMessages = (currentRoomId) => {
            if (!supabase) {
                console.error("Supabase client non inizializzato per Realtime.");
                return;
            }
            if (chatSubscription) {
                supabase.removeChannel(chatSubscription);
            }

            chatSubscription = supabase
                .channel(`room:${currentRoomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'rooms',
                        filter: `room_id=eq.${currentRoomId}`
                    },
                    (payload) => {
                        const updatedRoom = payload.new;
                        if (updatedRoom && updatedRoom.messages) {
                            messages.value = updatedRoom.messages; // Aggiorna l'array reattivo
                            // Scorri la chatbox in fondo dopo un piccolo ritardo per permettere il rendering
                            setTimeout(() => {
                                const chatbox = document.getElementById('chatbox');
                                if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
                            }, 50);
                        }
                    }
                )
                .subscribe();

            console.log(`Sottoscritto ai cambiamenti della stanza: ${currentRoomId}`);
            getMessagesAndDisplayInitial(currentRoomId);
        };

        // Recupera i messaggi iniziali una sola volta al match
        const getMessagesAndDisplayInitial = async (currentRoomId) => {
            try {
                const response = await fetch(`/.netlify/functions/matchmaker?action=getMessages&roomId=${currentRoomId}`);
                const data = await response.json();
                if (data.messages) {
                    messages.value = data.messages;
                    setTimeout(() => {
                        const chatbox = document.getElementById('chatbox');
                        if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
                    }, 50);
                }
            } catch (error) {
                console.error('Errore nel recupero dei messaggi iniziali:', error);
            }
        };

        // Funzione per inviare un messaggio
        const sendMessage = async () => {
            const text = messageInput.value.trim();
            if (text === '' || !roomId.value || !userId.value) return;

            try {
                const response = await fetch('/.netlify/functions/matchmaker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'sendMessage', roomId: roomId.value, senderId: userId.value, text })
                });
                const data = await response.json();

                if (data.status === 'Message sent') {
                    messageInput.value = ''; // Pulisci l'input
                    // Il Realtime gestirà l'aggiornamento della chatbox
                } else if (data.error) {
                    console.error('Errore nell\'invio del messaggio:', data.details || data.error);
                    statusMessage.value = `Errore invio: ${data.error}`;
                }
            } catch (error) {
                console.error('Errore durante la chiamata a sendMessage:', error);
                statusMessage.value = 'Errore di connessione al servizio chat.';
            }
        };

        // Funzione per disconnettersi
        const disconnect = async () => {
            if (!roomId.value || !userId.value) {
                 resetChat(); // Reset the UI even if no room/user
                 return;
            }

            try {
                const response = await fetch('/.netlify/functions/matchmaker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'disconnect', roomId: roomId.value, userId: userId.value })
                });
                const data = await response.json();

                if (data.status === 'Disconnected') {
                    alert('Ti sei disconnesso dalla chat.');
                } else if (data.error) {
                    console.error('Errore nella disconnessione:', data.details || data.error);
                    statusMessage.value = `Errore disconnessione: ${data.error}`;
                }
            } catch (error) {
                console.error('Errore durante la chiamata a disconnect:', error);
                statusMessage.value = 'Errore di connessione al servizio.';
            } finally {
                resetChat(); // Always reset UI after disconnect attempt
            }
        };

        // Funzione per resettare lo stato della chat
        const resetChat = () => {
            userId.value = null;
            roomId.value = null;
            partnerId.value = null;
            isMatched.value = false;
            statusMessage.value = 'Pronto per trovare una chat!';
            messages.value = [];
            messageInput.value = '';

            if (matchmakingInterval) {
                clearInterval(matchmakingInterval);
                matchmakingInterval = null;
            }
            if (chatSubscription) {
                supabase.removeChannel(chatSubscription);
                chatSubscription = null;
            }
        };

        // Lifecycle hook di Vue: chiamato quando il componente è montato nel DOM
        onMounted(() => {
            initSupabase(); // Inizializza Supabase all'avvio dell'app
            resetChat(); // Imposta lo stato iniziale
        });

        // Lifecycle hook di Vue: chiamato prima che il componente sia smontato (per pulizia)
        onBeforeUnmount(() => {
            if (matchmakingInterval) clearInterval(matchmakingInterval);
            if (chatSubscription) supabase.removeChannel(chatSubscription);
        });

        // Ritorna le variabili e le funzioni che saranno disponibili nel template HTML
        return {
            userId,
            roomId,
            isMatched,
            statusMessage,
            messages,
            messageInput,
            startMatchmaking,
            sendMessage,
            disconnect,
        };
    }
}).mount('#app'); // Monta l'applicazione Vue sull'elemento con id="app"
