/**
 * Pagination Utility - Standard pagination helper for MongoDB queries
 * Provides consistent pagination across all controllers
 */

/**
 * Parse and validate pagination parameters from request
 * @param {Object} req - Express request object
 * @param {Object} options - Configuration options
 * @returns {Object} Pagination parameters
 */
export const parsePaginationParams = (req, options = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 10,
    maxPage = 1000,
    maxLimit = 100
  } = options;

  // Use sanitized query if available, otherwise fall back to original
  const query = req.sanitizedQuery || req.query;

  // Parse page
  let page = parseInt(query.page) || defaultPage;
  if (page < 1 || page > maxPage) {
    page = defaultPage;
  }

  // Parse limit
  let limit = parseInt(query.limit) || defaultLimit;
  if (limit < 1 || limit > maxLimit) {
    limit = defaultLimit;
  }

  // Calculate skip
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    originalPage: query.page,
    originalLimit: query.limit
  };
};

/**
 * Parse and validate sort parameters
 * @param {Object} req - Express request object
 * @param {Array} allowedFields - Array of allowed sort field names
 * @param {string} defaultField - Default sort field
 * @param {string} defaultOrder - Default sort order ('asc' or 'desc')
 * @returns {Object} Sort parameters
 */
export const parseSortParams = (req, allowedFields = [], defaultField = 'createdAt', defaultOrder = 'desc') => {
  const query = req.sanitizedQuery || req.query;
  
  let sortBy = query.sortBy || query.sort || defaultField;
  let sortOrder = query.sortOrder || query.order || defaultOrder;

  // Validate sort field
  if (allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
    sortBy = defaultField;
  }

  // Validate sort order
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    sortOrder = defaultOrder;
  }

  // Create sort object for MongoDB
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  return {
    sortBy,
    sortOrder,
    sortOptions
  };
};

/**
 * Parse search parameters
 * @param {Object} req - Express request object
 * @param {Object} options - Search options
 * @returns {Object} Search parameters
 */
export const parseSearchParams = (req, options = {}) => {
  const {
    maxLength = 100,
    searchFields = [],
    caseSensitive = false
  } = options;

  const query = req.sanitizedQuery || req.query;
  let search = query.search;

  if (search) {
    // Validate search length
    if (search.length > maxLength) {
      search = search.substring(0, maxLength);
    }

    // Trim whitespace
    search = search.trim();

    // Create search regex options
    const regexOptions = caseSensitive ? '' : 'i';

    return {
      search,
      searchRegex: new RegExp(search, regexOptions),
      searchFields
    };
  }

  return {
    search: null,
    searchRegex: null,
    searchFields
  };
};

/**
 * Build MongoDB query from filters
 * @param {Object} req - Express request object
 * @param {Object} filterConfig - Configuration for filters
 * @returns {Object} MongoDB query object
 */
export const buildQuery = (req, filterConfig = {}) => {
  const query = {};
  const reqQuery = req.sanitizedQuery || req.query;

  // Process boolean filters
  Object.entries(filterConfig.booleanFilters || {}).forEach(([field, defaultValue]) => {
    const value = reqQuery[field];
    if (value !== undefined) {
      query[field] = value === 'true' || value === true;
    } else if (defaultValue !== undefined) {
      query[field] = defaultValue;
    }
  });

  // Process range filters (min/max)
  Object.entries(filterConfig.rangeFilters || {}).forEach(([field, config]) => {
    const { minKey = `min${field.charAt(0).toUpperCase() + field.slice(1)}`, 
            maxKey = `max${field.charAt(0).toUpperCase() + field.slice(1)}` } = config;
    
    const minValue = parseFloat(reqQuery[minKey]);
    const maxValue = parseFloat(reqQuery[maxKey]);

    if (!isNaN(minValue)) {
      query[field] = { ...query[field], $gte: minValue };
    }
    if (!isNaN(maxValue)) {
      query[field] = { ...query[field], $lte: maxValue };
    }
  });

  // Process exact match filters
  Object.entries(filterConfig.exactFilters || {}).forEach(([field]) => {
    const value = reqQuery[field];
    if (value !== undefined && value !== '') {
      query[field] = value;
    }
  });

  // Process array filters (comma-separated values)
  Object.entries(filterConfig.arrayFilters || {}).forEach(([field]) => {
    const value = reqQuery[field];
    if (value && typeof value === 'string') {
      query[field] = { $in: value.split(',').map(v => v.trim()) };
    }
  });

  return query;
};

