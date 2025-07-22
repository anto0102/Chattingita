const socket = io("https://chattingapp-backend.onrender.com");

const status = document.getElementById('status');
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const inputArea = document.getElementById('inputArea');
const startBtn = document.getElementById('startBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const sendBtn = document.getElementById('sendBtn');
const onlineCount = document.getElementById('onlineCount');

let connected = false;
let typingIndicator = null;

function resetChat() {
  chat.innerHTML = '';
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  chat.style.display = 'none';
  inputArea.style.display = 'none';
  removeTypingIndicator();
}

function addMessage(text, isYou = false) {
  const msg = document.createElement('div');
  msg.className = 'message ' + (isYou ? 'you' : 'other');
  msg.textContent = (isYou ? '🧑 ' : '👤 ') + text;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function sendMessage() {
  const msg = input.value.trim();
  if (msg && connected) {
    addMessage(msg, true);
    socket.emit('message', msg);
    input.value = '';
    socket.emit('stop_typing'); // stop typing when message sent
  }
}

// Mostra "Il partner sta scrivendo..."
function showTypingIndicator() {
  if (!typingIndicator) {
    typingIndicator = document.createElement('div');
    typingIndicator.id = 'typingIndicator';
    typingIndicator.style.fontStyle = 'italic';
    typingIndicator.style.fontSize = '0.9rem';
    typingIndicator.style.color = '#666';
    typingIndicator.textContent = '💬 Il partner sta scrivendo...';
    chat.appendChild(typingIndicator);
    chat.scrollTop = chat.scrollHeight;
  }
}

// Rimuove l'indicatore di scrittura
function removeTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.remove();
    typingIndicator = null;
  }
}

startBtn.addEventListener('click', () => {
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
  if (e.key === 'Enter') sendMessage();
});

// Gestione eventi typing
input.addEventListener('input', () => {
  if (!connected) return;
  if (input.value.trim().length > 0) {
    socket.emit('typing');
  } else {
    socket.emit('stop_typing');
  }
});

// === SOCKET EVENTS ===

socket.on('waiting', () => {
  status.textContent = '🔄 In attesa di un altro utente...';
});

socket.on('match', () => {
  status.textContent = '✅ Connesso! Puoi iniziare a chattare.';
  chat.style.display = 'flex';
  chat.style.flexDirection = 'column';
  inputArea.style.display = 'flex';
  input.disabled = false;
  sendBtn.disabled = false;
  disconnectBtn.disabled = false;
  connected = true;
});

socket.on('message', (msg) => {
  removeTypingIndicator();
  addMessage(msg, false);
});

socket.on('typing', () => {
  showTypingIndicator();
});

socket.on('stop_typing', () => {
  removeTypingIndicator();
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

// ✅ ONLINE USERS COUNT
socket.on('online_count', (count) => {
  onlineCount.textContent = count;
});
