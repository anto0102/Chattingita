// WARNING: This in-memory storage IS NOT SUITABLE FOR PRODUCTION WITH NETLIFY FUNCTIONS.
// Netlify Functions are stateless and each invocation might run on a different instance.
// For production, you MUST use a persistent database (e.g., FaunaDB, Firebase, Redis, Supabase).
let waitingUser = null; // Un utente in attesa di un match
let activeRooms = {}; // { roomId: { users: [userId1, userId2], messages: [] } }

exports.handler = async (event, context) => {
    const { httpMethod, queryStringParameters, body } = event;

    if (httpMethod === 'GET') {
        const { action, userId, roomId } = queryStringParameters;

        // --- Handle findMatch action (GET) ---
        if (action === 'findMatch' && userId) {
            if (waitingUser && waitingUser !== userId) {
                // Trovato un partner
                const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
                activeRooms[newRoomId] = {
                    users: [waitingUser, userId],
                    messages: []
                };
                console.log(`Matched ${waitingUser} with ${userId} in room ${newRoomId}`);
                const matchedUser = waitingUser; // Cattura l'ID dell'utente che era in attesa
                waitingUser = null; // Resetta l'utente in attesa

                // Rispondi a entrambi gli utenti
                // Poiché la funzione è stateless, rispondi al chiamante e il primo utente farà un'altra richiesta
                return {
                    statusCode: 200,
                    body: JSON.stringify({ roomId: newRoomId, status: 'matched', partnerId: matchedUser })
                };
            } else if (waitingUser === userId) {
                // L'utente è già in attesa
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'waiting', message: 'Sei già in attesa di un partner.' })
                };
            } else {
                // Nessun partner, mettiti in attesa
                waitingUser = userId;
                console.log(`${userId} è in attesa.`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'waiting', message: 'In attesa di un partner...' })
                };
            }
        }

        // --- Handle getMessages action (GET) ---
        if (action === 'getMessages' && roomId) {
            const room = activeRooms[roomId];
            if (room) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ messages: room.messages })
                };
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Room non trovata.' })
                };
            }
        }

    } else if (httpMethod === 'POST') {
        const { action, roomId, senderId, text, userId: disconnectUserId } = JSON.parse(body);

        // --- Handle sendMessage action (POST) ---
        if (action === 'sendMessage' && roomId && senderId && text) {
            const room = activeRooms[roomId];
            if (room) {
                const message = { senderId, text, timestamp: Date.now() };
                room.messages.push(message);
                console.log(`Message in room ${roomId} from ${senderId}: ${text}`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'Message sent' })
                };
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Room non trovata o non più attiva.' })
                };
            }
        }

        // --- Handle disconnect action (POST) ---
        if (action === 'disconnect' && roomId && disconnectUserId) {
            const room = activeRooms[roomId];
            if (room) {
                room.users = room.users.filter(id => id !== disconnectUserId);
                if (room.users.length === 0) {
                    delete activeRooms[roomId]; // Elimina la room se non ci sono più utenti
                    console.log(`Room ${roomId} eliminata.`);
                } else {
                    console.log(`Utente ${disconnectUserId} disconnesso da room ${roomId}. Rimangono: ${room.users.join(', ')}`);
                    // Potresti voler inviare un messaggio all'altro utente che il partner si è disconnesso
                    room.messages.push({ senderId: 'system', text: `Il tuo partner si è disconnesso.`, timestamp: Date.now() });
                }
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: 'Disconnected' })
                };
            } else {
                return {
                    statusCode: 200, // OK anche se la room non esiste più, perché l'utente voleva disconnettersi
                    body: JSON.stringify({ status: 'Room not found, already disconnected' })
                };
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Azione non valida o parametri mancanti.' })
    };
};

