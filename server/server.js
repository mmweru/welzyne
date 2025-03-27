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

const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://welzyne.com',      // Your primary domain
      'https://www.welzyne.com',  // www subdomain
      'https://welzyne.onrender.com', // Fallback domain
      process.env.FRONTEND_URL    // From environment variable
    ].filter(Boolean)  // Remove any undefined values
  : [
      'http://localhost:5173',    // Vite dev server
      'http://localhost:3000',    // React dev server
      'http://localhost:5000',    // Typical backend server port
      'http://localhost:7001',    // Your current backend port
      process.env.FRONTEND_URL    // From environment variable
    ];

// Detailed CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed list
    if (corsOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin'
  ],
  optionsSuccessStatus: 200
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

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

//  uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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