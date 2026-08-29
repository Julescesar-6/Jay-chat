const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Charger les messages existants
let messagesHistory = [];
if (fs.existsSync(MESSAGES_FILE)) {
  try {
    const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
    messagesHistory = JSON.parse(data);
  } catch (err) {
    console.error("Erreur de lecture de l'historique:", err);
    messagesHistory = [];
  }
}

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Gestion Socket.IO
io.on('connection', (socket) => {
  
  socket.on('join', (username) => {
    socket.username = username;
    
    // 1. Envoyer tout l'historique des anciens messages au nouvel arrivant
    socket.emit('load-history', messagesHistory);
    
    // 2. Annoncer l'arrivée du nouvel utilisateur aux autres
    io.emit('system-message', `${username} a rejoint le chat`);
  });

  socket.on('chat-message', (text) => {
    const messageData = {
      user: socket.username || 'Anonyme',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Ajouter à l'historique en mémoire
    messagesHistory.push(messageData);

    // Limiter l'historique aux 100 derniers messages pour garder l'application rapide
    if (messagesHistory.length > 100) {
      messagesHistory.shift();
    }

    // Sauvegarder dans le fichier JSON sur le serveur
    fs.writeFile(MESSAGES_FILE, JSON.stringify(messagesHistory, null, 2), (err) => {
      if (err) console.error("Erreur de sauvegarde:", err);
    });

    // Diffuser le message à TOUT LE MONDE
    io.emit('chat-message', messageData);
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('system-message', `${socket.username} a quitté le chat`);
    }
  });
});

server.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
