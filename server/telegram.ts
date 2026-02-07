import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';

let bot: TelegramBot | null = null;

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not found. Skipping Telegram bot initialization.");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    bot?.sendMessage(msg.chat.id, "Welcome to Continuous Profit Engine Bot!\nUse /status to see current performance.");
  });

  bot.onText(/\/status/, async (msg) => {
    const stats = await storage.getStats();
    const config = await storage.getConfig();
    const message = `
📊 *Engine Status*
Symbol: ${config.symbol}
Running: ${config.isRunning ? "✅" : "❌"}

📈 *Performance*
Total Profit: $${Number(stats.totalProfit).toFixed(2)}
Win Rate: ${stats.winRate.toFixed(1)}%
Daily Loss: $${stats.dailyLoss.toFixed(2)}
Active Trades: ${stats.activeTrades}
Trades Today: ${stats.tradesToday}
    `;
    bot?.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  console.log("Telegram bot initialized.");
}

export function sendTradeNotification(message: string) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (bot && chatId) {
    bot.sendMessage(chatId, `🔔 *Trade Alert*\n${message}`, { parse_mode: 'Markdown' });
  }
}
