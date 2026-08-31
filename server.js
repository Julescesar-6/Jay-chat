const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
// Limite augmentée à 50 Mo pour autoriser l'envoi de fichiers et vocaux
const io = new Server(server, {
  maxHttpBufferSize: 1e7
});

const PORT = process.env.PORT || 3000;
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(__dirname));

let messages = [];
if (fs.existsSync(MESSAGES_FILE)) {
  try { messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch (err) { messages = []; }
}

let users = {};
if (fs.existsSync(USERS_FILE)) {
  try { users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (err) { users = {}; }
}

app.post('/api/register', (req, res) => {
  const { identifier, username, password } = req.body;
  if (!identifier || !username || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  
  const cleanId = identifier.trim().toLowerCase();
  if (users[cleanId]) {
    return res.status(400).json({ error: 'Ce numéro ou cet e-mail est déjà utilisé.' });
  }

  users[cleanId] = { username: username.trim(), password: password };
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return res.json({ success: true, username: username.trim() });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body;
  const cleanId = (identifier || '').trim().toLowerCase();
  
  const userAccount = users[cleanId];
  if (!userAccount || userAccount.password !== password) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
  }

  return res.json({ success: true, username: userAccount.username });
});

io.on('connection', (socket) => {
  let currentUser = '';

  socket.emit('load-history', messages);

  socket.on('join', (username) => {
    currentUser = username;
    io.emit('system-message', `${currentUser} a rejoint le chat.`);
  });

  socket.on('chat-message', (data) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let msgData = {
      user: currentUser || 'Anonyme',
      timestamp: timeStr
    };

    if (typeof data === 'object') {
      msgData.type = data.type || 'text';
      msgData.content = data.content || '';
      if (data.fileName) msgData.fileName = data.fileName;
    } else {
      msgData.type = 'text';
      msgData.content = data;
    }

    messages.push(msgData);
    if (messages.length > 50) messages.shift();

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
