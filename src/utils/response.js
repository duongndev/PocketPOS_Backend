/**
 * Standardized response function
 */
export const standardResponse = (res, status, { success, message, data = null, pagination = null }) => {
  const response = { success, message };
  if (data !== null) response.data = data;
  if (pagination) response.pagination = pagination;
  return res.status(status).json(response);
};

/**
 * Success response helper
 * Supports: 
 * - successResponse(res, "Message", data)
 * - successResponse(res, data)
 */
export const successResponse = (res, messageOrData = 'Success', data = null, statusCode = 200, pagination = null) => {
  let message = 'Success';
  let actualData = data;

  if (typeof messageOrData === 'string') {
    message = messageOrData;
  } else {
    actualData = messageOrData;
    message = 'Success';
  }

  return standardResponse(res, statusCode, {
    success: true,
    message,
    data: actualData,
    pagination
  });
};

/**
 * Error response helper
 */
export const errorResponse = (res, message = 'Error', statusCode = 500, data = null) => {
  return standardResponse(res, statusCode, {
    success: false,
    message,
    data
  });
};

/**
 * Created response helper (201)
 */
export const createdResponse = (res, messageOrData = 'Created', data = null) => {
  return successResponse(res, messageOrData, data, 201);
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
  return errorResponse(res, message, 400, data);
};

/**
 * Unauthorized response helper (401)
 */
export const unauthorizedResponse = (res, message = 'Unauthorized') => {
  return errorResponse(res, message, 401);
};

/**
 * Forbidden response helper (403)
 */
export const forbiddenResponse = (res, message = 'Forbidden') => {
  return errorResponse(res, message, 403);
};

/**
 * Not found response helper (404)
 */
export const notFoundResponse = (res, message = 'Not Found') => {
  return errorResponse(res, message, 404);
};

/**
 * Conflict response helper (409)
 */
export const conflictResponse = (res, message = 'Conflict') => {
  return errorResponse(res, message, 409);
};

/**
 * Validation error response helper (422)
 */
export const validationErrorResponse = (res, errors, message = 'Validation Error') => {
  return standardResponse(res, 422, {
    success: false,
    message,
    data: { errors }
  });
};

/**
 * Internal server error response helper (500)
 */
export const internalServerErrorResponse = (res, message = 'Internal Server Error') => {
  return errorResponse(res, message, 500);
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
    data: response.data || response
  });
};
