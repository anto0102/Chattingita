// Sostituisci con il tuo backend se diverso
const socket = io("https://chattingapp-backend.onrender.com");

const status = document.getElementById('status');
const chat = document.getElementById('chat');
const input = document.getElementById('input');

const startBtn = document.getElementById('startBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const sendBtn = document.getElementById('sendBtn');

let connected = false;

function resetChat() {
  chat.innerHTML = '';
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  chat.style.display = 'none';
}

function sendMessage() {
  const msg = input.value.trim();
  if (msg && connected) {
    const el = document.createElement('div');
    el.textContent = '🧑 Tu: ' + msg;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;

    socket.emit('message', msg);
    input.value = '';
  }
}

startBtn.addEventListener('click', () => {
  console.log("▶ Bottone cliccato");
  if (!connected) {
    socket.emit('start_chat');
    status.textContent = '🔄 In attesa di un altro utente...';
    startBtn.disabled = true;
  }
});

disconnectBtn.addEventListener('click', () => {
  if (connected) {
    socket.emit('disconnect_chat');
    status.textContent = '⛔ Disconnesso.';
    resetChat();
    connected = false;
    startBtn.disabled = false;
    disconnectBtn.disabled = true;
  }
});

sendBtn.addEventListener('click', sendMessage);

input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Eventi socket
socket.on('waiting', () => {
  status.textContent = '🔄 In attesa di un altro utente...';
});

socket.on('match', () => {
  status.textContent = '✅ Connesso! Puoi iniziare a chattare.';
  chat.style.display = 'block';
  input.disabled = false;
  sendBtn.disabled = false;
  disconnectBtn.disabled = false;
  connected = true;
});

socket.on('message', (msg) => {
  const el = document.createElement('div');
  el.textContent = '👤 ' + msg;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
});

socket.on('partner_disconnected', () => {
  status.textContent = '❌ Il tuo partner si è disconnesso.';
  resetChat();
  connected = false;
  startBtn.disabled = false;
  disconnectBtn.disabled = true;
});

socket.on('connect_error', (err) => {
  status.textContent = '❌ Errore di connessione: ' + err.message;
  resetChat();
  connected = false;
  startBtn.disabled = false;
  disconnectBtn.disabled = true;
});
