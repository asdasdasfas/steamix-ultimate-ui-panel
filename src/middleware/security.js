import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import db from '../database/db.js';
import { cleanIp } from '../utils/helpers.js';

const DEFAULT_RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 100
  },
  api: {
    windowMs: 1 * 60 * 1000,
    max: 1000
  },
  clientLogs: {
    windowMs: 60 * 60 * 1000,
    max: 120
  }
};

function positiveIntegerEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;

  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;

  console.warn(`Invalid ${name}="${value}", using default ${defaultValue}`);
  return defaultValue;
}

const rateLimitConfig = {
  auth: {
    windowMs: positiveIntegerEnv('AUTH_RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_LIMITS.auth.windowMs),
    max: positiveIntegerEnv('AUTH_RATE_LIMIT_MAX', DEFAULT_RATE_LIMITS.auth.max)
  },
  api: {
    windowMs: positiveIntegerEnv('API_RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_LIMITS.api.windowMs),
    max: positiveIntegerEnv('API_RATE_LIMIT_MAX', DEFAULT_RATE_LIMITS.api.max)
  },
  clientLogs: {
    windowMs: positiveIntegerEnv('CLIENT_LOG_RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_LIMITS.clientLogs.windowMs),
    max: positiveIntegerEnv('CLIENT_LOG_RATE_LIMIT_MAX', DEFAULT_RATE_LIMITS.clientLogs.max)
  }
};

function buildSafeRateLimiter(config) {
  return rateLimit({
    ...config,
    // Normalize IPs so IPv4-mapped IPv6 (e.g. ::ffff:1.2.3.4) cannot bypass limits.
    keyGenerator: (req) => ipKeyGenerator(cleanIp(req.ip) || req.ip || 'unknown'),
    validate: { trustProxy: false }
  });
}

// Rate limiting for authentication endpoints
export const authLimiter = buildSafeRateLimiter({
  windowMs: rateLimitConfig.auth.windowMs,
  max: rateLimitConfig.auth.max,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API rate limiting
export const apiLimiter = buildSafeRateLimiter({
  windowMs: rateLimitConfig.api.windowMs,
  max: rateLimitConfig.api.max,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limiting for client logs (DoS protection)
export const clientLogLimiter = buildSafeRateLimiter({
  windowMs: rateLimitConfig.clientLogs.windowMs,
  max: rateLimitConfig.clientLogs.max,
  message: { error: 'Too many log requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      // The Web UI uses inline style attributes and runtime element.style updates.
      // Keep script CSP strict while allowing existing style behavior to render.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "http:", "https:"],
      connectSrc: ["'self'", "http:", "https:"],
      mediaSrc: ["'self'", "blob:", "http:", "https:"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false
});

export const ipBlocker = async (req, res, next) => {
  // Render free proxy IP hatası için geçici devre dışı - sadece Electron IP kilit kullanılacak
  return next();
};
