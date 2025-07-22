// ✅ Collegamento al backend Socket.IO
const socket = io("https://chattingapp-backend.onrender.com");

// 🔄 Selettori DOM
const status = document.getElementById("status");
const chat = document.getElementById("chat");
const input = document.getElementById("input");

// 🔄 Stato connessione
let connected = false;

// 👂 Eventi dal server
socket.on("waiting", () => {
  status.textContent = "🔄 In attesa di un altro utente...";
  chat.style.display = "none";
  input.disabled = true;
});

socket.on("partner-found", () => {
  status.textContent = "✅ Connesso! Puoi iniziare a chattare.";
  chat.style.display = "block";
  input.disabled = false;
});

socket.on("message", (msg) => {
  const el = document.createElement("div");
  el.textContent = "👤 " + msg;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
});

socket.on("partner-disconnected", () => {
  status.textContent = "❌ Il tuo partner si è disconnesso.";
  input.disabled = true;
});

// 📤 Invio messaggi
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const msg = input.value.trim();
    if (msg) {
      const el = document.createElement("div");
      el.textContent = "🧑 Tu: " + msg;
      chat.appendChild(el);
      chat.scrollTop = chat.scrollHeight;

      socket.emit("message", msg);
      input.value = "";
    }
  }
});
