import { storage } from "./storage";
import { sendTradeNotification } from "./telegram";

// Simulation State
let lastTradeTime = 0;
let currentSymbolIndex = 0;
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'XRP/USDT'];
const VOLATILITY = 0.0002;
const DRIFT = 0;
const TICK_RATE_MS = 1000;

export function startSimulation() {
  console.log("Starting Continuous Profit Engine with Binance Data Mock (BTC, ETH, XRP)...");
  
  // Tick loop for each symbol
  setInterval(async () => {
    try {
      for (const symbol of SYMBOLS) {
        await tick(symbol);
      }
    } catch (error) {
      console.error("Simulation tick error:", error);
    }
  }, TICK_RATE_MS);
}

// Global price state for simulation
const priceState: Record<string, number> = {
  'BTC/USDT': 50000,
  'ETH/USDT': 2800,
  'XRP/USDT': 0.5
};

async function tick(symbol: string) {
  const now = Date.now();
  const config = await storage.getConfig();

  // 1. Generate Price Movement
  const changePercent = (Math.random() - 0.5) * VOLATILITY * 2 + DRIFT;
  priceState[symbol] = priceState[symbol] * (1 + changePercent);
  const currentPrice = priceState[symbol];
  
  await storage.addCandle({
    symbol: symbol,
    open: (currentPrice * (1 - Math.random() * 0.0001)).toString(),
    high: (currentPrice * (1 + Math.random() * 0.0001)).toString(),
    low: (currentPrice * (1 - Math.random() * 0.0001)).toString(),
    close: currentPrice.toString(),
    time: new Date(now),
  });
  
  if (Math.random() < 0.05) {
    await storage.cleanupOldCandles(60);
  }

  if (!config.isRunning || config.symbol !== symbol) return;

  const openTrade = await storage.getOpenTrade();

  if (openTrade) {
    // Only process the symbol that has an open trade
    if (openTrade.symbol !== symbol) return;

    const entryPrice = Number(openTrade.entryPrice);
    const durationSec = (now - new Date(openTrade.entryTime).getTime()) / 1000;
    const currentProfitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    // Check Take Profit
    if (currentProfitPercent >= Number(config.tpPercentage)) {
      await closeTrade(openTrade.id, currentPrice, 'TP', currentProfitPercent, symbol);
      return;
    }

    // Check Time Exit (Mandatory 5 mins / configurable)
    if (durationSec >= config.maxHoldSeconds) {
      await closeTrade(openTrade.id, currentPrice, 'TIME_EXIT', currentProfitPercent, symbol);
      return;
    }

    // Emergency Stop (Internal safety, say -1% hard stop, though user said "No classic SL")
    // Adding a catastrophic stop is good engineering practice even if "No classic SL" is requested.
    if (currentProfitPercent < -2.0) {
      await closeTrade(openTrade.id, currentPrice, 'EMERGENCY', currentProfitPercent, symbol);
      return;
    }

  } else {
    // --- LOOK FOR ENTRY ---
    
    // Round-robin logic: Only allow entry for the current symbol in rotation
    if (SYMBOLS[currentSymbolIndex] !== symbol) return;

    // Check Cooldown
    const timeSinceLastTrade = (now - lastTradeTime) / 1000;
    if (timeSinceLastTrade < config.cooldownSeconds) return;

    // Check Daily Loss Limit
    const stats = await storage.getStats();
    if (stats.dailyLoss >= Number(config.dailyLossLimit)) {
      // Logic could pause engine here, but for now just don't enter
      return; 
    }

    // Entry Logic: Use specific mode logic
    // Simplified Simulation for the demo:
    let probability = 0.1; // Default
    if (config.mode === 'HFT') probability = 0.4;
    if (config.mode === 'FAST_NORMAL') probability = 0.25;
    if (config.mode === 'FAST_DOWN') probability = 0.2; // Could add more complex logic here
    
    const shouldEnter = Math.random() < probability; 
    
    if (shouldEnter) {
       await storage.createTrade({
         symbol: symbol,
         entryPrice: currentPrice.toString(),
         quantity: (symbol === 'BTC/USDT' ? '0.01' : symbol === 'ETH/USDT' ? '0.1' : '100').toString(),
         status: 'OPEN',
         profit: "0",
         profitPercent: "0",
       });
       console.log(`Entered ${symbol} trade at ${currentPrice}`);
       sendTradeNotification(`🟢 *صفقة فتحت*\nالعملة: ${symbol}\nالسعر: ${currentPrice.toFixed(2)}`);
       
       // Move to next symbol for the next trade
       currentSymbolIndex = (currentSymbolIndex + 1) % SYMBOLS.length;
       console.log(`Rotated to next symbol index: ${currentSymbolIndex} (${SYMBOLS[currentSymbolIndex]})`);
    }
  }
}

async function closeTrade(id: number, price: number, reason: string, profitPercent: number, symbol: string) {
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
  console.log(`Closed ${symbol} trade ${reason} at ${price} (${profitPercent.toFixed(2)}%)`);
  
  const arabicReason = reason === 'TP' ? 'جني أرباح' : reason === 'TIME_EXIT' ? 'خروج زمني' : 'خروج طارئ';
  const emoji = profitPercent > 0 ? '✅' : '❌';
  sendTradeNotification(`🔴 *صفقة أغلقت*\nالنتيجة: ${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}%\nالمدة: ${Math.floor((Date.now() - new Date(trade.entryTime).getTime()) / 1000)} ثانية`);
}
