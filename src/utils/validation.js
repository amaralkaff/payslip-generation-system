const Joi = require('joi');

/**
 * Validation Schemas and Utilities
 * Centralized validation for all API endpoints
 */

// Base schemas for common fields
const baseSchemas = {
  id: Joi.string().uuid().required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).max(128).required(),
  name: Joi.string().min(2).max(100).trim().required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).optional(),
  date: Joi.date().iso().required(),
  dateOptional: Joi.date().iso().optional(),
  timezone: Joi.string().default('UTC'),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }
};

// Authentication schemas
const authSchemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: baseSchemas.email,
    password: baseSchemas.password,
    firstName: Joi.string().min(2).max(50).trim().required(),
    lastName: Joi.string().min(2).max(50).trim().required(),
    phone: baseSchemas.phone,
    role: Joi.string().valid('admin', 'employee').default('employee')
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: baseSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: baseSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
  })
};

// User schemas
const userSchemas = {
  create: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: baseSchemas.email,
    password: baseSchemas.password,
    firstName: Joi.string().min(2).max(50).trim().required(),
    lastName: Joi.string().min(2).max(50).trim().required(),
    phone: baseSchemas.phone,
    role: Joi.string().valid('admin', 'employee').default('employee'),
    salary: Joi.number().precision(2).min(0).required(),
    startDate: baseSchemas.date,
    department: Joi.string().min(2).max(100).optional(),
    position: Joi.string().min(2).max(100).optional()
  }),

  update: Joi.object({
    email: Joi.string().email().lowercase().trim().optional(),
    firstName: Joi.string().min(2).max(50).trim().optional(),
    lastName: Joi.string().min(2).max(50).trim().optional(),
    phone: baseSchemas.phone,
    salary: Joi.number().precision(2).min(0).optional(),
    department: Joi.string().min(2).max(100).optional(),
    position: Joi.string().min(2).max(100).optional(),
    isActive: Joi.boolean().optional()
  }),

  list: Joi.object({
    ...baseSchemas.pagination,
    search: Joi.string().min(1).max(100).optional(),
    role: Joi.string().valid('admin', 'employee').optional(),
    department: Joi.string().optional(),
    isActive: Joi.boolean().optional()
  })
};

// Attendance schemas
const attendanceSchemas = {
  period: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    startDate: baseSchemas.date,
    endDate: baseSchemas.date.greater(Joi.ref('startDate')),
    description: Joi.string().max(500).optional()
  }),

  submission: Joi.object({
    attendancePeriodId: baseSchemas.id,
    checkInDate: baseSchemas.date,
    checkInTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    checkOutTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    notes: Joi.string().max(500).optional()
  }),

  update: Joi.object({
    checkInTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    checkOutTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    notes: Joi.string().max(500).optional()
  }),

  list: Joi.object({
    ...baseSchemas.pagination,
    attendancePeriodId: Joi.string().uuid().optional(),
    userId: Joi.string().uuid().optional(),
    startDate: baseSchemas.dateOptional,
    endDate: baseSchemas.dateOptional
  })
};

// Overtime schemas
const overtimeSchemas = {
  submission: Joi.object({
    date: baseSchemas.date,
    hours: Joi.number().precision(2).min(0.5).max(3).required(),
    description: Joi.string().min(10).max(500).required(),
    startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
  }),

  update: Joi.object({
    hours: Joi.number().precision(2).min(0.5).max(3).optional(),
    description: Joi.string().min(10).max(500).optional(),
    startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
  }),

  list: Joi.object({
    ...baseSchemas.pagination,
    userId: Joi.string().uuid().optional(),
    startDate: baseSchemas.dateOptional,
    endDate: baseSchemas.dateOptional,
    status: Joi.string().valid('pending', 'approved', 'rejected').optional()
  })
};

// Reimbursement schemas
const reimbursementSchemas = {
  submission: Joi.object({
    amount: Joi.number().precision(2).min(0.01).max(50000).required(),
    description: Joi.string().min(10).max(500).required(),
    category: Joi.string().valid(
      'travel', 'meals', 'accommodation', 'equipment', 
      'training', 'communication', 'other'
    ).required(),
    date: baseSchemas.date,
    receiptUrl: Joi.string().uri().optional(),
    notes: Joi.string().max(500).optional()
  }),

  update: Joi.object({
    amount: Joi.number().precision(2).min(0.01).max(50000).optional(),
    description: Joi.string().min(10).max(500).optional(),
    category: Joi.string().valid(
      'travel', 'meals', 'accommodation', 'equipment', 
      'training', 'communication', 'other'
    ).optional(),
    receiptUrl: Joi.string().uri().optional(),
    notes: Joi.string().max(500).optional()
  }),

  approve: Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    adminNotes: Joi.string().max(500).optional()
  }),

  list: Joi.object({
    ...baseSchemas.pagination,
    userId: Joi.string().uuid().optional(),
    startDate: baseSchemas.dateOptional,
    endDate: baseSchemas.dateOptional,
    status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
    category: Joi.string().valid(
      'travel', 'meals', 'accommodation', 'equipment', 
      'training', 'communication', 'other'
    ).optional()
  })
};

// Payroll schemas
const payrollSchemas = {
  process: Joi.object({
    attendancePeriodId: baseSchemas.id,
    effectiveDate: baseSchemas.date.optional(),
    notes: Joi.string().max(500).optional()
  }),

  summary: Joi.object({
    attendancePeriodId: baseSchemas.id.optional(),
    startDate: baseSchemas.dateOptional,
    endDate: baseSchemas.dateOptional,
    department: Joi.string().optional(),
    ...baseSchemas.pagination
  })
};

// Query parameter schemas
const querySchemas = {
  id: Joi.object({
    id: baseSchemas.id
  }),

  pagination: Joi.object(baseSchemas.pagination)
};

/**
 * Validation middleware factory
 * @param {Object} schema - Joi schema to validate against
 * @param {string} source - Where to find data ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors
        },
        request_id: req.id
      });
    }

    // Replace the request data with validated and sanitized data
    req[source] = value;
    next();
  };
};

/**
 * Validate multiple sources
 * @param {Object} schemas - Object with schemas for different sources
 * @returns {Function} Express middleware function
 */
const validateMultiple = (schemas) => {
  return (req, res, next) => {
    const errors = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const data = req[source];
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        errors.push(...error.details.map(detail => ({
          source,
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })));
      } else {
        req[source] = value;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors
        },
        request_id: req.id
      });
    }

    next();
  };
};

/**
 * Custom validators
 */
const customValidators = {
  /**
   * Validate time range (start time must be before end time)
   */
  timeRange: (startTime, endTime) => {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    return start < end;
  },

  /**
   * Validate that date is a working day (Monday-Friday)
   */
  isWorkingDay: (date) => {
    const day = new Date(date).getDay();
    return day >= 1 && day <= 5; // Monday = 1, Friday = 5
  },

  /**
   * Validate that date is within attendance period
   */
  isWithinAttendancePeriod: (date, startDate, endDate) => {
    const checkDate = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return checkDate >= start && checkDate <= end;
  }
};

module.exports = {
  // Schemas
  authSchemas,
  userSchemas,
  attendanceSchemas,
  overtimeSchemas,
  reimbursementSchemas,
  payrollSchemas,
  querySchemas,
  baseSchemas,

  // Middleware
  validate,
  validateMultiple,

  // Custom validators
  customValidators,

  // Direct Joi access for custom schemas
  Joi
}; 