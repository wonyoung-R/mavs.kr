// src/lib/middleware/rate-limiter.ts
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  isAllowed(req: NextRequest): boolean {
    const key = this.config.keyGenerator
      ? this.config.keyGenerator(req)
      : this.getDefaultKey(req);

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);

    // Check if we're under the limit
    if (validRequests.length >= this.config.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  private getDefaultKey(req: NextRequest): string {
    // Use IP address as default key
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return ip;
  }

  getRemainingRequests(req: NextRequest): number {
    const key = this.config.keyGenerator
      ? this.config.keyGenerator(req)
      : this.getDefaultKey(req);

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => timestamp > windowStart);

    return Math.max(0, this.config.maxRequests - validRequests.length);
  }

  getResetTime(req: NextRequest): number {
    const key = this.config.keyGenerator
      ? this.config.keyGenerator(req)
      : this.getDefaultKey(req);

    const requests = this.requests.get(key) || [];
    if (requests.length === 0) return Date.now();

    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.config.windowMs;
  }
}

// Create rate limiter instances
export const apiRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
});

export const crawlRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 crawl requests per hour
});

export function withRateLimit(
  rateLimiter: RateLimiter,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    if (!rateLimiter.isAllowed(req)) {
      const remaining = rateLimiter.getRemainingRequests(req);
      const resetTime = rateLimiter.getResetTime(req);

      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimiter['config'].maxRequests.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': resetTime.toString(),
            'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    return handler(req);
  };
}
