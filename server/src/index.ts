import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { config } from './config/env';
import { startSchedulers } from './services/scheduler';
import { db } from './db/supabase';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  // Verify Supabase connectivity by hitting users table head
  try {
    const { error } = await db().from('users').select('id', { head: true, count: 'exact' });
    if (error) throw error;
    console.log('Connected to Supabase');
  } catch (err) {
    console.error('Supabase connection error:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    startSchedulers();
  });
}

start();