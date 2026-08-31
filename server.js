const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Charger les utilisateurs
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

// Sauvegarder les utilisateurs
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Charger l'historique des messages
function loadMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

// Sauvegarder l'historique des messages
function saveMessages(messages) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

let users = loadUsers();
let messages = loadMessages();

// Inscription
app.post('/api/register', (req, res) => {
  const { identifier, username, password } = req.body;
  if (!identifier || !username || !password) {
    return res.status(400).json({ success: false, error: 'Champs manquants' });
  }

  const exists = users.find(u => u.identifier === identifier);
  if (exists) {
    return res.status(400).json({ success: false, error: 'Utilisateur existe déjà' });
  }

  const newUser = { identifier, username, password };
  users.push(newUser);
  saveUsers(users);

  res.json({ success: true, username: newUser.username });
});

// Connexion
app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body;
  const user = users.find(u => u.identifier === identifier && u.password === password);

  if (!user) {
    return res.status(400).json({ success: false, error: 'Identifiants incorrects' });
  }

  res.json({ success: true, username: user.username });
});

// Socket.io pour les messages et l'heure
io.on('connection', (socket) => {
  let currentUser = '';

  socket.on('join', (username) => {
    currentUser = username;
    // Envoyer l'historique des messages sauvegardés
    socket.emit('load-history', messages);
  });

  socket.on('chat-message', (data) => {
    // Calcul de l'heure exacte (format HH:MM)
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const msgObj = {
      user: currentUser || 'Anonyme',
      content: data.content || data.text || data,
      timestamp: timeStr
    };

    // Sauvegarde du message dans la mémoire et le fichier JSON
    messages.push(msgObj);
    saveMessages(messages);

    // Diffusion du message avec l'heure à tout le monde
    io.emit('chat-message', msgObj);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