/**
 * Create pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
export const createPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);

  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
    isFirstPage: page === 1,
    isLastPage: page === totalPages
  };
};

/**
 * Execute paginated query with metadata
 * @param {Object} Model - Mongoose model
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query options
 * @returns {Object} Results with pagination metadata
 */
export const executePaginatedQuery = async (Model, query, options = {}) => {
  const {
    page,
    limit,
    skip,
    sortOptions,
    populate = null,
    select = null,
    lean = true
  } = options;

  // Build query
  let mongooseQuery = Model.find(query);

  // Apply sort
  if (sortOptions) {
    mongooseQuery = mongooseQuery.sort(sortOptions);
  }

  // Apply pagination
  mongooseQuery = mongooseQuery.skip(skip).limit(limit);

  // Apply population
  if (populate) {
    mongooseQuery = mongooseQuery.populate(populate);
  }

  // Apply field selection
  if (select) {
    mongooseQuery = mongooseQuery.select(select);
  }

  // Execute queries in parallel
  const [data, total] = await Promise.all([
    lean ? mongooseQuery.lean() : mongooseQuery,
    Model.countDocuments(query)
  ]);

  return {
    data,
    pagination: createPaginationMeta(page, limit, total)
  };
};

/**
 * Complete pagination helper - combines all utilities
 * @param {Object} req - Express request object
 * @param {Object} Model - Mongoose model
 * @param {Object} config - Configuration object
 * @returns {Object} Paginated results
 */
export const paginate = async (req, Model, config = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 10,
    maxPage = 1000,
    maxLimit = 100,
    allowedSortFields = ['createdAt', 'updatedAt'],
    defaultSortField = 'createdAt',
    defaultSortOrder = 'desc',
    searchFields = [],
    searchMaxLength = 100,
    booleanFilters = {},
    rangeFilters = {},
    exactFilters = {},
    arrayFilters = {},
    populate = null,
    select = null,
    lean = true,
    baseQuery = {}
  } = config;

  // Parse pagination parameters
  const { page, limit, skip } = parsePaginationParams(req, {
    defaultPage,
    defaultLimit,
    maxPage,
    maxLimit
  });

  // Parse sort parameters
  const { sortOptions } = parseSortParams(req, allowedSortFields, defaultSortField, defaultSortOrder);

  // Parse search parameters
  const { search, searchRegex } = parseSearchParams(req, {
    maxLength: searchMaxLength,
    searchFields
  });

  // Build base query
  let query = { ...baseQuery };

  // Add search conditions
  if (search && searchRegex && searchFields.length > 0) {
    query.$or = searchFields.map(field => ({
      [field]: searchRegex
    }));
  }

  // Add filters
  const filterQuery = buildQuery(req, {
    booleanFilters,
    rangeFilters,
    exactFilters,
    arrayFilters
  });

  // Merge queries
  query = { ...query, ...filterQuery };

  // Execute paginated query
  return await executePaginatedQuery(Model, query, {
    page,
    limit,
    skip,
    sortOptions,
    populate,
    select,
    lean
  });
};

/**
 * Standard response structure for paginated data
 * @param {string} message - Success message
 * @param {Array} data - Data array
 * @param {Object} pagination - Pagination metadata
 * @param {Object} additional - Additional data to include
 * @returns {Object} Standard response object
 */
export const createPaginatedResponse = (message, data, pagination, additional = {}) => {
  return {
    success: true,
    message,
    data,
    pagination,
    ...additional
  };
};

export default {
  parsePaginationParams,
  parseSortParams,
  parseSearchParams,
  buildQuery,
  createPaginationMeta,
  executePaginatedQuery,
  paginate,
  createPaginatedResponse
};
