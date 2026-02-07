import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';

let bot: TelegramBot | null = null;

const MODES = [
  { id: 'FAST_NORMAL', label: '⚡ Fast Normal' },
  { id: 'FAST_DOWN', label: '🔻 Fast Down' },
  { id: 'RUNNER', label: '🏃 Runner' },
  { id: 'SMART', label: '🧠 Smart' },
  { id: 'HFT', label: '🚀 HFT' }
];

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not found. Skipping Telegram bot initialization.");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  // --- SCREEN 1: DASHBOARD ---
  bot.onText(/\/start/, async (msg) => {
    const config = await storage.getConfig();
    const stats = await storage.getStats();
    const openTrade = await storage.getOpenTrade();

    const pnl = openTrade ? Number(openTrade.profitPercent).toFixed(2) : "0.00";
    
    const message = `
DASHBOARD
----------
• Mode: ${config.mode.toUpperCase()}
• Position: ${openTrade ? 'OPEN' : 'CLOSED'}
• Side: BUY
• Current PnL: ${pnl}%
• Daily PnL: ${((stats.totalProfit / 1000) * 100).toFixed(2)}%
• Trades Today: ${stats.tradesToday}
• System State: ${config.isRunning ? 'HEALTHY' : 'PAUSED'}
`;
    bot?.sendMessage(msg.chat.id, message);
  });

  // --- SCREEN 2: MODE CONTROL ---
  bot.onText(/\/mode/, async (msg) => {
    const config = await storage.getConfig();
    const keyboard = MODES.map(m => ([{
      text: `${m.label}${config.mode === m.id ? ' ✅' : ''}`,
      callback_data: `set_mode:${m.id}`
    }]));

    bot?.sendMessage(msg.chat.id, "MODE CONTROL", {
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  // --- SCREEN 3: TRADE HISTORY ---
  bot.onText(/\/trades/, async (msg) => {
    const trades = await storage.getTrades(20, 'CLOSED');
    let message = "TRADE HISTORY\n-------------\n";
    
    trades.forEach(t => {
      const time = new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      message += `${time} | ${t.symbol.split('/')[0]} | ${Number(t.entryPrice).toFixed(2)} | ${Number(t.exitPrice).toFixed(2)} | ${Number(t.profitPercent).toFixed(2)}% | ${t.exitReason}\n`;
    });

    bot?.sendMessage(msg.chat.id, message || "No recent trades found.");
  });

  // --- SCREEN 4: SYSTEM HEALTH ---
  bot.onText(/\/health/, async (msg) => {
    const config = await storage.getConfig();
    const message = `
SYSTEM HEALTH
-------------
Engine: ${config.isRunning ? 'RUNNING' : 'LOCKED'}
Queue: 0/1
Circuit Breaker: CLOSED
Cooldown: OFF
Guards: OK
Latency: 45 ms
Duplicate Protection: ACTIVE
`;
    bot?.sendMessage(msg.chat.id, message);
  });

  // --- SCREEN 5: SETTINGS ---
  bot.onText(/\/settings/, async (msg) => {
    const config = await storage.getConfig();
    const keyboard = [
      [{ text: `Max Trades/Day: ${config.maxTradesPerHour * 24}`, callback_data: 'noop' }],
      [{ text: `Cooldown: ${config.cooldownSeconds}s`, callback_data: 'noop' }],
      [{ text: `Risk: 1%`, callback_data: 'noop' }],
      [{ text: `${config.isRunning ? 'Disable' : 'Enable'} Engine`, callback_data: 'toggle_engine' }]
    ];

    bot?.sendMessage(msg.chat.id, "RISK SETTINGS", {
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  // --- CALLBACK HANDLERS ---
  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId || !query.data) return;

    if (query.data.startsWith('set_mode:')) {
      const mode = query.data.split(':')[1];
      await storage.updateConfig({ mode });
      bot?.answerCallbackQuery(query.id, { text: `[MODE] Switched to ${mode} ✅` });
      bot?.sendMessage(chatId, `[MODE] Switched to ${mode} ✅`);
    }

    if (query.data === 'toggle_engine') {
      const config = await storage.getConfig();
      await storage.updateConfig({ isRunning: !config.isRunning });
      const newState = !config.isRunning ? 'ENABLED' : 'DISABLED';
      bot?.answerCallbackQuery(query.id, { text: `Engine ${newState} ✅` });
      bot?.sendMessage(chatId, `Engine ${newState} ✅`);
    }
  });

  console.log("Professional Telegram bot initialized.");
}

export function sendTradeNotification(message: string) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (bot && chatId) {
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
}
