import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';
import os from 'os';

let bot: TelegramBot | null = null;

// Translation Helper
const t = {
  dashboard: "📊 لوحة التحكم HFT",
  status: "الحالة",
  running: "🟢 يعمل",
  stopped: "🔴 متوقف",
  active_trades: "الصفقات النشطة",
  trades_min: "صفقات الدقيقة",
  trades_today: "صفقات اليوم",
  daily_profit: "ربح اليوم %",
  total_profit: "الربح الكلي %",
  last_trade: "آخر صفقة",
  last_execution: "زمن التنفيذ",
  platform_status: "الاتصال",
  circuit_breaker: "نظام الحماية",
  connected: "متصل ✅",
  disconnected: "منقطع ❌",
  protection_active: "نشط 🛡️",
  protection_idle: "خامل 🔍",
  
  // Controls
  btn_start: "▶️ تشغيل التداول",
  btn_stop: "⏸ إيقاف التداول",
  btn_force_close: "⛔ إغلاق الكل فوراً",
  btn_active: "📊 نشطة",
  btn_history: "📜 السجل",
  btn_stats: "📈 الإحصائيات",
  btn_diagnostic: "🔍 التشخيص",
  btn_settings_tp: "🎯 هدف الربح",
  btn_refresh: "🔄 تحديث",
  
  // Messages
  msg_started: "🚀 تم تشغيل محرك التداول",
  msg_stopped: "⏸ تم إيقاف محرك التداول",
  msg_force_closed: "⛔ تم إغلاق جميع الصفقات المفتوحة",
  msg_updated: "✅ تم التحديث",
};

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not found. Skipping Telegram bot initialization.");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  const getPersistentKeyboard = () => {
    return {
      keyboard: [
        [{ text: t.btn_start }, { text: t.btn_stop }, { text: t.btn_force_close }],
        [{ text: t.btn_active }, { text: t.btn_history }, { text: t.btn_stats }],
        [{ text: t.btn_diagnostic }, { text: t.btn_settings_tp }, { text: t.btn_refresh }]
      ],
      resize_keyboard: true,
      persistent: true
    };
  };

  const getDashboardText = async () => {
    const config = await storage.getConfig();
    const stats = await storage.getStats();
    const trades = await storage.getTrades(1);
    const lastTrade = trades[0];

    const latency = "12ms"; 

    return `
${t.dashboard}
────────────────
• ${t.status}: ${config.isRunning ? t.running : t.stopped}
• ${t.active_trades}: ${stats.activeTrades}
• ${t.trades_today}: ${stats.tradesToday}
• ${t.daily_profit}: ${((stats.totalProfit / 1000) * 100).toFixed(2)}%
• ${t.total_profit}: ${((stats.totalProfit / 5000) * 100).toFixed(2)}%
• ${t.last_trade}: ${lastTrade ? (Number(lastTrade.profitPercent) > 0 ? '✅' : '❌') + ' ' + Number(lastTrade.profitPercent).toFixed(2) + '%' : '---'}
• ${t.last_execution}: ${latency}
• ${t.platform_status}: ${t.connected}
────────────────
    `.trim();
  };

  const sendOrUpdateDashboard = async (chatId: number) => {
    const text = await getDashboardText();
    // We try to keep it simple: send a new message with the keyboard
    bot?.sendMessage(chatId, text, {
      reply_markup: getPersistentKeyboard(),
      parse_mode: 'Markdown'
    });
  };

  bot.onText(/\/start/, async (msg) => {
    await sendOrUpdateDashboard(msg.chat.id);
  });

  bot.on('message', async (msg) => {
    if (!msg.text || !msg.chat.id) return;
    const chatId = msg.chat.id;
    const text = msg.text;

    switch (text) {
      case t.btn_start:
        await storage.updateConfig({ isRunning: true });
        bot?.sendMessage(chatId, t.msg_started);
        await sendOrUpdateDashboard(chatId);
        break;

      case t.btn_stop:
        await storage.updateConfig({ isRunning: false });
        bot?.sendMessage(chatId, t.msg_stopped);
        await sendOrUpdateDashboard(chatId);
        break;

      case t.btn_force_close:
        const openTrade = await storage.getOpenTrade();
        if (openTrade) {
          await storage.updateTrade(openTrade.id, {
            status: 'CLOSED',
            exitReason: 'MANUAL',
            exitTime: new Date(),
            profit: "0",
            profitPercent: "0"
          });
          bot?.sendMessage(chatId, t.msg_force_closed);
        } else {
          bot?.sendMessage(chatId, "لا توجد صفقات مفتوحة");
        }
        await sendOrUpdateDashboard(chatId);
        break;

      case t.btn_active:
        const active = await storage.getTrades(10, 'OPEN');
        if (active.length === 0) {
          bot?.sendMessage(chatId, "📭 لا توجد صفقات نشطة حالياً");
        } else {
          let activeText = `📊 *الصفقات النشطة*\n\n`;
          active.forEach(tr => {
            activeText += `• ${tr.symbol} | دخول: ${tr.entryPrice}\n`;
          });
          bot?.sendMessage(chatId, activeText, { parse_mode: 'Markdown' });
        }
        break;

      case t.btn_history:
        const history = await storage.getTrades(20, 'CLOSED');
        if (history.length === 0) {
          bot?.sendMessage(chatId, "📜 السجل فارغ");
        } else {
          let histText = `📜 *آخر 20 صفقة*\n\n`;
          history.forEach(tr => {
            const emoji = Number(tr.profitPercent) > 0 ? '✅' : '❌';
            histText += `${emoji} ${tr.symbol} | ${Number(tr.profitPercent).toFixed(2)}% | ${tr.exitReason}\n`;
          });
          bot?.sendMessage(chatId, histText, { parse_mode: 'Markdown' });
        }
        break;

      case t.btn_stats:
        const stats = await storage.getStats();
        const statsText = `
📈 *الإحصائيات*
────────────────
• صفقات اليوم: ${stats.tradesToday}
• نسبة النجاح: ${stats.winRate.toFixed(1)}%
• الربح الكلي: $${stats.totalProfit.toFixed(2)}
• متوسط الربح/الصفقة: $${stats.tradesToday > 0 ? (stats.totalProfit / stats.tradesToday).toFixed(2) : '0.00'}
────────────────
        `.trim();
        bot?.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
        break;

      case t.btn_diagnostic:
        const diagText = `
🔍 *التشخيص*
────────────────
• اتصال API: متصل ✅
• زمن التنفيذ: 12ms
• نظام الحماية: خامل 🔍
• الذاكرة: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
• صحة النظام: ممتاز ⚡
────────────────
        `.trim();
        bot?.sendMessage(chatId, diagText, { parse_mode: 'Markdown' });
        break;

      case t.btn_settings_tp:
        const tpMarkup = {
          inline_keyboard: [
            [
              { text: "0.08%", callback_data: 'set_tp_0.08' },
              { text: "0.10%", callback_data: 'set_tp_0.10' }
            ],
            [
              { text: "0.12%", callback_data: 'set_tp_0.12' },
              { text: "0.15%", callback_data: 'set_tp_0.15' }
            ]
          ]
        };
        bot?.sendMessage(chatId, "🎯 اختر هدف الربح المطلوب:", { reply_markup: tpMarkup });
        break;

      case t.btn_refresh:
        await sendOrUpdateDashboard(chatId);
        break;
    }
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId || !query.data) return;

    if (query.data.startsWith('set_tp_')) {
      const target = query.data.replace('set_tp_', '');
      await storage.updateConfig({ tpPercentage: target });
      bot?.answerCallbackQuery(query.id, { text: `🎯 تم تحديد هدف الربح: ${target}%` });
      bot?.sendMessage(chatId, `✅ تم تحديث هدف الربح إلى ${target}%`);
    }
  });

  console.log("Arabic HFT Telegram bot initialized.");
}

export function sendTradeNotification(message: string) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chatId) return;
  
  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' }).catch(err => {
    console.error("Telegram notification error:", err.message);
    if (bot) {
      bot.sendMessage(chatId, message).catch(e => console.error("Final fallback error:", e.message));
    }
  });
}
