import 'server-only';
import { PrismaClient } from '@prisma/client';

const cache = globalThis as typeof globalThis & { tourPrisma?: PrismaClient };

export function getTourPrisma() {
  const url = process.env.TOUR_DATABASE_URL?.trim();
  if (!url) throw new Error('TOUR_DATABASE_URL_MISSING');
  return cache.tourPrisma ??= new PrismaClient({ datasourceUrl: url });
}
