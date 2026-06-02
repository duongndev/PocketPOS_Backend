/**
 * Standardized response function
 * @param {Object} res Express response object
 * @param {number} status HTTP status code
 * @param {Object} payload Response payload
 */
export const standardResponse = (res, status, { success, message, data = null, pagination = null }) => {
  const response = { success, message };
  if (data !== null) response.data = data;
  if (pagination) response.pagination = pagination;
  return res.status(status).json(response);
};

/**
 * Flexible success response helper.
 * Supports:
 * - successResponse(res, data)
 * - successResponse(res, message)
 * - successResponse(res, message, data)
 * - successResponse(res, statusCode, message)
 * - successResponse(res, statusCode, message, data)
 * - successResponse(res, statusCode, message, data, pagination)
 */
export const successResponse = (res, ...args) => {
  let statusCode = 200;
  let message = 'Success';
  let data = null;
  let pagination = null;

  if (args.length === 1) {
    const [arg1] = args;
    if (typeof arg1 === 'number') {
      statusCode = arg1;
    } else if (typeof arg1 === 'string') {
      message = arg1;
    } else {
      data = arg1;
    }
  } else if (args.length === 2) {
    const [arg1, arg2] = args;
    if (typeof arg1 === 'number') {
      statusCode = arg1;
      if (typeof arg2 === 'string') {
        message = arg2;
      } else {
        data = arg2;
      }
    } else {
      message = arg1;
      data = arg2;
    }
  } else if (args.length === 3) {
    const [arg1, arg2, arg3] = args;
    if (typeof arg1 === 'number') {
      statusCode = arg1;
      message = typeof arg2 === 'string' ? arg2 : message;
      data = arg3;
    } else {
      message = typeof arg1 === 'string' ? arg1 : message;
      data = arg2;
      pagination = arg3;
    }
  } else if (args.length >= 4) {
    statusCode = typeof args[0] === 'number' ? args[0] : statusCode;
    message = typeof args[1] === 'string' ? args[1] : message;
    data = args[2];
    pagination = args[3];
  }

  return standardResponse(res, statusCode, {
    success: true,
    message,
    data,
    pagination,
  });
};

/**
 * Flexible error response helper.
 * Supports:
 * - errorResponse(res, message)
 * - errorResponse(res, statusCode)
 * - errorResponse(res, statusCode, message)
 * - errorResponse(res, statusCode, message, data)
 * - errorResponse(res, message, data)
 */
export const errorResponse = (res, ...args) => {
  let statusCode = 500;
  let message = 'Error';
  let data = null;

  if (args.length === 1) {
    const [arg1] = args;
    if (typeof arg1 === 'number') {
      statusCode = arg1;
    } else if (typeof arg1 === 'string') {
      message = arg1;
    } else {
      data = arg1;
    }
  } else if (args.length === 2) {
    const [arg1, arg2] = args;
    if (typeof arg1 === 'number') {
      statusCode = arg1;
      if (typeof arg2 === 'string') {
        message = arg2;
      } else {
        data = arg2;
      }
    } else {
      message = arg1;
      data = arg2;
    }
  } else if (args.length >= 3) {
    statusCode = typeof args[0] === 'number' ? args[0] : statusCode;
    message = typeof args[1] === 'string' ? args[1] : message;
    data = args[2];
  }

  return standardResponse(res, statusCode, {
    success: false,
    message,
    data,
  });
};

/**
 * Created response helper (201)
 */
export const createdResponse = (res, ...args) => {
  return successResponse(res, 201, ...args);
};

/**
 * No content response helper (204)
 */
export const noContentResponse = (res) => {
  return res.status(204).end();
};

/**
 * Bad request response helper (400)
 */
export const badRequestResponse = (res, message = 'Bad Request', data = null) => {
  return errorResponse(res, 400, message, data);
};

/**
 * Unauthorized response helper (401)
 */
export const unauthorizedResponse = (res, message = 'Unauthorized') => {
  return errorResponse(res, 401, message);
};

/**
 * Forbidden response helper (403)
 */
export const forbiddenResponse = (res, message = 'Forbidden') => {
  return errorResponse(res, 403, message);
};

/**
 * Not found response helper (404)
 */
export const notFoundResponse = (res, message = 'Not Found') => {
  return errorResponse(res, 404, message);
};

/**
 * Conflict response helper (409)
 */
export const conflictResponse = (res, message = 'Conflict') => {
  return errorResponse(res, 409, message);
};

/**
 * Validation error response helper (422)
 */
export const validationErrorResponse = (res, errors, message = 'Validation Error') => {
  return standardResponse(res, 422, {
    success: false,
    message,
    data: { errors },
  });
};

/**
 * Internal server error response helper (500)
 */
export const internalServerErrorResponse = (res, message = 'Internal Server Error') => {
  return errorResponse(res, 500, message);
};

/**
 * Legacy sendResponse function for backward compatibility
 * @deprecated Use standardResponse instead
 */
export const sendResponse = (statusCode, response, res) => {
  console.warn('[DEPRECATED] sendResponse is deprecated. Use standardResponse instead.');

  const isSuccess = statusCode >= 200 && statusCode < 300;

  return standardResponse(res, statusCode, {
    success: isSuccess,
    message: response.message || (isSuccess ? 'Success' : 'Error'),
    data: response.data || response,
  });
};
