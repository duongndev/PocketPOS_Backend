import {
  standardResponse,
  successResponse,
  errorResponse
} from "../utils/response.js";
import logger from "../utils/logger.util.js";

/**
 * Request logger middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
    
    logger.info(`[${logLevel}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    
    // Warn for slow requests
    if (duration > 3000) {
      logger.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  
  next();
};

/**
 * Request ID middleware
 */
const requestId = (req, res, next) => {
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
};

/**
 * Parse size string to bytes
 */
const parseSize = (size) => {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };

  const match = size.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
};

/**
 * Health check middleware
 */
const healthCheck = (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV || 'development'
  };
  
  return successResponse(res, 'Server is running', healthData);
};

/**
 * API version middleware
 */
const apiVersion = (version = 'v1') => {
  return (req, res, next) => {
    req.apiVersion = version;
    res.setHeader('API-Version', version);
    next();
  };
};

/**
 * Cache control middleware
 */
const cacheControl = (maxAge = 3600) => {
  return (req, res, next) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    next();
  };
};

/**
 * No cache middleware
 */
const noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};

/**
 * Maintenance mode middleware
 */
const maintenanceMode = (req, res, next) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    return standardResponse(res, 503, {
      success: false,
      message: 'System is under maintenance, please try again later.'
    });
  }
  next();
};

/**
 * Request timeout middleware
 */
const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        return errorResponse(res, 'Request timeout', 408);
      }
    }, timeout);
    
    res.on('finish', () => {
      clearTimeout(timer);
    });
    
    next();
  };
};

export {
  requestLogger,
  requestId,
  healthCheck,
  apiVersion,
  cacheControl,
  noCache,
  maintenanceMode,
  requestTimeout,
  parseSize
};