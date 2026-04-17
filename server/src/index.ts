import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import routes from './routes';
import { config } from './config/env';
import { startSchedulers } from './services/scheduler';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Connect to MongoDB and start server
mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
      startSchedulers();
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
