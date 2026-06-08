import express from 'express';
import connectDB from './config/db.config.js';
import { securityMiddleware } from './middlewares/securityHeaders.middleware.js';
import { generalRateLimit } from './middlewares/rateLimiting.middleware.js';
import { requestLogger } from './middlewares/requestLogger.middleware.js';
import { globalErrorHandler, handleNotFound } from './middlewares/errorHandler.middleware.js';
import { noSQLSanitizer, detectNoSQLInjection } from './middlewares/databaseSecurity.middleware.js';

const app = express();

// Connect to database
connectDB();

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Apply security middleware stack
app.use(securityMiddleware);

// Request logging
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Database security
app.use(noSQLSanitizer);
app.use(detectNoSQLInjection);

// Rate limiting
app.use(generalRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.API_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'connected'
  };
  
  res.status(200).json({
    success: true,
    data: healthData
  });
});

// API info endpoint
app.get('/', (req, res) => {
  const apiInfo = {
    name: 'PocketPOS Backend API',
    version: process.env.API_VERSION || '1.0.0',
    description: 'PocketPOS - Quản lý bán hàng Backend API',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      categories: {
        path: '/api/categories',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      products: {
        path: '/api/products',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      orders: {
        path: '/api/orders',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      auth: {
        path: '/api/auth',
        methods: ['POST']
      },
      stores: {
        path: '/api/stores',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    },
    documentation: '/api/docs',
    health: '/health'
  };
  
  res.status(200).json({
    success: true,
    data: apiInfo
  });
});

import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import orderRoutes from './routes/order.routes.js';
import statisticsRoutes from './routes/statistics.routes.js';
import webhookRoutes from './routes/webhook.route.js';

// API Routes with specific rate limiting
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/webhook', webhookRoutes);

// API documentation placeholder
app.get('/api/docs', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Documentation',
    data: {
      swagger: 'Coming soon',
      postman: 'Available in repository',
      version: process.env.API_VERSION || '1.0.0'
    }
  });
});

// 404 handler
app.use(handleNotFound);

// Global error handler
app.use(globalErrorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
