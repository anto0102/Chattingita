const socket = io("https://chattingapp-backend.onrender.com");

const status = document.getElementById('status');
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const inputArea = document.getElementById('inputArea');
const startBtn = document.getElementById('startBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const sendBtn = document.getElementById('sendBtn');
const onlineCount = document.getElementById('onlineCount');
const reportBtn = document.getElementById('reportBtn');

let connected = false;
let typingIndicator = null;
let chatLog = [];
let partnerIp = null;
let reportSent = false;

// Funzione per resettare lo stato della chat e dei bottoni
function resetChat() {
  chat.innerHTML = '';
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  chat.style.display = 'none'; // Nasconde l'area della chat
  inputArea.style.display = 'none'; // Nasconde l'area di input
  removeTypingIndicator();

  chatLog = [];
  partnerIp = null;
  reportSent = false;

  // Assicurati che StartBtn sia abilitato e gli altri disabilitati dopo un reset
  startBtn.disabled = false;
  disconnectBtn.disabled = true;
  reportBtn.disabled = true; // Segnala utente disabilitato se non c'è chat
}

// Funzione per aggiungere messaggi alla chat
function addMessage(text, isYou = false) {
  const msg = document.createElement('div');
  msg.className = 'message ' + (isYou ? 'you' : 'other');
  msg.textContent = (isYou ? '🧑 ' : '👤 ') + text;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;

  if (!isYou) {
    chatLog.push(text); // Memorizza solo i messaggi del partner per la segnalazione
  }
}

// Funzione per inviare un messaggio
function sendMessage() {
  const msg = input.value.trim();
  if (msg && connected) { // Invia solo se c'è testo e si è connessi
    addMessage(msg, true); // Aggiunge il messaggio del mittente alla chat
    socket.emit('message', msg);
    input.value = ''; // Pulisce l'input
    socket.emit('stop_typing'); // Notifica che non si sta più scrivendo
  }
}

// Funzione per mostrare l'indicatore di scrittura
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

// Funzione per rimuovere l'indicatore di scrittura
function removeTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.remove();
    typingIndicator = null;
  }
}

// --- Gestione Eventi Bottoni ---

// Evento click per il bottone "Inizia Chat"
startBtn.addEventListener('click', () => {
  if (!connected) { // Solo se non siamo già connessi
    socket.emit('start_chat');
    status.textContent = '🔄 In attesa di un altro utente...';
    startBtn.disabled = true; // Disabilita il bottone di inizio mentre si attende
    disconnectBtn.disabled = true; // Assicurati che disconnetti sia disabilitato in attesa
    reportBtn.disabled = true; // Assicurati che segnala sia disabilitato in attesa
  }
});

// Evento click per il bottone "Disconnetti"
disconnectBtn.addEventListener('click', () => {
  if (connected) { // Solo se siamo connessi
    socket.emit('disconnect_chat');
    status.textContent = '⛔ Disconnesso.';
    resetChat(); // Resetta lo stato della chat e dei bottoni
    connected = false;
  }
});

// Evento click per il bottone "Invia"
sendBtn.addEventListener('click', sendMessage);

// Evento keypress per l'input, per inviare con "Enter"
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Evento input per l'indicatore di scrittura (quando l'utente digita)
input.addEventListener('input', () => {
  if (!connected) return; // Non inviare l'evento se non si è connessi
  if (input.value.trim().length > 0) {
    socket.emit('typing');
  } else {
    socket.emit('stop_typing');
  }
});

// Evento click per il bottone "Segnala Utente"
reportBtn.addEventListener('click', () => {
  if (!connected || !partnerIp) { // Segnala solo se connessi e c'è un partner
    alert("Nessun partner da segnalare o non sei in chat.");
    return;
  }

  if (reportSent) {
    alert("Hai già segnalato questo utente. La segnalazione è in revisione.");
    return;
  }

  // Invia la segnalazione al server con l'IP del partner e lo storico della chat
  socket.emit("report_user", {
    partnerIp,
    chatLog,
  });
  alert("Segnalazione inviata con successo. La chat è stata disconnessa.");
  reportSent = true; // Imposta a true per evitare segnalazioni multiple
  
  // Disconnetti automaticamente dopo la segnalazione per proteggere l'utente
  socket.emit('disconnect_chat'); 
  status.textContent = '⛔ Utente segnalato e disconnesso.';
  resetChat();
  connected = false;
});

// --- Gestione Eventi Socket.IO ---

// Evento quando si è in attesa di un partner
socket.on('waiting', () => {
  status.textContent = '🔄 In attesa di un altro utente...';
  startBtn.disabled = true; // Assicurati che il bottone start sia disabilitato
  disconnectBtn.disabled = true;
  reportBtn.disabled = true;
});

// Evento quando viene trovato un partner (MATCH!)
socket.on('match', (data) => {
  status.textContent = '✅ Connesso! Puoi iniziare a chattare.';
  chat.style.display = 'flex'; // Mostra l'area della chat
  chat.style.flexDirection = 'column'; // Assicurati che sia una colonna per i messaggi
  inputArea.style.display = 'flex'; // Mostra l'area di input
  input.disabled = false;
  sendBtn.disabled = false;
  
  // ABILITA I BOTTONI DISCONNETTI E SEGNALA UTENTE QUANDO C'È UN MATCH
  disconnectBtn.disabled = false; 
  reportBtn.disabled = false;

  connected = true; // Imposta lo stato di connessione
  reportSent = false; // Resetta lo stato di segnalazione per la nuova chat

  if (data && data.partnerIp) {
    partnerIp = data.partnerIp; // Salva l'IP del partner per la segnalazione
  }
});

// Evento ricezione messaggio
socket.on('message', (msg) => {
  removeTypingIndicator(); // Rimuovi l'indicatore se il messaggio arriva
  addMessage(msg, false); // Aggiunge il messaggio del partner
});

// Evento indicatore di scrittura del partner
socket.on('typing', () => {
  showTypingIndicator();
});

// Evento fine indicatore di scrittura del partner
socket.on('stop_typing', () => {
  removeTypingIndicator();
});

// Evento quando il partner si disconnette
socket.on('partner_disconnected', () => {
  status.textContent = '❌ Il tuo partner si è disconnesso.';
  resetChat(); // Resetta tutto
  connected = false;
});

// Evento errore di connessione con il server Socket.IO
socket.on('connect_error', (err) => {
  status.textContent = '❌ Errore di connessione: ' + err.message + '. Riprova.';
  resetChat(); // Resetta tutto in caso di errore
  connected = false;
});

// Evento conteggio utenti online
socket.on('online_count', (count) => {
  onlineCount.textContent = count;
});

// Inizializza lo stato dei bottoni all'avvio della pagina
// (Chiamiamo resetChat una volta per impostare lo stato iniziale corretto)
document.addEventListener('DOMContentLoaded', resetChat);

