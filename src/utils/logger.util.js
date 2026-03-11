import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger, format, transports } from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '../../logs');
const logLevel = process.env.LOG_LEVEL || 'info';

// Create a logger instance
const logger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'pocketpos-backend' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    }),
    new transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    })
  ]
});

// Check if logs directory exists
try {
  await fs.access(logsDir);
} catch (error) {
  await fs.mkdir(logsDir, { recursive: true });
}

// Export the logger instance
export default logger;

// Auto-rotate logs daily only in production (not test mode)
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    await rotateLogs();
  }, 24 * 60 * 60 * 1000); // 24 hours
}

// Rotate logs
async function rotateLogs() {
  try {
    const files = await fs.readdir(logsDir);
    const logFiles = files
      .filter((file) => file.endsWith('.log'))
      .map((file) => ({ name: file, path: path.join(logsDir, file) }));

    if (logFiles.length > 10) {
      logFiles.sort((a, b) => a.name.localeCompare(b.name));
      await Promise.all(
        logFiles.slice(0, logFiles.length - 10).map((file) => fs.unlink(file.path))
      );
    }
  } catch (error) {
    console.error('Failed to rotate logs:', error);
  }
}