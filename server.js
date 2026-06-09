import http from 'http';
import app from './src/app.js';
import dotenv from 'dotenv';
import { initSocket } from './src/socket.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`PocketPOS Backend Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} for API information`);
});
