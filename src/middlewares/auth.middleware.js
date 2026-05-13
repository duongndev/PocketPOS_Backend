import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.util.js';

// ===== JWT CONFIGURATION =====

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// ===== TOKEN GENERATION =====

/**
 * Generate access token
 * @param {Object} payload - Token payload
 * @returns {String} JWT token
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * Generate refresh token
 * @param {Object} payload - Token payload
 * @returns {String} JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN
  });
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object containing accessToken and refreshToken
 */
export const generateTokens = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};

// ===== TOKEN VERIFICATION =====

/**
 * Verify JWT token
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token đã hết hạn');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Token không hợp lệ');
    }
    throw error;
  }
};

// ===== AUTHENTICATION MIDDLEWARE =====

/**
 * Authenticate user using JWT token
 * Checks Authorization header for Bearer token
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path
      });
      return errorResponse(res, 'Không tìm thấy token xác thực. Vui lòng đăng nhập.', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    // Find user by ID
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      logger.warn('Authentication failed: User not found', {
        userId: decoded.userId,
        ip: req.ip
      });
      return errorResponse(res, 'Người dùng không tồn tại', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('Authentication failed: User is inactive', {
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
      return errorResponse(res, 'Tài khoản đã bị vô hiệu hóa', 401);
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id;

    logger.info('Authentication successful', {
      userId: user._id,
      email: user.email,
      role: user.role,
      ip: req.ip,
      path: req.path
    });

    next();

  } catch (error) {
    logger.error('Authentication error', {
      error: error.message,
      ip: req.ip,
      path: req.path
    });

    if (error.message === 'Token đã hết hạn') {
      return errorResponse(res, 'Token đã hết hạn. Vui lòng đăng nhập lại.', 401);
    }

    if (error.message === 'Token không hợp lệ') {
      return errorResponse(res, 'Token không hợp lệ. Vui lòng đăng nhập lại.', 401);
    }

    return errorResponse(res, 'Xác thực thất bại', 401);
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');

    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
    }

    next();

  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

// ===== AUTHORIZATION MIDDLEWARE =====

/**
 * Check if user has specific role
 * @param {...String} roles - Allowed roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Chưa xác thực', 401);
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        ip: req.ip,
        path: req.path
      });
      return errorResponse(res, 'Bạn không có quyền thực hiện hành động này', 403);
    }

    next();
  };
};

/**
 * Check if user is admin
 */
export const isAdmin = authorize('admin');

/**
 * Check if user is admin or manager
 */
export const canManage = authorize('admin', 'manager');

/**
 * Check if user is admin, manager, or cashier
 */
export const canSell = authorize('admin', 'manager', 'cashier');

/**
 * Check if user has specific permission
 * @param {String} permission - Required permission
 */
export const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Chưa xác thực', 401);
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has the specific permission
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }

    logger.warn('Authorization failed: Missing permission', {
      userId: req.user._id,
      userRole: req.user.role,
      requiredPermission: permission,
      ip: req.ip,
      path: req.path
    });

    return errorResponse(res, 'Bạn không có quyền thực hiện hành động này', 403);
  };
};

// ===== RATE LIMITING BY USER =====

/**
 * Rate limiting middleware based on user ID
 * Uses in-memory storage for simplicity
 * For production, consider using Redis
 */
const userRequestCounts = new Map();
const USER_RATE_LIMIT = 100; // requests per minute
const USER_RATE_WINDOW = 60 * 1000; // 1 minute

export const userRateLimit = (req, res, next) => {
  if (!req.user) {
    return next(); // Skip if not authenticated
  }

  const userId = req.user._id.toString();
  const now = Date.now();

  // Clean up old entries
  for (const [key, value] of userRequestCounts.entries()) {
    if (now - value.timestamp > USER_RATE_WINDOW) {
      userRequestCounts.delete(key);
    }
  }

  // Get or create user request count
  const userCount = userRequestCounts.get(userId) || { count: 0, timestamp: now };

  // Check if rate limit exceeded
  if (userCount.count >= USER_RATE_LIMIT) {
    logger.warn('User rate limit exceeded', {
      userId: userId,
      count: userCount.count,
      ip: req.ip,
      path: req.path
    });
    return errorResponse(res, 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', 429);
  }

  // Increment count
  userRequestCounts.set(userId, {
    count: userCount.count + 1,
    timestamp: now
  });

  next();
};

// ===== EXPORT ALL =====

export default {
  authenticate,
  optionalAuth,
  authorize,
  isAdmin,
  canManage,
  canSell,
  hasPermission,
  userRateLimit,
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyToken
};
