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
let typingTimeout = null;
let partnerTyping = false;

function resetChat() {
  chat.innerHTML = '';
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  chat.style.display = 'none';
  inputArea.style.display = 'none';
  clearTypingStatus();
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
    socket.emit('stop_typing');
  }
}

function clearTypingStatus() {
  if (partnerTyping) {
    status.textContent = status.textContent.replace('💬 Il tuo partner sta scrivendo...', '').trim();
    partnerTyping = false;
  }
}

// Eventi per gestire il "sta scrivendo"
input.addEventListener('input', () => {
  if (!connected) return;

  socket.emit('typing');

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stop_typing');
  }, 1000);
});

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
  addMessage(msg, false);
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

// Online users count
socket.on('online_count', (count) => {
  onlineCount.textContent = count;
});

// Nuovi eventi typing
socket.on('typing', () => {
  if (!partnerTyping) {
    status.textContent += ' 💬 Il tuo partner sta scrivendo...';
    partnerTyping = true;
  }
});

socket.on('stop_typing', () => {
  clearTypingStatus();
});
