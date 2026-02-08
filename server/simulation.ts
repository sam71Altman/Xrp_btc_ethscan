import { storage } from "./storage";
import { sendTradeNotification } from "./telegram";
import WebSocket from "ws";

// Simulation State
let lastTradeTime = 0;
let currentSymbolIndex = 0;
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT'];
const TICK_RATE_MS = 1000;

// Global price state for simulation (fallback)
const priceState: Record<string, number> = {
  'BTCUSDT': 50000,
  'ETHUSDT': 2800,
  'XRPUSDT': 0.5,
  'SOLUSDT': 100
};

function formatPrice(symbol: string, price: number): number {
  if (symbol.startsWith('XRP')) return Number(price.toFixed(4));
  return Number(price.toFixed(2));
}

export function startSimulation() {
  console.log("Starting Continuous Profit Engine with Real Binance Data...");

  const ws = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");

  ws.on('message', (data) => {
    const tickers = JSON.parse(data.toString());
    tickers.forEach((ticker: any) => {
      if (SYMBOLS.includes(ticker.s)) {
        priceState[ticker.s] = Number(ticker.c);
      }
    });
  });

  ws.on('error', (err) => {
    console.error("Binance WS Error:", err);
  });

  ws.on('close', () => {
    console.log("Binance WS closed, reconnecting in 5s...");
    setTimeout(startSimulation, 5000);
  });
  
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

async function tick(symbol: string) {
  const now = Date.now();
  const config = await storage.getConfig();
  const currentPriceRaw = priceState[symbol];
  const currentPrice = formatPrice(symbol, currentPriceRaw);
  const displaySymbol = symbol.replace('USDT', '/USDT');
  
  await storage.addCandle({
    symbol: displaySymbol,
    open: currentPrice.toString(),
    high: currentPrice.toString(),
    low: currentPrice.toString(),
    close: currentPrice.toString(),
    time: new Date(now),
  });
  
  if (Math.random() < 0.05) {
    await storage.cleanupOldCandles(60);
  }

  if (!config.isRunning || config.symbol !== displaySymbol) return;

  const openTrade = await storage.getOpenTrade();

  if (openTrade) {
    if (openTrade.symbol !== displaySymbol) return;

    const entryPrice = Number(openTrade.entryPrice);
    const durationSec = (now - new Date(openTrade.entryTime).getTime()) / 1000;
    const currentProfitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    if (currentProfitPercent >= Number(config.tpPercentage)) {
      await closeTrade(openTrade.id, currentPrice, 'TP', currentProfitPercent, displaySymbol);
      return;
    }

    if (durationSec >= config.maxHoldSeconds) {
      await closeTrade(openTrade.id, currentPrice, 'TIME_EXIT', currentProfitPercent, displaySymbol);
      return;
    }

    if (currentProfitPercent < -2.0) {
      await closeTrade(openTrade.id, currentPrice, 'EMERGENCY', currentProfitPercent, displaySymbol);
      return;
    }

  } else {
    if (SYMBOLS[currentSymbolIndex] !== symbol) return;

    const timeSinceLastTrade = (now - lastTradeTime) / 1000;
    if (timeSinceLastTrade < config.cooldownSeconds) return;

    const stats = await storage.getStats();
    if (stats.dailyLoss >= Number(config.dailyLossLimit)) return;

    if (stats.currentBalance <= 0) return;

    let probability = 0.1;
    if (config.mode === 'HFT') probability = 0.4;
    if (config.mode === 'FAST_NORMAL') probability = 0.25;
    if (config.mode === 'FAST_DOWN') probability = 0.2;
    
    const shouldEnter = Math.random() < probability; 
    
    if (shouldEnter) {
       const balance = Number(config.balance);
       const quantity = balance / currentPrice;

       await storage.createTrade({
         symbol: displaySymbol,
         entryPrice: currentPrice.toString(),
         quantity: quantity.toString(),
         status: 'OPEN',
         profit: "0",
         profitPercent: "0",
       });

       await storage.updateConfig({ balance: "0" });

       console.log(`Entered ${displaySymbol} trade at ${currentPrice}`);
       sendTradeNotification(`🟢 *صفقة فتحت*\nالعملة: ${displaySymbol.replace('/', '\\/')}\nالسعر: ${currentPrice}\nالكمية: ${quantity.toFixed(symbol.startsWith('BTC') ? 6 : 2)}`);
       
       currentSymbolIndex = (currentSymbolIndex + 1) % SYMBOLS.length;
    }
  }
}

async function closeTrade(id: number, price: number, reason: string, profitPercent: number, symbol: string) {
  const trade = (await storage.getTrades(1)).find(t => t.id === id);
  if (!trade) return;
  
  const entry = Number(trade.entryPrice);
  const qty = Number(trade.quantity);
  const exitValue = price * qty;
  const exactProfit = exitValue - (entry * qty);

  await storage.updateTrade(id, {
    exitPrice: price.toString(),
    exitTime: new Date(),
    status: 'CLOSED',
    exitReason: reason as any,
    profit: exactProfit.toString(),
    profitPercent: profitPercent.toString()
  });

  const config = await storage.getConfig();
  await storage.updateConfig({ balance: (Number(config.balance) + exitValue).toString() });
  
  lastTradeTime = Date.now();
  console.log(`Closed ${symbol} trade ${reason} at ${price} (${profitPercent.toFixed(2)}%)`);
  
  const arabicReason = reason === 'TP' ? 'هدف ربح' : reason === 'TIME_EXIT' ? 'خروج زمني' : reason === 'EMERGENCY' ? 'خروج طارئ' : reason === 'MANUAL' ? 'إغلاق يدوي' : reason;
  const emoji = profitPercent > 0 ? '✅' : '❌';
  sendTradeNotification(`${emoji} *صفقة أغلقت*\nالنتيجة: ${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}%\nالسبب: ${arabicReason}\nالمدة: ${Math.floor((Date.now() - new Date(trade.entryTime).getTime()) / 1000)} ثانية\nالرصيد الجديد: ${(Number(config.balance) + exitValue).toFixed(2)} USDT`);
}
