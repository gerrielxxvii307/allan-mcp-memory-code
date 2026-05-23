import pino from 'pino';
import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';
const isCli = process.env.ALLAN_CLI_MODE === '1';

// Ensure logs directory exists for CLI mode
const logsDir = path.join(process.cwd(), 'logs');
if (isCli && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path for CLI mode
const logFile = isCli ? path.join(logsDir, `allan-memory-${new Date().toISOString().split('T')[0]}.log`) : null;

// Create write stream for CLI mode
const fileStream = logFile ? fs.createWriteStream(logFile, { flags: 'a' }) : null;

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev && !isCli ? 'debug' : 'info'),
  transport: !isCli && isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  base: {
    service: 'allan-memory'
  }
}, isCli ? fileStream : undefined);

export default logger;
