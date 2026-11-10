/**
 * Production adapter from `@upstash/redis` to the limiter's `RateLimitStore`.
 * Server only. `@upstash/redis` is imported lazily and no new dependency is
 * added. Returns `null` when Redis is not configured (limiter then uses its
 * in-memory fallback).
 *
 * Requirements: 8.11, 8.12
 */

import "server-only";

import type { Redis } from "@upstash/redis";
import type { RateLimitStore } from "./ratelimit";

/** Wraps a Redis client in the small store surface the limiter needs. */
export function createUpstashStore(redis: Redis): RateLimitStore {
  return {
    zadd: (key, entry) => redis.zadd(key, entry),
    zremrangebyscore: (key, min, max) => redis.zremrangebyscore(key, min, max),
    zcard: (key) => redis.zcard(key),
    incr: (key) => redis.incr(key),
    expire: (key, seconds) => redis.expire(key, seconds),
    get: (key) => redis.get(key),
  };
}

/** Builds the Upstash client from env, or `null` when not configured. */
export async function createUpstashRedis(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  const { Redis: RedisClient } = await import("@upstash/redis");
  return new RedisClient({ url, token });
}
