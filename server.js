const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Sert tous les fichiers statiques du dossier (index.html, manifest.json, etc.)
app.use(express.static(__dirname));

// Route de secours pour les autres URLs
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
