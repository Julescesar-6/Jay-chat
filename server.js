const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Gestion du temps réel
io.on('connection', (socket) => {
  socket.on('join', (username) => {
    socket.username = username;
    io.emit('system-message', `${username} a rejoint le chat`);
  });

  socket.on('chat-message', (data) => {
    io.emit('chat-message', {
      user: socket.username || 'Anonyme',
      text: data
    });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('system-message', `${socket.username} a quitté le chat`);
    }
  });
});

server.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
