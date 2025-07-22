const { createClient } = require('@supabase/supabase-js');

// Inizializza il client Supabase
// Le credenziali verranno iniettate da Netlify dalle variabili d'ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

// Controlla se le variabili d'ambiente sono definite
if (!supabaseUrl || !supabaseKey) {
    console.error("Errore: Variabili d'ambiente SUPABASE_URL o SUPABASE_SECRET_KEY non definite.");
    // In un ambiente di produzione, potresti voler restituire un errore 500
    // o semplicemente lasciare che l'inizializzazione fallisca, che verrà catturata dal try/catch più avanti.
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
    const { httpMethod, queryStringParameters, body } = event;

    try {
        if (httpMethod === 'GET') {
            const { action, userId, roomId } = queryStringParameters;

            // --- Handle findMatch action (GET) ---
            if (action === 'findMatch' && userId) {
                // 1. Cerca un utente in stato 'waiting' che non sia l'utente corrente
                const { data: waitingUsers, error: selectError } = await supabase
                    .from('users')
                    .select('user_id')
                    .eq('status', 'waiting')
                    .neq('user_id', userId) // Non abbinare con se stesso
                    .limit(1); // Prendine solo uno

                if (selectError) {
                    console.error('Errore durante la ricerca utenti in attesa:', selectError);
                    // Lancia un errore per fermare l'esecuzione e restituire un 500
                    throw new Error('Errore nel database durante la ricerca partner.');
                }

                if (waitingUsers && waitingUsers.length > 0) {
                    // Trovato un partner!
                    const partnerId = waitingUsers[0].user_id;
                    const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

                    // 2. Aggiorna lo stato del partner a 'matched' e assegna la room_id
                    const { error: updatePartnerError } = await supabase
                        .from('users')
                        .update({ status: 'matched', room_id: newRoomId })
                        .eq('user_id', partnerId);

                    if (updatePartnerError) {
                        console.error('Errore aggiornamento partner:', updatePartnerError);
                        throw new Error('Errore nel database durante l\'aggiornamento del partner.');
                    }

                    // 3. Crea la nuova chat room
                    const { error: createRoomError } = await supabase
                        .from('rooms')
                        .insert([
                            { room_id: newRoomId, users_in_room: [partnerId, userId], messages: [] }
                        ]);

                    if (createRoomError) {
                        console.error('Errore creazione room:', createRoomError);
                        throw new Error('Errore nel database durante la creazione della room.');
                    }

                    // 4. Aggiorna o crea l'utente corrente come 'matched' e assegna la room_id
                    // Tentativo di aggiornare se l'utente esiste già (es. era in attesa ma ha ricaricato)
                    const { data: updatedUser, error: updateSelfError } = await supabase
                        .from('users')
                        .update({ status: 'matched', room_id: newRoomId })
                        .eq('user_id', userId)
                        .select(); // Aggiunto .select() per ottenere il dato dell'aggiornamento

                    // Se non ci sono righe aggiornate, significa che l'utente non esisteva, quindi lo inseriamo
                    if (updateSelfError || !updatedUser || updatedUser.length === 0) {
                        const { error: insertSelfError } = await supabase
                            .from('users')
                            .insert([{ user_id: userId, status: 'matched', room_id: newRoomId }]);
                        if (insertSelfError) {
                            console.error('Errore insert self:', insertSelfError);
                            throw new Error('Errore nel database durante l\'inserimento dell\'utente.');
                        }
                    }


                    console.log(`Matched ${partnerId} with ${userId} in room ${newRoomId}`);
                    return {
                        statusCode: 200,
                        body: JSON.stringify({ roomId: newRoomId, status: 'matched', partnerId: partnerId })
                    };

                } else {
                    // Nessun partner trovato, metti l'utente corrente in attesa
                    // Tentativo di aggiornare lo stato dell'utente se esiste già
                    const { data: updatedUser, error: updateExistingUserError } = await supabase
                        .from('users')
                        .update({ status: 'waiting', room_id: null })
                        .eq('user_id', userId)
                        .select(); // Aggiunto .select()

                    // Se non ci sono righe aggiornate, significa che l'utente non esisteva, quindi lo inseriamo
                    if (updateExistingUserError || !updatedUser || updatedUser.length === 0) {
                        const { error: insertUserError } = await supabase
                            .from('users')
                            .insert([{ user_id: userId, status: 'waiting', room_id: null }]);
                        if (insertUserError) {
                            console.error('Errore insert user (waiting):', insertUserError);
                            throw new Error('Errore nel database durante l\'inserimento utente in attesa.');
                        }
                    }

                    console.log(`${userId} è in attesa.`);
                    return {
                        statusCode: 200,
                        body: JSON.stringify({ status: 'waiting', message: 'In attesa di un partner...' })
                    };
                }
            }

            // --- Handle getMessages action (GET) ---
            if (action === 'getMessages' && roomId) {
                const { data: roomData, error } = await supabase
                    .from('rooms')
                    .select('messages')
                    .eq('room_id', roomId)
                    .single(); // Assumiamo che room_id sia unico

                if (error) {
                    console.error('Errore durante il recupero dei messaggi:', error);
                    return {
                        statusCode: 404,
                        body: JSON.stringify({ error: 'Room non trovata o errore nel recupero messaggi.', details: error.message })
                    };
                }
                return {
                    statusCode: 200,
                    body: JSON.stringify({ messages: roomData.messages || [] })
                };
            }

        } else if (httpMethod === 'POST') {
            const { action, roomId, senderId, text, userId: disconnectUserId } = JSON.parse(body);

            // --- Handle sendMessage action (POST) ---
            if (action === 'sendMessage' && roomId && senderId && text) {
                // Recupera i messaggi esistenti e aggiungi il nuovo
                const { data: roomData, error: selectRoomError } = await supabase
                    .from('rooms')
                    .select('messages')
                    .eq('room_id', roomId)
                    .single();

                if (selectRoomError) {
                    console.error('Errore nel recupero room per invio messaggio:', selectRoomError);
                    return {
                        statusCode: 404,
                        body: JSON.stringify({ error: 'Room non trovata per invio messaggio.', details: selectRoomError.message })
                    };
                }

                const currentMessages = roomData.messages || [];
                const newMessage = { senderId, text, timestamp: Date.now() };
                const updatedMessages = [...currentMessages, newMessage];

                const { error: updateError } = await supabase
                    .from('rooms')
                    .update({ messages: updatedMessages })
                    .eq('room_id', roomId);

                if (updateError) {
                    console.error('Errore durante l\'invio del messaggio:', updateError);
                    throw new Error('Errore nel database durante l\'invio del messaggio.');
                }
                console.log(`Message in room ${roomId} from ${senderId}: ${text}`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'Message sent' })
                };
            }

            // --- Handle disconnect action (POST) ---
            if (action === 'disconnect' && roomId && disconnectUserId) {
                // Aggiorna lo stato dell'utente disconnesso a 'disconnected'
                const { error: updateUserError } = await supabase
                    .from('users')
                    .update({ status: 'disconnected', room_id: null })
                    .eq('user_id', disconnectUserId);

                if (updateUserError) {
                    console.error('Errore nell\'aggiornare lo stato dell\'utente disconnesso:', updateUserError);
                    // Non bloccare il flusso se c'è un errore qui, l'importante è che l'utente si stia disconnettendo
                }

                // Recupera la room per aggiornare gli utenti e aggiungere un messaggio di sistema
                const { data: roomData, error: selectRoomError } = await supabase
                    .from('rooms')
                    .select('users_in_room, messages')
                    .eq('room_id', roomId)
                    .single();

                if (!selectRoomError && roomData) {
                    const updatedUsersInRoom = roomData.users_in_room.filter(id => id !== disconnectUserId);
                    const currentMessages = roomData.messages || [];
                    const systemMessage = { senderId: 'system', text: `Il tuo partner si è disconnesso.`, timestamp: Date.now() };
                    const updatedMessages = [...currentMessages, systemMessage];

                    if (updatedUsersInRoom.length === 0) {
                        // Elimina la room se non ci sono più utenti
                        const { error: deleteRoomError } = await supabase
                            .from('rooms')
                            .delete()
                            .eq('room_id', roomId);
                        if (deleteRoomError) console.error('Errore nell\'eliminare la room:', deleteRoomError);
                        console.log(`Room ${roomId} eliminata.`);
                    } else {
                        // Aggiorna la room con gli utenti rimanenti e il messaggio di sistema
                        const { error: updateRoomError } = await supabase
                            .from('rooms')
                            .update({ users_in_room: updatedUsersInRoom, messages: updatedMessages })
                            .eq('room_id', roomId);
                        if (updateRoomError) console.error('Errore nell\'aggiornare la room:', updateRoomError);
                        console.log(`Utente ${disconnectUserId} disconnesso da room ${roomId}. Rimangono: ${updatedUsersInRoom.join(', ')}`);
                    }
                } else {
                    console.log(`Room ${roomId} non trovata per disconnessione o errore.`);
                }

                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'Disconnected' })
                };
            }
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Azione non valida o parametri mancanti.' })
        };
    } catch (error) {
        console.error('Errore nella funzione Netlify:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore interno del server.', details: error.message })
        };
    }
};
