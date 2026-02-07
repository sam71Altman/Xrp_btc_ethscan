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
    bot?.sendMessage(msg.chat.id, "مرحباً بك في بوت التداول الآلي الذكي! 🚀\nاستخدم أمر /status لمتابعة الأداء اللحظي.");
  });

  bot.onText(/\/status/, async (msg) => {
    const stats = await storage.getStats();
    const config = await storage.getConfig();
    const message = `
📊 *حالة المحرك*
العملة الحالية: ${config.symbol}
الحالة: ${config.isRunning ? "يعمل ✅" : "متوقف ❌"}

📈 *ملخص الأداء*
إجمالي الأرباح: $${Number(stats.totalProfit).toFixed(2)}
نسبة النجاح: ${stats.winRate.toFixed(1)}%
خسارة اليوم: $${stats.dailyLoss.toFixed(2)}
الصفقات النشطة: ${stats.activeTrades}
صفقات اليوم: ${stats.tradesToday}
    `;
    bot?.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  console.log("Telegram bot initialized.");
}

export function sendTradeNotification(message: string) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (bot && chatId) {
    bot.sendMessage(chatId, `🔔 *تنبيه تداول*\n${message}`, { parse_mode: 'Markdown' });
  }
}
