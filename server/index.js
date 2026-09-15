const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const db = require('./db');
const activitiesRouter = require('./routes/activities');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

app.use('/api/teams', require('./routes/teams')(io));
app.use('/api/activities', activitiesRouter);
app.use('/api/completions', require('./routes/completions')(io));
app.use('/api/transactions', require('./routes/transactions')(io));

app.use('/banking', express.static(path.join(__dirname, '..', 'public', 'banking')));
app.use('/leaderboard', express.static(path.join(__dirname, '..', 'public', 'leaderboard')));
app.use('/leader', express.static(path.join(__dirname, '..', 'public', 'leader')));

app.get('/', (req, res) => {
  res.redirect('/banking');
});

io.on('connection', (socket) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY balance DESC, name ASC').all();
  socket.emit('balance_update', teams);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Trading Game server listening on http://localhost:${PORT}`);
  console.log(`  Banking:    http://localhost:${PORT}/banking`);
  console.log(`  Leaderboard: http://localhost:${PORT}/leaderboard`);
  console.log(`  Leader:     http://localhost:${PORT}/leader`);
});
