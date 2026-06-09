/**
 * Validation utility functions for user data
 */

/**
 * Validate user data (email, fullName, phone)
 * @param {Object} data - User data to validate
 * @param {boolean} isUpdate - Whether this is an update operation (allows partial data)
 * @returns {Array} Array of error messages
 */
export const validateUserData = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || data.email !== undefined) {
    if (!data.email?.trim()) {
      errors.push('Email là bắt buộc');
    } else if (!/^\S+@\S+\.\S+$/.test(data.email)) {
      errors.push('Email không hợp lệ');
    }
  }

  if (!isUpdate || data.fullName !== undefined) {
    if (!data.fullName?.trim()) {
      errors.push('Họ tên là bắt buộc');
    } else if (data.fullName.length > 100) {
      errors.push('Họ tên không được vượt quá 100 ký tự');
    }
  }

  if (data.phone !== undefined) {
    if (data.phone && !/^[0-9]{10,11}$/.test(data.phone)) {
      errors.push('Số điện thoại không hợp lệ');
    }
  }

  return errors;
};
