import express from 'express';
import cors from 'cors';
import { seedDatabase } from './database.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import sellerRoutes from './routes/seller.js';
import resellerRoutes from './routes/reseller.js';
import clientRoutes from './routes/client.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend connection (support wildcards for development, custom hosts in production)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/reseller', resellerRoutes);
app.use('/api/client', clientRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({
    name: 'Auth Licensing API',
    status: 'online',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start Server after seeding database
async function startServer() {
  try {
    await seedDatabase();
    app.listen(PORT, () => {
      console.log(`[Server] Auth Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

startServer();
