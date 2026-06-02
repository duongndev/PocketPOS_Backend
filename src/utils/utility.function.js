// Helper: Sanitize input để tránh XSS
export const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;

  return input
    .replace(/[<>]/g, "") // Loại bỏ < >
    .replace(/javascript:/gi, "") // Loại bỏ javascript:
    .replace(/on\w+=/gi, "") // Loại bỏ event handlers
    .trim();
}

// Helper: Check if IP is in allowed range
export const isIPAllowed = (ip, allowedIPs = []) => {
  if (allowedIPs.length === 0) return true;
  return allowedIPs.includes(ip);
};

export const generateSKU = (name) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const namePart = name ? name.replace(/\s+/g, '').substring(0, 3).toUpperCase() : 'PRD';
  return `${namePart}-${timestamp}-${randomStr}`;
}