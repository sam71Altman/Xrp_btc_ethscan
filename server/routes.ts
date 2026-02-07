import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { startSimulation } from "./simulation";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- API Routes ---

  app.get(api.trades.list.path, async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const status = req.query.status as 'OPEN' | 'CLOSED' | undefined;
    const trades = await storage.getTrades(limit, status);
    res.json(trades);
  });

  app.get(api.trades.stats.path, async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.get(api.config.get.path, async (req, res) => {
    const config = await storage.getConfig();
    res.json(config);
  });

  app.patch(api.config.update.path, async (req, res) => {
    try {
      const input = api.config.update.input.parse(req.body);
      const config = await storage.updateConfig(input);
      res.json(config);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.market.history.path, async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const candles = await storage.getMarketHistory(limit);
    res.json(candles);
  });

  // --- Start Simulation Engine ---
  startSimulation();

  return httpServer;
}
