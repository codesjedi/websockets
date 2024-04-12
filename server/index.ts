import express from 'express';
import logger from 'morgan';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { createClient } from '@libsql/client';

const PORT = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {},
});

const db = createClient({
  url: 'libsql://socket-chat-learning-codesjedi.turso.io',
  authToken: process.env.DB_TOKEN,
});
await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    username TEXT
  );
`);
io.on('connection', async (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('A user has disconnected');
  });
  socket.on('chat message', async (msg, username) => {
    let result;
    try {
      result = await db.execute({
        sql: `INSERT INTO messages VALUES (:msg, :username);`,
        args: { msg },
      });
    } catch (error) {
      console.error(error);
      return;
    }
    io.emit('chat message', msg, result.lastInsertRowid?.toString(), username);
  });

  console.log(socket.handshake.auth);
  if (!socket.recovered) {
    try {
      const result = await db.execute({
        sql: `SELECT id, content, username FROM messages where id > ?`,
        args: [socket.handshake.auth.serverOffset ?? 0],
      });
      result.rows.forEach((row) => {
        socket.emit(
          'chat message',
          row.content,
          row.id?.toString(),
          row.username
        );
      });
    } catch (error) {
      console.error(error);
    }
  }
});

app.use(logger('dev'));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html');
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
