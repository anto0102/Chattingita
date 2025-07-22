const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // Variabili d'ambiente, verifica come prima
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        console.error('Errore: Variabili d\'ambiente SUPABASE_URL o SUPABASE_SECRET_KEY non definite.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Configurazione del server non valida.' }),
        };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = event.queryStringParameters || {};
    const { roomId, userId, senderId, text } = JSON.parse(event.body || '{}');

    try {
        if (action === 'findMatch') {
            const currentUserId = event.queryStringParameters.userId;

            // 1. Cerca un utente in attesa (status: 'waiting') che non sia l'utente attuale
            const { data: waitingUsers, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('status', 'waiting')
                .neq('user_id', currentUserId)
                .limit(1);

            if (fetchError) {
                console.error('Errore durante la ricerca utenti in attesa:', fetchError);
                return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante la ricerca di un partner.', details: fetchError.message }) };
            }

            if (waitingUsers && waitingUsers.length > 0) {
                // Partner trovato! Effettua il match
                const partner = waitingUsers[0];
                const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`; // Genera un Room ID unico

                // Inizia una transazione per assicurare che gli aggiornamenti siano atomici
                // Nota: Supabase non ha transazioni dirette lato JS per insert/update multiple come un ORM classico.
                // Gestiamo gli errori per rollback logico.

                // A. Aggiorna lo stato del partner a 'matched' e assegna la room_id
                const { error: updatePartnerError } = await supabase
                    .from('users')
                    .update({ status: 'matched', room_id: newRoomId })
                    .eq('user_id', partner.user_id);

                if (updatePartnerError) {
                    console.error('Errore aggiornamento partner:', updatePartnerError);
                    return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante l\'aggiornamento del partner.', details: updatePartnerError.message }) };
                }

                // B. Aggiorna lo stato dell'utente attuale a 'matched' e assegna la room_id
                const { error: updateSelfError } = await supabase
                    .from('users')
                    .update({ status: 'matched', room_id: newRoomId })
                    .eq('user_id', currentUserId);

                if (updateSelfError) {
                    console.error('Errore aggiornamento self:', updateSelfError);
                    // Considera un rollback per il partner qui se necessario in una vera transazione
                    return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante l\'aggiornamento dell\'utente corrente.', details: updateSelfError.message }) };
                }

                // C. Crea una nuova room
                const { error: createRoomError } = await supabase
                    .from('rooms')
                    .insert({ room_id: newRoomId, users_in_room: [currentUserId, partner.user_id], messages: [] });

                if (createRoomError) {
                    console.error('Errore creazione room:', createRoomError);
                    // Considera un rollback per gli utenti qui se necessario
                    return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante la creazione della stanza.', details: createRoomError.message }) };
                }

                console.info(`Matched ${currentUserId} with ${partner.user_id} in room ${newRoomId}`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'matched', roomId: newRoomId, partnerId: partner.user_id }),
                };

            } else {
                // Nessun partner trovato, metti l'utente in attesa o aggiorna il suo stato a 'waiting'
                const { data: existingUser, error: checkUserError } = await supabase
                    .from('users')
                    .select('user_id, status')
                    .eq('user_id', currentUserId)
                    .limit(1);

                if (checkUserError) {
                    console.error('Errore nella verifica utente esistente:', checkUserError);
                    return { statusCode: 500, body: JSON.stringify({ error: 'Errore nella verifica dello stato utente.', details: checkUserError.message }) };
                }

                if (existingUser && existingUser.length > 0) {
                    // Utente esiste, aggiorna a waiting se non lo è già
                    if (existingUser[0].status !== 'waiting') {
                        const { error: updateWaitingError } = await supabase
                            .from('users')
                            .update({ status: 'waiting', room_id: null }) // Rimuovi room_id se torna in attesa
                            .eq('user_id', currentUserId);
                        if (updateWaitingError) {
                            console.error('Errore aggiornamento utente a waiting:', updateWaitingError);
                            return { statusCode: 500, body: JSON.stringify({ error: 'Errore aggiornamento stato utente.', details: updateWaitingError.message }) };
                        }
                    }
                } else {
                    // Utente non esiste, inserisci come waiting
                    const { error: insertUserError } = await supabase
                        .from('users')
                        .insert([{ user_id: currentUserId, status: 'waiting', room_id: null }]);
                    if (insertUserError) {
                        console.error('Errore insert user (waiting):', insertUserError);
                        return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante l\'inserimento utente in attesa.', details: insertUserError.message }) };
                    }
                }

                console.info(`${currentUserId} è in attesa.`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'waiting' }),
                };
            }
        } else if (action === 'sendMessage') {
            // Aggiungi il messaggio all'array 'messages' della room
            const { data: room, error: fetchRoomError } = await supabase
                .from('rooms')
                .select('messages')
                .eq('room_id', roomId)
                .single();

            if (fetchRoomError) {
                console.error('Errore nel recupero room per invio messaggio:', fetchRoomError);
                return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante l\'invio del messaggio.', details: fetchRoomError.message }) };
            }

            const newMessages = room.messages ? [...room.messages, { senderId, text, timestamp: new Date().toISOString() }] : [{ senderId, text, timestamp: new Date().toISOString() }];

            const { error: updateMessagesError } = await supabase
                .from('rooms')
                .update({ messages: newMessages })
                .eq('room_id', roomId);

            if (updateMessagesError) {
                console.error('Errore durante l\'invio del messaggio:', updateMessagesError);
                return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante l\'invio del messaggio.', details: updateMessagesError.message }) };
            }

            console.info(`Message in room ${roomId} from ${senderId}: ${text}`);
            return {
                statusCode: 200,
                body: JSON.stringify({ status: 'Message sent' }),
            };
        } else if (action === 'getMessages') { // Questa azione verrà rimossa o modificata dal frontend
            const { data: room, error: fetchRoomError } = await supabase
                .from('rooms')
                .select('messages')
                .eq('room_id', roomId)
                .single();

            if (fetchRoomError) {
                // Se la stanza non esiste o errore, restituisci un array vuoto
                console.warn(`Errore o stanza non trovata per i messaggi (${roomId}):`, fetchRoomError.message);
                return { statusCode: 200, body: JSON.stringify({ messages: [] }) };
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ messages: room ? room.messages : [] }),
            };
        } else if (action === 'disconnect') {
            const { data: room, error: fetchRoomError } = await supabase
                .from('rooms')
                .select('users_in_room')
                .eq('room_id', roomId)
                .single();

            if (fetchRoomError) {
                console.error('Errore nel recupero room per disconnessione:', fetchRoomError);
                return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante la disconnessione.', details: fetchRoomError.message }) };
            }

            let updatedUsersInRoom = room.users_in_room.filter(id => id !== userId);
            let userStatus = 'disconnected'; // Assume disconnesso di default
            
            // Se c'è ancora un utente nella stanza, aggiorna il suo stato a 'waiting'
            // Questo gestisce il caso in cui un utente rimane da solo e deve essere rimesso in coda
            if (updatedUsersInRoom.length > 0) {
                userStatus = 'waiting';
                // Aggiorna lo stato dell'utente rimasto a 'waiting'
                const { error: updateRemainingUserError } = await supabase
                    .from('users')
                    .update({ status: 'waiting', room_id: null })
                    .eq('user_id', updatedUsersInRoom[0]);
                if (updateRemainingUserError) {
                    console.error('Errore aggiornamento utente rimasto a waiting:', updateRemainingUserError);
                }
            } else {
                 // Se nessuno rimane, elimina la stanza
                const { error: deleteRoomError } = await supabase
                    .from('rooms')
                    .delete()
                    .eq('room_id', roomId);
                if (deleteRoomError) {
                    console.error('Errore eliminazione room:', deleteRoomError);
                }
            }
            
            // Aggiorna lo stato dell'utente che si è disconnesso
            const { error: updateUserError } = await supabase
                .from('users')
                .update({ status: 'disconnected', room_id: null }) // L'utente che si disconnette è 'disconnected'
                .eq('user_id', userId);

            if (updateUserError) {
                console.error('Errore aggiornamento utente disconnesso:', updateUserError);
                return { statusCode: 500, body: JSON.stringify({ error: 'Errore durante l\'aggiornamento dello stato dell\'utente disconnesso.', details: updateUserError.message }) };
            }

            // Aggiorna o elimina la stanza a seconda di quanti utenti rimangono
            if (updatedUsersInRoom.length > 0) {
                const { error: updateRoomError } = await supabase
                    .from('rooms')
                    .update({ users_in_room: updatedUsersInRoom })
                    .eq('room_id', roomId);
                if (updateRoomError) {
                    console.error('Errore aggiornamento room dopo disconnessione:', updateRoomError);
                }
            } else {
                // La stanza viene eliminata se non ci sono utenti, gestito sopra
            }

            console.info(`Utente ${userId} disconnesso da room ${roomId}. Rimangono: ${updatedUsersInRoom.join(', ')}`);
            return {
                statusCode: 200,
                body: JSON.stringify({ status: 'Disconnected' }),
            };
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Azione non valida.' }),
        };

    } catch (error) {
        console.error('Errore generale nella funzione:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore interno del server.', details: error.message }),
        };
    }
};
