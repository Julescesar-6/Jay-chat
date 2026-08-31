const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------------
// CONFIGURATION DE L'ENVOI D'EMAIL (A REMPLACER PAR VOS ACCÈS)
// ------------------------------------------------------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'VOTRE_EMAIL@gmail.com',       // Remplacer par votre Gmail
    pass: 'VOTRE_MOT_DE_PASSE_APPLICATION' // Mot de passe d'application Gmail
  }
});

// Stockage temporaire en mémoire
const users = {}; 
const pendingVerifications = {}; 
const chatHistory = [];

// Fonction pour générer et envoyer le code OTP
async function sendOTPCode(identifier, username, password) {
  // Générer un code à 6 chiffres
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Stocker ou mettre à jour la demande (valide 5 minutes)
  pendingVerifications[identifier] = {
    username: username || pendingVerifications[identifier]?.username,
    password: password || pendingVerifications[identifier]?.password,
    code,
    expiresAt: Date.now() + 5 * 60 * 1000 
  };

  // Si l'identifiant est un e-mail, envoyer le mail réel
  if (identifier.includes('@')) {
    const mailOptions = {
      from: '"JAY Chat Security" <VOTRE_EMAIL@gmail.com>',
      to: identifier,
      subject: 'Votre code de vérification JAY Chat',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0b141a; color: #e9edef;">
          <h2 style="color: #00a884;">JAY Chat</h2>
          <p>Voici votre code de vérification pour confirmer votre compte :</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #00a884; padding: 10px 0;">
            ${code}
          </div>
          <p>Ce code expire dans 5 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } else {
    // Si c'est un numéro de téléphone, l'intégration SMS (Twilio) irait ici.
    console.log(`[SMS OTP non configuré] Code pour ${identifier} : ${code}`);
  }

  return code;
}

// API : Demander/Renvoyer un code OTP
app.post('/api/request-code', async (req, res) => {
  const { identifier, username, password } = req.body;

  if (!identifier) {
    return res.json({ success: false, error: 'Identifiant requis.' });
  }

  if (users[identifier]) {
    return res.json({ success: false, error: 'Ce compte existe déjà.' });
  }

  try {
    await sendOTPCode(identifier, username, password);
    return res.json({ success: true, message: 'Le code a été envoyé avec succès.' });
  } catch (err) {
    console.error(err);
    return res.json({ success: false, error: "Erreur lors de l'envoi du mail/SMS." });
  }
});

// API : Valider le code OTP
app.post('/api/verify-code', (req, res) => {
  const { identifier, code } = req.body;
  const pending = pendingVerifications[identifier];

  if (!pending) {
    return res.json({ success: false, error: 'Aucune demande en cours.' });
  }

  if (Date.now() > pending.expiresAt) {
    delete pendingVerifications[identifier];
    return res.json({ success: false, error: 'Code expiré. Veuillez cliquer sur "Renvoyer".' });
  }

  if (pending.code !== code.trim()) {
    return res.json({ success: false, error: 'Code incorrect.' });
  }

  // Création définitive du compte
  users[identifier] = {
    username: pending.username,
    password: pending.password
  };

  delete pendingVerifications[identifier];
  return res.json({ success: true, username: users[identifier].username });
});

// API : Connexion classique
app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body;
  const user = users[identifier];

  if (!user || user.password !== password) {
    return res.json({ success: false, error: 'Identifiant ou mot de passe incorrect.' });
  }

  return res.json({ success: true, username: user.username });
});

// WebSockets (Chat & Appels)
io.on('connection', (socket) => {
  socket.on('join', (username) => {
    socket.username = username;
    socket.emit('load-history', chatHistory);
  });

  socket.on('chat-message', (data) => {
    const msgData = {
      user: socket.username || 'Anonyme',
      content: data.content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    chatHistory.push(msgData);
    if (chatHistory.length > 100) chatHistory.shift();
    io.emit('chat-message', msgData);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
