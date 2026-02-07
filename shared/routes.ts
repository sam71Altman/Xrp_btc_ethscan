import { z } from 'zod';
import { insertConfigSchema, trades, configurations, marketCandles } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  trades: {
    list: {
      method: 'GET' as const,
      path: '/api/trades' as const,
      input: z.object({
        limit: z.coerce.number().optional(),
        status: z.enum(['OPEN', 'CLOSED']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof trades.$inferSelect>()),
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/stats' as const,
      responses: {
        200: z.object({
          totalProfit: z.number(),
          winRate: z.number(),
          dailyLoss: z.number(),
          activeTrades: z.number(),
          tradesToday: z.number(),
        }),
      },
    },
  },
  config: {
    get: {
      method: 'GET' as const,
      path: '/api/config' as const,
      responses: {
        200: z.custom<typeof configurations.$inferSelect>(),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/config' as const,
      input: insertConfigSchema.partial(),
      responses: {
        200: z.custom<typeof configurations.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  market: {
    history: {
      method: 'GET' as const,
      path: '/api/market/history' as const,
      input: z.object({
        symbol: z.string().optional().default('BTC/USD'),
        limit: z.coerce.number().optional().default(100),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof marketCandles.$inferSelect>()),
      },
    },
  },
};
