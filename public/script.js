const socket = io("https://chattingapp-backend.onrender.com");

const status = document.getElementById('status');
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const startBtn = document.getElementById('startBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const sendBtn = document.getElementById('sendBtn');
const onlineCounter = document.getElementById('onlineCounter');

let connected = false;

function resetChat() {
  chat.innerHTML = '';
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  chat.classList.add("hidden");
}

startBtn.addEventListener('click', () => {
  socket.emit('start_chat');
  status.textContent = '🔄 In attesa di un altro utente...';
  startBtn.disabled = true;
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
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const msg = input.value.trim();
  if (msg && connected) {
    appendMessage('🧑 Tu: ' + msg);
    socket.emit('message', msg);
    input.value = '';
  }
}

function appendMessage(text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.className = "chat-message";
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

socket.on('waiting', () => {
  status.textContent = '🔄 In attesa di un altro utente...';
});

socket.on('partner-found', () => {
  status.textContent = '✅ Connesso! Puoi iniziare a chattare.';
  chat.classList.remove("hidden");
  input.disabled = false;
  sendBtn.disabled = false;
  disconnectBtn.disabled = false;
  connected = true;
});

socket.on('message', (msg) => {
  appendMessage('👤 ' + msg);
});

socket.on('partner-disconnected', () => {
  status.textContent = '❌ Il tuo partner si è disconnesso.';
  resetChat();
  connected = false;
  startBtn.disabled = false;
  disconnectBtn.disabled = true;
});

socket.on('online-count', (count) => {
  onlineCounter.textContent = `🟢 Utenti online: ${count}`;
});

socket.on('connect_error', (err) => {
  status.textContent = '❌ Errore di connessione: ' + err.message;
  resetChat();
  connected = false;
  startBtn.disabled = false;
  disconnectBtn.disabled = true;
});
