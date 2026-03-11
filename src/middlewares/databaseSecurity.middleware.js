import { errorResponse } from "../utils/response.js";
import logger from '../utils/logger.util.js';

// NoSQL injection prevention middleware - custom implementation for Express 5 compatibility
const noSQLSanitizer = (req, res, next) => {
  try {
    const sanitizeValue = (value) => {
      if (typeof value === 'string') {
        // Replace MongoDB operators
        return value.replace(/\$/g, '_');
      }
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const sanitized = {};
        for (const [key, val] of Object.entries(value)) {
          // Skip keys that start with $ (MongoDB operators)
          if (!key.startsWith('$')) {
            sanitized[key] = sanitizeValue(val);
          } else {
            logger.warn('THỬ LỖNG TẤN CÔNG NOSQL', {
              sanitizedKey: key,
              originalValue: val,
              endpoint: req.originalUrl,
              method: req.method
            });
          }
        }
        return sanitized;
      }
      if (Array.isArray(value)) {
        return value.map(item => sanitizeValue(item));
      }
      return value;
    };

    // Sanitize request body - only if it exists and is mutable
    if (req.body && typeof req.body === 'object') {
      try {
        const sanitizedBody = sanitizeValue(req.body);
        // Try to assign, but don't fail if it's read-only
        req.body = sanitizedBody;
      } catch (bodyError) {
        logger.warn('Không thể sanitize req.body', {
          error: bodyError.message
        });
      }
    }

    // For Express 5, req.query is read-only, so we need to work with a copy
    // and use it in our controllers instead of trying to modify req.query
    if (req.query && typeof req.query === 'object') {
      try {
        // Create a sanitized copy and store it for later use
        req.sanitizedQuery = sanitizeValue(req.query);
      } catch (queryError) {
        logger.warn('Không thể sanitize req.query', {
          error: queryError.message
        });
        req.sanitizedQuery = req.query; // Fallback to original
      }
    }

    // Sanitize route parameters - only if it exists and is mutable
    if (req.params && typeof req.params === 'object') {
      try {
        const sanitizedParams = sanitizeValue(req.params);
        // Try to assign, but don't fail if it's read-only
        req.params = sanitizedParams;
      } catch (paramsError) {
        logger.warn('Không thể sanitize req.params', {
          error: paramsError.message
        });
      }
    }

    next();
  } catch (error) {
    logger.error('LỖI SANITIZE NOSQL', {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params
    });
    next();
  }
};

// Advanced NoSQL injection detection
const detectNoSQLInjection = async (req, res, next) => {
  const dangerousPatterns = [
    /\$where/i,
    // Removed standard operators to avoid false positives in text content
    // as keys are already sanitized by mongoSanitize
    /javascript:/i,
    /eval\s*\(/i,
    /function\s*\(/i
  ];

  const checkForNoSQLInjection = (value) => {
    if (typeof value !== 'string') return false;
    return dangerousPatterns.some(pattern => pattern.test(value));
  };

  const checkObject = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check key names for injection patterns
      if (checkForNoSQLInjection(key)) {
        return { detected: true, field: currentPath, value: key, type: 'key' };
      }
      
      // Check string values
      if (typeof value === 'string' && checkForNoSQLInjection(value)) {
        return { detected: true, field: currentPath, value, type: 'value' };
      } 
      
      // Recursively check nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const result = checkObject(value, currentPath);
        if (result.detected) return result;
      }
      
      // Check arrays
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] === 'string' && checkForNoSQLInjection(value[i])) {
            return { detected: true, field: `${currentPath}[${i}]`, value: value[i], type: 'array_value' };
          }
          if (typeof value[i] === 'object' && value[i] !== null) {
            const result = checkObject(value[i], `${currentPath}[${i}]`);
            if (result.detected) return result;
          }
        }
      }
    }
    return { detected: false };
  };

  try {
    // Check body, query, and params
    const sources = [
      { data: req.body, name: 'body' },
      { data: req.sanitizedQuery || req.query, name: 'query' },
      { data: req.params, name: 'params' }
    ];

    for (const source of sources) {
      if (source.data && typeof source.data === 'object') {
        const result = checkObject(source.data);
        if (result.detected) {
          logger.warn('PHÁT HIỆN TẤN CÔNG NOSQL', {
            source: source.name,
            field: result.field,
            value: result.value,
            type: result.type,
            endpoint: req.originalUrl,
            method: req.method,
            severity: 'HIGH'
          });

          return errorResponse(res, 'Phát hiện tham số truy vấn không hợp lệ', 400);
        }
      }
    }

    next();
  } catch (error) {
    logger.error('LỖI KIỂM TRA NOSQL', {
      error: error.message
    });

    return errorResponse(res, 'Kiểm tra bảo mật cơ sở dữ liệu thất bại', 500);
  }
};

