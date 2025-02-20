// server/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dbConnect from './config/dbConnect.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { initAdmin } from './scripts/initAdmin.js';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables based on NODE_ENV
dotenv.config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});

// Initialize express app
const app = express();
const httpServer = createServer(app);

// Configure CORS origins based on environment
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL] 
  : ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL];

// Initialize Socket.IO with environment-specific config
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// Socket.IO connection handling with environment-specific logging
io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Client connected:', socket.id);
  }
  
  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Client disconnected:', socket.id);
    }
  });
});

// Broadcast function with optional development logging
export const broadcast = (data) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Broadcasting:', data);
  }
  io.emit('update', data);
};

// Security middleware with environment-specific settings
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*"],
      connectSrc: ["'self'", ...corsOrigins],
    }
  }
}));

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS configuration
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Database connection with environment-specific logging
dbConnect().then(() => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Database connected to:', process.env.MONGODB_URI);
  } else {
    console.log('Database connected');
  }
  initAdmin().catch(console.error);
}).catch(console.error);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);

// Error handling middleware with environment-specific error messages
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  }
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Health check endpoint with environment info
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 7001;
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`API Base URL: ${process.env.BASE_URL}`);
    }
  });
}

export default app;