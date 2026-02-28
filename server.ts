import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { initBot } from './bot';
import { handleWsConnection } from './ws';
import { createServer as createViteServer } from 'vite';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', handleWsConnection);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;

  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } else {
    console.warn('MONGODB_URI not set');
  }

  if (process.env.DISCORD_TOKEN) {
    await initBot();
  } else {
    console.warn('DISCORD_TOKEN not set');
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
