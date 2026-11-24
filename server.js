const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.all('/api/game/start', require('./api/game/start'));
app.all('/api/game/guess', require('./api/game/guess'));
app.all('/api/ranking', require('./api/ranking'));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
