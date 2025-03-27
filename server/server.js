import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
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

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Configure CORS origins
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL || 'https://your-frontend-url.vercel.app'] 
  : ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL];

// Security middleware
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

// Database connection
await dbConnect().then(() => {
  console.log('Database connected');
  initAdmin().catch(console.error);
}).catch(console.error);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Vercel route handler
export default app;

// // Optional: Separate server start for local development
// if (process.env.NODE_ENV !== 'production') {
//   const PORT = process.env.PORT || 7001;
//   app.listen(PORT, () => {
//     console.log(`Server running in development mode on port ${PORT}`);
//   });
// }