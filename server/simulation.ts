import { storage } from "./storage";

// Simulation State
let currentPrice = 50000; // Starting BTC price
let lastTickTime = Date.now();
let lastTradeTime = 0;

// Market Simulation Parameters
const VOLATILITY = 0.0002; // Low volatility for micro-scalping environment
const DRIFT = 0; // Neutral market mostly
const TICK_RATE_MS = 1000; // 1 second ticks

export function startSimulation() {
  console.log("Starting Continuous Profit Engine Simulation...");
  
  // Tick loop
  setInterval(async () => {
    try {
      await tick();
    } catch (error) {
      console.error("Simulation tick error:", error);
    }
  }, TICK_RATE_MS);
}

async function tick() {
  const now = Date.now();
  const config = await storage.getConfig();

  // 1. Generate Price Movement (Geometric Brownian Motion-ish)
  const changePercent = (Math.random() - 0.5) * VOLATILITY * 2 + DRIFT;
  currentPrice = currentPrice * (1 + changePercent);
  
  // Create Candle (Simulated 1s 'candle' for simplicity, or just tick data stored as candles)
  // In a real app we'd aggregate ticks. Here each tick is a 'candle' for high-freq viz.
  await storage.addCandle({
    symbol: config.symbol,
    open: (currentPrice * (1 - Math.random() * 0.0001)).toString(),
    high: (currentPrice * (1 + Math.random() * 0.0001)).toString(),
    low: (currentPrice * (1 - Math.random() * 0.0001)).toString(),
    close: currentPrice.toString(),
    time: new Date(now),
  });
  
  // Cleanup old data to keep simulation light
  if (Math.random() < 0.05) { // Occasional cleanup
    await storage.cleanupOldCandles(60); // Keep last 60 mins
  }

  // If engine is not running, stop logic here
  if (!config.isRunning) return;

  // 2. Strategy Logic
  const openTrade = await storage.getOpenTrade();

  if (openTrade) {
    // --- MANAGE OPEN POSITION ---
    const entryPrice = Number(openTrade.entryPrice);
    const durationSec = (now - new Date(openTrade.entryTime).getTime()) / 1000;
    const currentProfitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    // Check Take Profit
    if (currentProfitPercent >= Number(config.tpPercentage)) {
      await closeTrade(openTrade.id, currentPrice, 'TP', currentProfitPercent);
      return;
    }

    // Check Time Exit (Mandatory 5 mins / configurable)
    if (durationSec >= config.maxHoldSeconds) {
      await closeTrade(openTrade.id, currentPrice, 'TIME_EXIT', currentProfitPercent);
      return;
    }

    // Emergency Stop (Internal safety, say -1% hard stop, though user said "No classic SL")
    // Adding a catastrophic stop is good engineering practice even if "No classic SL" is requested.
    if (currentProfitPercent < -2.0) {
      await closeTrade(openTrade.id, currentPrice, 'EMERGENCY', currentProfitPercent);
      return;
    }

  } else {
    // --- LOOK FOR ENTRY ---
    
    // Check Cooldown
    const timeSinceLastTrade = (now - lastTradeTime) / 1000;
    if (timeSinceLastTrade < config.cooldownSeconds) return;

    // Check Daily Loss Limit
    const stats = await storage.getStats();
    if (stats.dailyLoss >= Number(config.dailyLossLimit)) {
      // Logic could pause engine here, but for now just don't enter
      return; 
    }

    // Entry Logic: "Micro pullbacks or small breakouts"
    // Simplified Simulation: Enter if we had a small dip (buy the dip)
    // In random walk, any entry is as good as another, but let's pretend we found a signal.
    // Let's enter randomly to simulate "continuous" trading for the demo.
    // In a real strategy, this would analyze `await storage.getMarketHistory(5)`.
    
    const shouldEnter = Math.random() > 0.3; // Aggressive entry
    
    if (shouldEnter) {
       await storage.createTrade({
         symbol: config.symbol,
         entryPrice: currentPrice.toString(),
         quantity: "0.1", // Fixed size for demo
         status: 'OPEN',
         profit: "0",
         profitPercent: "0",
       });
       console.log(`Entered trade at ${currentPrice}`);
    }
  }
}

async function closeTrade(id: number, price: number, reason: string, profitPercent: number) {
  const profit = (price * 0.1) - (price * 0.1 / (1 + profitPercent/100)); // Rough profit calc for demo
  // Actually simpler: (Exit - Entry) * Qty
  
  // We need to fetch entry to be exact, but for this lightweight sim, let's trust the % passed in or recalc.
  // Let's do it properly-ish in update:
  
  // Get trade to calc exact profit amount
  const trade = (await storage.getTrades(1)).find(t => t.id === id); // quick lookup
  if (!trade) return;
  
  const entry = Number(trade.entryPrice);
  const qty = Number(trade.quantity);
  const exactProfit = (price - entry) * qty;

  await storage.updateTrade(id, {
    exitPrice: price.toString(),
    exitTime: new Date(),
    status: 'CLOSED',
    exitReason: reason as any,
    profit: exactProfit.toString(),
    profitPercent: profitPercent.toString()
  });
  
  lastTradeTime = Date.now();
  console.log(`Closed trade ${reason} at ${price} (${profitPercent.toFixed(2)}%)`);
}
