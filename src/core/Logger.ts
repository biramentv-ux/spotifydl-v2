import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const emojiLevels: Record<string, string> = {
  error: '💥',
  warn: '⚠️',
  info: 'ℹ️',
  debug: '🐛',
  verbose: '📢'
};

const customFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  const emoji = emojiLevels[level] || '📝';
  let msg = `${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

export class Logger {
  private static instance: winston.Logger;

  static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: combine(
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          errors({ stack: true }),
          customFormat
        ),
        transports: [
          new winston.transports.Console({
            format: combine(colorize(), customFormat)
          }),
          new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error'
          }),
          new winston.transports.File({
            filename: path.join('logs', 'combined.log')
          })
        ],
        exceptionHandlers: [
          new winston.transports.File({ filename: path.join('logs', 'exceptions.log') })
        ],
        rejectionHandlers: [
          new winston.transports.File({ filename: path.join('logs', 'rejections.log') })
        ]
      });
    }
    return Logger.instance;
  }
}

export const logger = Logger.getInstance();
