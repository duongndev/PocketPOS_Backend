// Helper: Sanitize input để tránh XSS
function sanitizeInput(input) {
  if (typeof input !== "string") return input;

  return input
    .replace(/[<>]/g, "") // Loại bỏ < >
    .replace(/javascript:/gi, "") // Loại bỏ javascript:
    .replace(/on\w+=/gi, "") // Loại bỏ event handlers
    .trim();
}

// Helper: Check if IP is in allowed range
function isIPAllowed(ip, allowedIPs = []) {
  if (allowedIPs.length === 0) return true;
  return allowedIPs.includes(ip);
}

export { sanitizeInput, isIPAllowed };