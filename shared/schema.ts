import { pgTable, text, serial, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  entryPrice: numeric("entry_price").notNull(),
  exitPrice: numeric("exit_price"),
  entryTime: timestamp("entry_time").defaultNow().notNull(),
  exitTime: timestamp("exit_time"),
  quantity: numeric("quantity").notNull(),
  profit: numeric("profit"),
  profitPercent: numeric("profit_percent"),
  status: text("status", { enum: ['OPEN', 'CLOSED'] }).notNull().default('OPEN'),
  exitReason: text("exit_reason", { enum: ['TP', 'TIME_EXIT', 'MANUAL', 'STOP_LOSS', 'EMERGENCY'] }),
});

export const configurations = pgTable("configurations", {
  id: serial("id").primaryKey(),
  isRunning: boolean("is_running").default(false).notNull(),
  symbol: text("symbol").default("BTC/USDT").notNull(),
  mode: text("mode").default("Normal").notNull(), // Add this line
  tpPercentage: numeric("tp_percentage").default("0.12").notNull(),
  maxHoldSeconds: integer("max_hold_seconds").default(300).notNull(), // 5 minutes
  cooldownSeconds: integer("cooldown_seconds").default(5).notNull(),
  dailyLossLimit: numeric("daily_loss_limit").default("5.0").notNull(), // % or absolute
  maxTradesPerHour: integer("max_trades_per_hour").default(50).notNull(),
});

export const marketCandles = pgTable("market_candles", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  open: numeric("open").notNull(),
  high: numeric("high").notNull(),
  low: numeric("low").notNull(),
  close: numeric("close").notNull(),
  time: timestamp("time").notNull(),
});

// === SCHEMAS ===

export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, entryTime: true, exitTime: true });
export const insertConfigSchema = createInsertSchema(configurations).omit({ id: true });
export const insertCandleSchema = createInsertSchema(marketCandles).omit({ id: true });

// === TYPES ===

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Configuration = typeof configurations.$inferSelect;
export type InsertConfiguration = z.infer<typeof insertConfigSchema>;
export type Candle = typeof marketCandles.$inferSelect;

// Request Types
export type UpdateConfigRequest = Partial<InsertConfiguration>;

// Response Types
export interface DashboardStats {
  totalProfit: number;
  winRate: number;
  dailyLoss: number;
  activeTrades: number;
  tradesToday: number;
}