// Query parameter validation for MongoDB operations
const validateMongoQueries = async (req, res, next) => {
  try {
    // Use sanitized query if available, otherwise fall back to original
    const query = req.sanitizedQuery || req.query;
    
    // Validate common query parameters
    if (query.sort) {
      const allowedSortFields = ['name', 'price', 'createdAt', 'updatedAt', 'rating', 'stock'];
      const sortFields = query.sort.split(',');
      
      for (const field of sortFields) {
        const cleanField = field.replace(/^-/, ''); // Remove descending indicator
        if (!allowedSortFields.includes(cleanField)) {
           logger.warn('TRƯỜNG SẮP XẾP', {
            field: cleanField,
            allowedFields: allowedSortFields
          });
          
          return errorResponse(res, 'Trường sắp xếp không hợp lệ', 400);
        }
      }
    }

    // Validate pagination parameters
    if (query.page) {
      const page = parseInt(query.page);
      if (isNaN(page) || page < 1 || page > 1000) {
        logger.warn('SỐ TRANG KHÔNG HỢP LỆ', {
          page: page,
          maxPage: 1000
        });
        return errorResponse(res, 'Số trang không hợp lệ', 400);
      }
    }

    if (query.limit) {
      const limit = parseInt(query.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        logger.warn('GIÁ TRỊ GIỚI HẠN KHÔNG HỢP LỆ', {
          limit: limit,
          maxLimit: 100
        });
        return errorResponse(res, 'Giá trị giới hạn không hợp lệ', 400);
      }
    }

    // Validate search parameters
    if (query.search) {
      if (query.search.length > 100) {
        logger.warn('TÌM KIẾM TÌM QUÁ DÀI', {
          searchLength: query.search.length,
          max_length: 100
        });
        return errorResponse(res, 'Từ khóa tìm kiếm quá dài', 400);
      }
    }

    next();
  } catch (error) {
    logger.error('LỖI KIỂM TRUYỀN', {
      error: error.message
    });

    return errorResponse(res, 'Xác thực truy vấn thất bại', 500);
  }
};

// Database connection security
const secureDBConnection = {
  // Secure connection options for MongoDB
  getSecureConnectionOptions: () => ({
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    bufferMaxEntries: 0, // Disable mongoose buffering
    bufferCommands: false, // Disable mongoose buffering
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
    retryWrites: true,
    retryReads: true,
    readPreference: 'primary', // Only read from primary
    ssl: process.env.NODE_ENV === 'production', // Use SSL in production
    sslValidate: process.env.NODE_ENV === 'production',
    authSource: 'admin' // Specify auth database
  }),

  // Monitor database connections
  setupConnectionMonitoring: (mongoose) => {
    mongoose.connection.on('connected', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log('✅ Database connected securely');
      }
    });

    mongoose.connection.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Database connection error:', err);
        logger.error('LỖI KẾT NỐI CƠ SỞ DỮ LIỆU', {
          error: err.message
        });
      }
    });

    mongoose.connection.on('disconnected', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log('⚠️ Cơ sở dữ liệu đã ngắt kết nối');
        logger.warn('DATABASE_DISCONNECTED', {});
      }
    });

    // Only setup graceful shutdown for production
    if (process.env.NODE_ENV !== 'test') {
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('Đóng kết nối cơ sở dữ liệu thông qua kết thúc ứng dụng');
        process.exit(0);
      });
    }
  }
};

// Database query logging for audit
const logDatabaseQueries = async (req, res, next) => {
  // Only log sensitive operations
  const sensitiveOperations = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const sensitiveEndpoints = ['/auth/', '/user/', '/admin/', '/payment/'];

  if (sensitiveOperations.includes(req.method) || 
      sensitiveEndpoints.some(endpoint => req.originalUrl.includes(endpoint))) {
    
    logger.info('GHI NHẬT JAO ĐỘ THAO TÁC CƠ SỞ DỮ LIỆU', {
      method: req.method,
      endpoint: req.originalUrl,
      userId: req.user?.id,
      userRole: req.user?.role,
      queryParams: req.sanitizedQuery || req.query,
      bodyKeys: req.body ? Object.keys(req.body) : []
    });
  }

  next();
};

// Prevent database enumeration attacks
const preventEnumeration = async (req, res, next) => {
  // Add random delay to prevent timing attacks
  const delay = Math.floor(Math.random() * 100) + 50; // 50-150ms random delay
  
  setTimeout(() => {
    next();
  }, delay);
};

export {
  noSQLSanitizer,
  detectNoSQLInjection,
  validateMongoQueries,
  secureDBConnection,
  logDatabaseQueries,
  preventEnumeration
};