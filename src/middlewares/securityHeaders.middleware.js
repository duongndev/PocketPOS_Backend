import helmet from 'helmet';
import cors from 'cors';
import logger from '../utils/logger.util.js';

// CORS configuration optimized for PocketPOS
const corsOptions = {
  origin: function (origin, callback) {
    const isProd = process.env.NODE_ENV === 'production';
    
    // Allowed origins for PocketPOS application
    const allowedOrigins = [
      // Development environments
      'http://localhost:3000',    // React dev server
      'http://localhost:3001',    // Alternative port
      'http://localhost:5173',    // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      // Production frontend
      process.env.FRONTEND_URL,
      process.env.WEB_APP_URL,
      // Mobile app (if applicable)
      process.env.MOBILE_APP_URL
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, Postman, file://, Electron)
    if (!origin || origin === 'null') {
      return callback(null, true);
    }

    // Allow any localhost/127.0.0.1 port in development
    if (!isProd) {
      try {
        const url = new URL(origin);
        const hostOk = ['localhost', '127.0.0.1'].includes(url.hostname);
        if (hostOk) {
          return callback(null, true);
        }
      } catch (_) {
        // Invalid URL, continue to check allowed origins
      }
    }

    // Explicit allowlist match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn(`[CORS] Chặn origin: ${origin}`);
    callback(new Error('Không được phép bởi CORS'));
  },
  
  credentials: true, // Important for authentication cookies/tokens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-CSRF-Token',
    'X-Client-Version', // For mobile app versioning
    'X-Device-ID'       // For device tracking
  ],
  exposedHeaders: [
    'X-Total-Count',
    'set-cookie',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: 86400 // 24 hours cache for preflight requests
};

// Helmet configuration optimized for PocketPOS
const helmetOptions = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https:", 
        "blob:",
        "https://res.cloudinary.com", // For product images
        "https://images.unsplash.com"  // For placeholder images
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-eval'" // Required for some frontend frameworks
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  
  // Cross-origin policies
  crossOriginEmbedderPolicy: false, // Disabled for compatibility
  crossOriginResourcePolicy: { 
    policy: "cross-origin" 
  },
  
  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: process.env.NODE_ENV === 'production',
    preload: process.env.NODE_ENV === 'production'
  },
  
  // Other security headers
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { 
    policy: 'strict-origin-when-cross-origin' 
  },
  
  // Hide Express server info
  hidePoweredBy: true
};

// Custom security headers for PocketPOS
const customSecurityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy - restrict sensitive features
  res.setHeader('Permissions-Policy', 
    'geolocation=(), ' +
    'microphone=(), ' +
    'camera=(), ' +
    'payment=(), ' +
    'usb=(), ' +
    'magnetometer=(), ' +
    'gyroscope=(), ' +
    'accelerometer=()'
  );
  
  // Prevent caching of sensitive endpoints
  const sensitiveEndpoints = [
    '/api/auth',
    '/api/admin',
    '/api/payment',
    '/api/checkout'
  ];
  
  const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint => 
    req.path.startsWith(endpoint)
  );
  
  if (isSensitiveEndpoint) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  // Add API version header
  res.setHeader('X-API-Version', process.env.API_VERSION || 'v1');
  
  next();
};

// Rate limiting headers middleware
const rateLimitHeaders = (req, res, next) => {
  // Add rate limit information to response headers
  if (req.rateLimit && !res.headersSent) {
    res.setHeader('X-RateLimit-Limit', req.rateLimit.limit);
    res.setHeader('X-RateLimit-Remaining', req.rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', req.rateLimit.reset);
    
    // Log rate limit status for monitoring
    if (req.rateLimit.remaining <= 5) {
      logger.warn('CẢNH BÁO GIỚI HẠN', {
        ip: req.ip,
        endpoint: req.originalUrl,
        remaining: req.rateLimit.remaining,
        limit: req.rateLimit.limit
      });
    }
  }
  
  next();
};

// Cookie security middleware
const cookieSecurityMiddleware = (req, res, next) => {
  const originalCookie = res.cookie;
  
  res.cookie = function(name, value, options = {}) {
    const secureOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours default
      ...options
    };
    
    // Enhanced security for authentication-related cookies
    if (name.includes('token') || name.includes('session') || name.includes('auth')) {
      secureOptions.httpOnly = true;
      secureOptions.secure = process.env.NODE_ENV === 'production';
      secureOptions.sameSite = 'strict';
      
      // Log cookie creation for security audit
      logger.info('ĐẶT COOKIE BẢO MẬT', {
        cookieName: name,
        secure: secureOptions.secure,
        httpOnly: secureOptions.httpOnly,
        sameSite: secureOptions.sameSite,
        maxAge: secureOptions.maxAge
      });
    }
    
    return originalCookie.call(this, name, value, secureOptions);
  };
  
  next();
};

// Clear insecure cookies middleware
const clearInsecureCookies = (req, res, next) => {
  if (req.cookies && typeof req.cookies === 'object') {
    const cookiesToCheck = [
      'connect.sid', 
      'sessionId', 
      'token', 
      'auth',
      'jwt_token',
      'access_token',
      'refresh_token'
    ];
    
    cookiesToCheck.forEach(cookieName => {
      if (req.cookies[cookieName]) {
        res.clearCookie(cookieName, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
      }
    });
  }
  
  next();
};

// Security middleware stack - optimized order
const securityMiddleware = [
  helmet(helmetOptions),
  cors(corsOptions),
  customSecurityHeaders,
  rateLimitHeaders,
  cookieSecurityMiddleware
];

// Export all security components
export {
  corsOptions,
  helmetOptions,
  customSecurityHeaders,
  rateLimitHeaders,
  cookieSecurityMiddleware,
  clearInsecureCookies,
  securityMiddleware
};
