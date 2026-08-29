const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Anti-cache : Oblige l'application Android/WebView à toujours recharger la dernière version
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(__dirname));

let messages = [];
if (fs.existsSync(MESSAGES_FILE)) {
  try {
    messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch (err) {
    messages = [];
  }
}

io.on('connection', (socket) => {
  let currentUser = '';

  socket.emit('load-history', messages);

  socket.on('join', (username) => {
    currentUser = username;
    io.emit('system-message', `${currentUser} a rejoint le chat.`);
  });

  socket.on('chat-message', (text) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgData = {
      user: currentUser || 'Anonyme',
      text: text,
      timestamp: timeStr
    };

    messages.push(msgData);
    if (messages.length > 100) messages.shift();

    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    } catch (err) {}

    io.emit('chat-message', msgData);
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      io.emit('system-message', `${currentUser} a quitté le chat.`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
