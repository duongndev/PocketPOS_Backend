import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cors from 'cors';
import { errorResponse } from "../utils/response.js";
import  { sanitizeObject, parseSize } from "../utils/utility.function.js";
import logger from '../utils/logger.util';

// CORS configuration
const corsConfig = cors({
  origin: function (origin, callback) {
    const isProd = process.env.NODE_ENV === 'production';
    // Allowed origins list
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // Allow requests with no or 'null' origin (mobile apps, Postman, file://, Electron)
    if (!origin || origin === 'null') return callback(null, true);

    // Allow any localhost/127.0.0.1 port in non-production
    try {
      const url = new URL(origin);
      const hostOk = ['localhost', '127.0.0.1'].includes(url.hostname);
      if (!isProd && hostOk) return callback(null, true);
    } catch (_) {}

    // Explicit allowlist match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, relax policy to avoid local tooling issues
    if (!isProd) {
      logger.warn(`[CORS] Cho phép origin trong development: ${origin}`);
      return callback(null, true);
    }

    logger.warn(`[CORS] Chặn origin: ${origin}`);
    callback(new Error('Không được phép bởi CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'set-cookie'],
  maxAge: 86400 // 24 hours
});

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Custom security headers middleware
const customSecurityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Prevent caching of sensitive endpoints
  if (req.path.includes('/api/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

// Rate limiting headers
const rateLimitHeaders = (req, res, next) => {
  // Add rate limit information to response headers before sending
  if (req.rateLimit && !res.headersSent) {
    res.setHeader('X-RateLimit-Limit', req.rateLimit.limit);
    res.setHeader('X-RateLimit-Remaining', req.rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', req.rateLimit.reset);
  }
  
  next();
};

// Security middleware stack
const securityMiddleware = [
  securityHeaders,
  corsConfig,
  customSecurityHeaders,
  rateLimitHeaders
];

// MongoDB injection prevention
const mongoSanitizer = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`[BẢO MẬT] Phát hiện nỗ lực tấn công NoSQL: ${key} từ IP: ${req.ip}`);
  }
});

// XSS protection middleware
const xssProtection = (req, res, next) => {
  // Use centralized sanitizeObject
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);

  next();
};

// Request size limiter middleware
const requestSizeLimiter = (maxSize = '10mb') => {
  const maxBytes = parseSize(maxSize, 10 * 1024 * 1024);

  return (req, res, next) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxBytes) {
      return errorResponse(res, `Kích thước payload yêu cầu vượt quá kích thước tối đa ${maxSize}`, 413);
    }
    
    next();
  };
};

// Request logging for security audit
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log sensitive operations
  const sensitiveEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/users',
    '/api/dashboard',
    '/api/admin'
  ];
  
  const isSensitive = sensitiveEndpoints.some(endpoint => 
    req.path.startsWith(endpoint)
  );
  
  if (isSensitive) {
    logger.info(`[KIỂM TRA BẢO MẬT] ${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);
  }
  
  // Log response time for monitoring
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 5000) { // Log slow requests
      logger.warn(`[HIỆU SUẤT] Yêu cầu chậm: ${req.method} ${req.path} - ${duration}ms - IP: ${req.ip}`);
    }
  });
  
  next();
};

// IP whitelist middleware (for admin endpoints)
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Trong development, cho phép localhost
    if (process.env.NODE_ENV === 'development') {
      const localhostIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
      if (localhostIPs.includes(clientIP)) {
        return next();
      }
    }
    
    if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
      return next();
    }
    
    logger.warn(`[BẢO MẬT] Chặn yêu cầu từ IP không được ủy quyền: ${clientIP}`);
    return errorResponse(res, 'Truy cập bị từ chối', 403);
  };
};

// Request method validation
const allowedMethods = (methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) => {
  return (req, res, next) => {
    if (!methods.includes(req.method)) {
      return errorResponse(res, 'Phương thức HTTP không được hỗ trợ', 405);
    }
    next();
  };
};

export {
  corsConfig,
  securityHeaders,
  mongoSanitizer,
  xssProtection,
  requestSizeLimiter,
  securityLogger,
  ipWhitelist,
  allowedMethods,
  securityMiddleware,
  customSecurityHeaders,
  rateLimitHeaders
};
