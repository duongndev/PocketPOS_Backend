import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.util.js';

// Store for tracking failed attempts
const failedAttempts = new Map();

// General API rate limiter
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per windowMs
  message: {
    error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau.',
    retryAfter: '15 phút'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Vượt giới hạn yêu cầu cho IP: ${req.ip}`);
    return errorResponse(res, 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau.', 429);
  }
});


// API key rate limiter (for authenticated users)
export const apiKeyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Higher limit for authenticated users
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP with IPv6 support
    return req.user?.id || ipKeyGenerator(req);
  },
  message: {
    error: 'Vượt giới hạn API cho tài khoản của bạn.',
    retryAfter: '1 giờ'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Vượt giới hạn API cho người dùng: ${req.user?.id}`);
    return errorResponse(res, 'Vượt giới hạn API cho tài khoản của bạn.', 429);
  }
});

// Slow down middleware for progressive delays
export const progressiveSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  // express-slow-down v2 changed the semantics of delayMs. To preserve the
  // previous behavior (add 500ms per extra request after delayAfter), provide
  // a function that receives (used, req) and returns the computed delay.
  delayMs: (used, req) => {
    const delayAfter = req?.slowDown?.limit ?? 50;
    const extra = Math.max(0, used - delayAfter);
    return Math.min(extra * 500, 20000); // cap at maxDelayMs
  },
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  // Note: onLimitReached is deprecated, logging moved to custom middleware
});

// Adaptive rate limiter based on failed attempts
export const adaptiveRateLimit = (req, res, next) => {
  const clientId = req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  // Clean old entries
  for (const [key, data] of failedAttempts.entries()) {
    if (now - data.firstAttempt > windowMs) {
      failedAttempts.delete(key);
    }
  }
  
  const attempts = failedAttempts.get(clientId);
  
  if (attempts) {
    // Calculate dynamic limit based on failed attempts
    const baseLimit = 100;
    const reductionFactor = Math.min(attempts.count * 0.1, 0.8); // Max 80% reduction
    const dynamicLimit = Math.floor(baseLimit * (1 - reductionFactor));
    
    if (attempts.count >= dynamicLimit) {
      return errorResponse(res, 'Too many failed attempts from this IP, please try again after 15 minutes.', 429);
    }
  }
  
  next();
};

// Track failed authentication attempts
export const trackFailedAttempts = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if this is a failed authentication attempt
    if (res.statusCode === 401 || res.statusCode === 403) {
      const clientId = req.ip;
      const now = Date.now();
      
      const attempts = failedAttempts.get(clientId) || {
        count: 0,
        firstAttempt: now
      };
      
      attempts.count++;
      attempts.lastAttempt = now;
      
      failedAttempts.set(clientId, attempts);
      
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// DDoS protection middleware
export const ddosProtection = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Very strict limit for potential DDoS
  message: {
    error: 'Phát hiện tấn công DDoS. Chặn truy cập tạm thời.',
    retryAfter: '1 phút'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Phát hiện tấn công DDoS từ IP: ${req.ip}`); 
    return errorResponse(res, 'Phát hiện tấn công DDoS. Chặn truy cập tạm thời.', 429);
  }
});

// Burst protection for specific endpoints
export const burstProtection = rateLimit({
  windowMs: 1000, // 1 second
  max: 10, // Max 10 requests per second 
  message: {
    error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 1 giây.',
    retryAfter: '1 giây'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Kích hoạt bảo vệ burst cho IP: ${req.ip}`);  
    return errorResponse(res, 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 1 giây.', 429);
  }
});


// Search limiter - 30 requests per minute
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: {
    error: 'Quá nhiều yêu cầu tìm kiếm từ IP này, vui lòng thử lại sau 1 phút',
    retryAfter: '1 phút'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Vượt giới hạn tìm kiếm cho IP: ${req.ip}`);
    return errorResponse(res, 'Quá nhiều yêu cầu tìm kiếm từ IP này, vui lòng thử lại sau 1 phút', 429);
  }
});


// Clean up failed attempts periodically
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    for (const [key, data] of failedAttempts.entries()) {
      if (now - data.firstAttempt > windowMs) {
        failedAttempts.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}