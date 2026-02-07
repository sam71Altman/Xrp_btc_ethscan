import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { startSimulation } from "./simulation";
import { initTelegramBot } from "./telegram";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ... existing routes ...

  // --- Start Services ---
  startSimulation();
  initTelegramBot();

  return httpServer;
}
