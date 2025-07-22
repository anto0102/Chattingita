const { createApp, ref, onMounted, onBeforeUnmount } = Vue;

createApp({
    setup() {
        const userId = ref(null);
        const roomId = ref(null);
        const partnerId = ref(null);
        const isMatched = ref(false);
        const statusMessage = ref('Pronto per trovare una chat!');
        const messages = ref([]);
        const messageInput = ref('');

        let matchmakingInterval = null;
        let chatSubscription = null;
        let supabase = null;

        const initSupabase = () => {
            const supabaseUrl = 'https://gekoqfinkwoysferyjwm.supabase.co';
            const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdla29xZmlua3dveXNmZXJ5andtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNDk2NjQsImV4cCI6MjA2ODcyNTY2NH0.0gOgyjULefdGKXOANJQOPr1l17IDMYM_Iv2_BRYIeBA';

            const { createClient } = window.supabase;
            supabase = createClient(supabaseUrl, supabaseAnonKey);
            console.log("✅ Supabase client inizializzato.");
        };

        const generateUserId = () => 'user_' + Math.random().toString(36).substring(2, 9);

        const startMatchmaking = async () => {
            userId.value = generateUserId();
            statusMessage.value = 'Ricerca di un partner...';
            isMatched.value = false;

            findMatch();
            if (!matchmakingInterval) {
                matchmakingInterval = setInterval(findMatch, 3000);
            }
        };

        const findMatch = async () => {
            try {
                const response = await fetch(`/.netlify/functions/matchmaker?action=findMatch&userId=${userId.value}`);
                const data = await response.json();

                if (data.status === 'matched') {
                    roomId.value = data.roomId;
                    partnerId.value = data.partnerId;
                    statusMessage.value = `Connesso con ${partnerId.value} nella stanza ${roomId.value}`;
                    isMatched.value = true;

                    if (matchmakingInterval) {
                        clearInterval(matchmakingInterval);
                        matchmakingInterval = null;
                    }

                    subscribeToRoomMessages(roomId.value);
                } else if (data.status === 'waiting') {
                    statusMessage.value = 'In attesa di un partner...';
                } else if (data.error) {
                    console.error('❌ Errore matchmaking:', data.details || data.error);
                    statusMessage.value = `Errore: ${data.error}`;
                    disconnect();
                }

            } catch (error) {
                console.error('❌ Errore di rete:', error);
                statusMessage.value = 'Errore di rete durante la connessione.';
                disconnect();
            }
        };

        const subscribeToRoomMessages = (currentRoomId) => {
            if (!supabase) return console.error("Supabase non inizializzato.");
            if (chatSubscription) supabase.removeChannel(chatSubscription);

            chatSubscription = supabase
                .channel(`room:${currentRoomId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rooms',
                    filter: `room_id=eq.${currentRoomId}`
                }, (payload) => {
                    const updatedRoom = payload.new;
                    if (updatedRoom?.messages) {
                        messages.value = updatedRoom.messages;
                        setTimeout(() => {
                            const chatbox = document.getElementById('chatbox');
                            if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
                        }, 50);
                    }
                })
                .subscribe();

            console.log(`📡 Subscribed to room: ${currentRoomId}`);
            getMessagesAndDisplayInitial(currentRoomId);
        };

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
                console.error('Errore caricamento messaggi:', error);
            }
        };

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
                    messageInput.value = '';
                } else if (data.error) {
                    console.error('Errore invio:', data.details || data.error);
                    statusMessage.value = `Errore: ${data.error}`;
                }
            } catch (error) {
                console.error('Errore di rete invio:', error);
                statusMessage.value = 'Errore di rete.';
            }
        };

        const disconnect = async () => {
            if (!roomId.value || !userId.value) {
                resetChat();
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
                    alert('Disconnesso.');
                } else if (data.error) {
                    console.error('Errore disconnessione:', data.details || data.error);
                    statusMessage.value = `Errore: ${data.error}`;
                }
            } catch (error) {
                console.error('Errore di rete disconnessione:', error);
                statusMessage.value = 'Errore di rete.';
            } finally {
                resetChat();
            }
        };

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

        onMounted(() => {
            initSupabase();
            resetChat();
        });

        onBeforeUnmount(() => {
            if (matchmakingInterval) clearInterval(matchmakingInterval);
            if (chatSubscription) supabase.removeChannel(chatSubscription);
        });

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
}).mount('#app');
