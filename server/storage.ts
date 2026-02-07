import { db } from "./db";
import {
  trades,
  configurations,
  marketCandles,
  type Trade,
  type InsertTrade,
  type Configuration,
  type UpdateConfigRequest,
  type Candle,
  type DashboardStats
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // Trades
  getTrades(limit?: number, status?: 'OPEN' | 'CLOSED'): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, updates: Partial<Trade>): Promise<Trade>;
  getOpenTrade(): Promise<Trade | undefined>;

  // Config
  getConfig(): Promise<Configuration>;
  updateConfig(updates: UpdateConfigRequest): Promise<Configuration>;

  // Market Data
  addCandle(candle: typeof marketCandles.$inferInsert): Promise<Candle>;
  getMarketHistory(limit: number): Promise<Candle[]>;
  cleanupOldCandles(maxAgeMinutes: number): Promise<void>;

  // Stats
  getStats(): Promise<DashboardStats>;
}

export class DatabaseStorage implements IStorage {
  async getTrades(limit: number = 50, status?: 'OPEN' | 'CLOSED'): Promise<Trade[]> {
    let query = db.select().from(trades).orderBy(desc(trades.entryTime)).limit(limit);
    if (status) {
      // @ts-ignore - simple filter
      query = query.where(eq(trades.status, status));
    }
    return await query;
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
  }

  async updateTrade(id: number, updates: Partial<Trade>): Promise<Trade> {
    const [updated] = await db.update(trades)
      .set(updates)
      .where(eq(trades.id, id))
      .returning();
    return updated;
  }

  async getOpenTrade(): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades)
      .where(eq(trades.status, 'OPEN'))
      .limit(1);
    return trade;
  }

  async getConfig(): Promise<Configuration> {
    const [config] = await db.select().from(configurations).limit(1);
    if (!config) {
      // Create default if not exists
      const [newConfig] = await db.insert(configurations).values({}).returning();
      return newConfig;
    }
    return config;
  }

  async updateConfig(updates: UpdateConfigRequest): Promise<Configuration> {
    const current = await this.getConfig();
    const [updated] = await db.update(configurations)
      .set(updates)
      .where(eq(configurations.id, current.id))
      .returning();
    return updated;
  }

  async addCandle(candle: typeof marketCandles.$inferInsert): Promise<Candle> {
    const [newCandle] = await db.insert(marketCandles).values(candle).returning();
    return newCandle;
  }

  async getMarketHistory(limit: number = 100): Promise<Candle[]> {
    return await db.select().from(marketCandles)
      .orderBy(desc(marketCandles.time))
      .limit(limit)
      .then(rows => rows.reverse()); // Return in chronological order for charts
  }

  async cleanupOldCandles(maxAgeMinutes: number): Promise<void> {
    // Keep DB size manageable
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    await db.delete(marketCandles).where(sql`${marketCandles.time} < ${cutoff}`);
  }

  async getStats(): Promise<DashboardStats> {
    const allTrades = await db.select().from(trades);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tradesToday = allTrades.filter(t => new Date(t.entryTime) >= today);
    const closedTrades = allTrades.filter(t => t.status === 'CLOSED');
    const winningTrades = closedTrades.filter(t => Number(t.profit) > 0);
    
    const totalProfit = closedTrades.reduce((sum, t) => sum + Number(t.profit || 0), 0);
    const dailyLoss = tradesToday.reduce((sum, t) => sum + (Number(t.profit) < 0 ? Number(t.profit) : 0), 0);

    return {
      totalProfit,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      dailyLoss: Math.abs(dailyLoss), // Return positive number for loss magnitude
      activeTrades: allTrades.filter(t => t.status === 'OPEN').length,
      tradesToday: tradesToday.length,
    };
  }
}

export const storage = new DatabaseStorage();
