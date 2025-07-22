const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
let waitingUser = null; // Coda semplice in RAM

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`🔌 Utente connesso: ${socket.id}`);

    // Se c'è già un utente in attesa, abbina
    if (waitingUser) {
        const partner = waitingUser;
        waitingUser = null;

        socket.partnerId = partner.id;
        partner.partnerId = socket.id;

        socket.emit('match', { partnerId: partner.id });
        partner.emit('match', { partnerId: socket.id });

        console.log(`🤝 Utenti abbinati: ${socket.id} ↔ ${partner.id}`);
    } else {
        // Altrimenti aspetta
        waitingUser = socket;
        socket.emit('waiting');
    }

    // Riceve messaggi e li inoltra
    socket.on('message', (msg) => {
        const partner = io.sockets.sockets.get(socket.partnerId);
        if (partner) {
            partner.emit('message', msg);
        }
    });

    // Se si disconnette, avvisa il partner
    socket.on('disconnect', () => {
        console.log(`❌ Disconnesso: ${socket.id}`);

        if (waitingUser === socket) {
            waitingUser = null;
        }

        const partner = io.sockets.sockets.get(socket.partnerId);
        if (partner) {
            partner.emit('partner_disconnected');
            partner.partnerId = null;
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server avviato su http://localhost:${PORT}`);
});
