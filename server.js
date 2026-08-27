const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7
});

app.use(express.static('public'));

let connectedUsers = 0;

io.on('connection', (socket) => {
  connectedUsers++;
  io.emit('userCount', connectedUsers);

  socket.on('setPseudo', (pseudo) => {
    socket.pseudo = pseudo;
    io.emit('systemMessage', `${pseudo} a rejoint le chat.`);
  });

  socket.on('chatMessage', (data) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    io.emit('message', {
      pseudo: socket.pseudo || 'Anonyme',
      type: data.type,
      text: data.text,
      data: data.data,
      time: time
    });
  });

  socket.on('disconnect', () => {
    connectedUsers--;
    io.emit('userCount', connectedUsers);
    if (socket.pseudo) {
      io.emit('systemMessage', `${socket.pseudo} a quitté le chat.`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
