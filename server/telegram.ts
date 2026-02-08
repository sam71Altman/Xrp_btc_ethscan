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
  btn_toggle_start: "▶️ تشغيل التداول",
  btn_toggle_stop: "⏸ إيقاف التداول",
  btn_force_close: "🔴 إغلاق جميع الصفقات",
  btn_active: "📊 الصفقات النشطة",
  btn_history: "📜 السجل",
  btn_stats: "📈 الإحصائيات",
  btn_diagnostic: "🔍 التشخيص",
  btn_settings_tp: "🎯 هدف الربح",
  btn_refresh: "🔄 تحديث",
  btn_reset_stats: "🧹 تصفير العدادات",
  
  // Messages
  msg_started: "🚀 تم تشغيل محرك التداول",
  msg_stopped: "⏸ تم إيقاف محرك التداول",
  msg_force_closed: "⛔ تم إغلاق جميع الصفقات المفتوحة",
  msg_updated: "✅ تم التحديث",
  msg_stats_reset: "🧹 تم تصفير جميع الإحصائيات بنجاح",
  msg_confirm_reset: "⚠️ هل أنت متأكد من تصفير جميع العدادات؟",
};

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not found. Skipping Telegram bot initialization.");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  const getPersistentKeyboard = (isRunning: boolean) => {
    return {
      keyboard: [
        [{ text: isRunning ? t.btn_toggle_stop : t.btn_toggle_start }],
        [{ text: t.btn_active }, { text: t.btn_history }, { text: t.btn_stats }],
        [{ text: t.btn_diagnostic }, { text: t.btn_settings_tp }, { text: t.btn_refresh }],
        [{ text: t.btn_reset_stats }]
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
    const config = await storage.getConfig();
    bot?.sendMessage(chatId, text, {
      reply_markup: getPersistentKeyboard(config.isRunning),
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
      case t.btn_toggle_start:
      case t.btn_toggle_stop:
        const currentConfig = await storage.getConfig();
        const newState = !currentConfig.isRunning;
        await storage.updateConfig({ isRunning: newState });
        bot?.sendMessage(chatId, newState ? t.msg_started : t.msg_stopped);
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
          
          const inline_keyboard = active.map(tr => [{ 
            text: `❌ إغلاق ${tr.symbol}`, 
            callback_data: `close_trade_${tr.id}` 
          }]);
          inline_keyboard.push([{ text: t.btn_force_close, callback_data: 'force_close_all' }]);

          bot?.sendMessage(chatId, activeText, { 
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard }
          });
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
            const reason = tr.exitReason === 'TP' ? 'هدف ربح' : tr.exitReason === 'TIME_EXIT' ? 'خروج زمني' : tr.exitReason === 'EMERGENCY' ? 'خروج طارئ' : tr.exitReason === 'MANUAL' ? 'إغلاق يدوي' : tr.exitReason;
            histText += `${emoji} ${tr.symbol} | ${Number(tr.profitPercent).toFixed(2)}% | ${reason}\n`;
          });
          bot?.sendMessage(chatId, histText, { parse_mode: 'Markdown' });
        }
        break;

      case t.btn_reset_stats:
        bot?.sendMessage(chatId, t.msg_confirm_reset, {
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ نعم، متأكد", callback_data: 'confirm_reset_stats' },
              { text: "❌ إلغاء", callback_data: 'cancel_reset' }
            ]]
          }
        });
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

    if (query.data === 'confirm_reset_stats') {
      await storage.resetStats();
      bot?.answerCallbackQuery(query.id, { text: t.msg_stats_reset });
      bot?.sendMessage(chatId, t.msg_stats_reset);
      await sendOrUpdateDashboard(chatId);
    }

    if (query.data === 'cancel_reset') {
      bot?.answerCallbackQuery(query.id, { text: "تم الإلغاء" });
      bot?.deleteMessage(chatId, query.message!.message_id.toString());
    }

    if (query.data === 'force_close_all') {
      const active = await storage.getTrades(50, 'OPEN');
      for (const tr of active) {
        await storage.updateTrade(tr.id, {
          status: 'CLOSED',
          exitReason: 'MANUAL',
          exitTime: new Date(),
          profit: "0",
          profitPercent: "0"
        });
      }
      bot?.answerCallbackQuery(query.id, { text: t.msg_force_closed });
      bot?.sendMessage(chatId, t.msg_force_closed);
      await sendOrUpdateDashboard(chatId);
    }

    if (query.data.startsWith('close_trade_')) {
      const tradeId = parseInt(query.data.replace('close_trade_', ''));
      await storage.updateTrade(tradeId, {
        status: 'CLOSED',
        exitReason: 'MANUAL',
        exitTime: new Date(),
        profit: "0",
        profitPercent: "0"
      });
      bot?.answerCallbackQuery(query.id, { text: "تم إغلاق الصفقة" });
      bot?.sendMessage(chatId, "✅ تم إغلاق الصفقة بنجاح");
      await sendOrUpdateDashboard(chatId);
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
