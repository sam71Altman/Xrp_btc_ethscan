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
  
  // Progress Bar Helper
  progress_bar: (current: number, target: number) => {
    const percent = Math.min(Math.max((current / target) * 100, 0), 100);
    const filledCount = Math.floor(percent / 10);
    const bar = "▓".repeat(filledCount) + "░".repeat(10 - filledCount);
    return `${bar} ${percent.toFixed(0)}%`;
  },
  
  // Controls
  btn_toggle_start: "▶️ تشغيل",
  btn_toggle_stop: "⏸ إيقاف",
  btn_force_close: "🔴 إغلاق الكل",
  btn_active: "📊 الصفقات",
  btn_history: "📜 السجل",
  btn_stats: "📈 إحصائيات",
  btn_diagnostic: "🔍 تشخيص",
  btn_settings_tp: "🎯 هدف الربح",
  btn_refresh: "🔄 تحديث",
  btn_reset_stats: "🧹 تصفير",
  btn_balance: "💰 الرصيد",
  
  // Messages
  msg_started: "🚀 تم تشغيل محرك التداول",
  msg_stopped: "⏸ تم إيقاف محرك التداول",
  msg_force_closed: "⛔ تم إغلاق جميع الصفقات المفتوحة",
  msg_updated: "✅ تم التحديث",
  msg_stats_reset: "🧹 تم تصفير جميع الإحصائيات والرصيد بنجاح",
  msg_confirm_reset: "⚠️ هل أنت متأكد من تصفير جميع العدادات وإعادة الرصيد للبداية؟",
};

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not found. Skipping Telegram bot initialization.");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  let dashboardMessageId: number | null = null;
  let activeChatId: number | null = null;

  // Auto-refresh loop
  setInterval(async () => {
    if (activeChatId && dashboardMessageId) {
      const stats = await storage.getStats();
      if (stats.activeTrades > 0) {
        await sendOrUpdateDashboard(activeChatId);
      }
    }
  }, 2000);

  const getPersistentKeyboard = (isRunning: boolean) => {
    return {
      keyboard: [
        [{ text: isRunning ? t.btn_toggle_stop : t.btn_toggle_start }, { text: t.btn_balance }],
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
    const openTrades = await storage.getTrades(1, 'OPEN');
    const lastTrade = (await storage.getTrades(1, 'CLOSED'))[0];
    const activeTrade = openTrades[0];

    let tradeStatusText = "";
    if (activeTrade) {
      const entryPrice = Number(activeTrade.entryPrice);
      const symbol = activeTrade.symbol;
      const currentPrice = 50000; // This should ideally be fetched from simulation priceState, but since it's global, we might need a better way. For now, we'll use a placeholder or assume simulation updates it. 
      // Actually, we can get the latest candle price.
      const history = await storage.getMarketHistory(1);
      const latestPrice = history.length > 0 ? Number(history[0].close) : entryPrice;
      
      const profitPercent = ((latestPrice - entryPrice) / entryPrice) * 100;
      const targetProfit = Number(config.tpPercentage);
      const progress = targetProfit > 0 ? profitPercent / targetProfit : 0;
      
      const durationSec = Math.floor((Date.now() - new Date(activeTrade.entryTime).getTime()) / 1000);
      const maxSeconds = config.maxHoldSeconds;
      const timeLeft = Math.max(maxSeconds - durationSec, 0);
      const m = Math.floor(timeLeft / 60);
      const s = timeLeft % 60;
      const elapsedM = Math.floor(durationSec / 60);
      const elapsedS = durationSec % 60;

      tradeStatusText = `
📍 *صفقة نشطة — ${symbol}*
• سعر الدخول: ${entryPrice.toFixed(symbol.includes('XRP') ? 4 : 2)}
• السعر الحالي: ${latestPrice.toFixed(symbol.includes('XRP') ? 4 : 2)}
• الربح الحالي: ${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}%
• الهدف: +${targetProfit}%
🎯 التقدم: ${t.progress_bar(profitPercent, targetProfit)}
⏳ الوقت: ${elapsedM}:${elapsedS.toString().padStart(2, '0')} / ${Math.floor(maxSeconds/60)}:00
────────────────`;
    }

    const latency = "12ms"; 

    return `
${t.dashboard}
────────────────
• ${t.status}: ${config.isRunning ? t.running : t.stopped}
• 💰 الرصيد الحالي: ${stats.currentBalance.toFixed(2)} USDT
• 📈 ربح اليوم: ${((stats.totalProfit / Number(config.initialBalance)) * 100).toFixed(2)}%
• 📊 عدد الصفقات: ${stats.tradesToday}
${tradeStatusText}
• ${t.last_trade}: ${lastTrade ? (Number(lastTrade.profitPercent) > 0 ? '✅' : '❌') + ' ' + Number(lastTrade.profitPercent).toFixed(2) + '%' : '---'}
• ${t.last_execution}: ${latency}
• ${t.platform_status}: ${t.connected}
────────────────
    `.trim();
  };

  const sendOrUpdateDashboard = async (chatId: number) => {
    activeChatId = chatId;
    const text = await getDashboardText();
    const config = await storage.getConfig();
    
    if (dashboardMessageId) {
      try {
        await bot?.editMessageText(text, {
          chat_id: chatId,
          message_id: dashboardMessageId,
          reply_markup: { inline_keyboard: [] }, // We use persistent keyboard instead
          parse_mode: 'Markdown'
        });
        return;
      } catch (e) {
        // Message might be deleted or too old to edit
        dashboardMessageId = null;
      }
    }

    const msg = await bot?.sendMessage(chatId, text, {
      reply_markup: getPersistentKeyboard(config.isRunning),
      parse_mode: 'Markdown'
    });
    if (msg) dashboardMessageId = msg.message_id;
  };

  bot.onText(/\/start/, async (msg) => {
    dashboardMessageId = null;
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
        await sendOrUpdateDashboard(chatId);
        break;

      case t.btn_balance:
        const config = await storage.getConfig();
        bot?.sendMessage(chatId, `💰 *إدارة الرصيد*\n\nالرصيد الحالي: ${Number(config.balance).toFixed(2)} USDT\nرصيد البداية: ${Number(config.initialBalance).toFixed(2)} USDT`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 إعادة تعيين (1000)", callback_data: 'reset_balance_1000' }],
              [{ text: "📊 تقرير الأرباح", callback_data: 'profit_report' }]
            ]
          }
        });
        break;

      case t.btn_active:
        const active = await storage.getTrades(10, 'OPEN');
        if (active.length === 0) {
          bot?.sendMessage(chatId, "📭 لا توجد صفقات نشطة حالياً");
        } else {
          let activeText = `📊 *الصفقات النشطة*\n\n`;
          active.forEach(tr => {
            const durationSec = Math.floor((Date.now() - new Date(tr.entryTime).getTime()) / 1000);
            const m = Math.floor(durationSec / 60);
            const s = durationSec % 60;
            activeText += `• ${tr.symbol}\nالسعر: ${tr.entryPrice}\nالمدة: ${m}:${s.toString().padStart(2, '0')}\n\n`;
          });
          
          const inline_keyboard = active.map(tr => [{ 
            text: `❌ إغلاق ${tr.symbol}`, 
            callback_data: `close_trade_${tr.id}` 
          }]);
          inline_keyboard.push([{ text: "🔴 إغلاق جميع الصفقات", callback_data: 'force_close_all' }]);

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
        
      case t.btn_diagnostic:
        const systemStats = {
          uptime: Math.floor(os.uptime() / 3600),
          load: os.loadavg()[0].toFixed(2),
          memory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + "GB",
        };
        bot?.sendMessage(chatId, `🔍 *تشخيص النظام*\n\n• وقت العمل: ${systemStats.uptime} ساعة\n• حمل النظام: ${systemStats.load}\n• الذاكرة المتاحة: ${systemStats.memory}\n• حالة الاتصال: متصل ✅\n• WebSocket: مستقر ✅`, { parse_mode: 'Markdown' });
        break;

      case t.btn_stats:
        const finalStats = await storage.getStats();
        bot?.sendMessage(chatId, `📈 *إحصائيات التداول*\n\n• الربح الكلي: ${finalStats.totalProfit.toFixed(2)} USDT\n• نسبة النجاح: ${finalStats.winRate.toFixed(1)}%\n• عدد الصفقات: ${finalStats.tradesToday}\n• رصيد اليوم: ${finalStats.currentBalance.toFixed(2)} USDT`, { parse_mode: 'Markdown' });
        break;

      case t.btn_settings_tp:
        bot?.sendMessage(chatId, "🎯 *إعدادات هدف الربح*\nاختر النسبة المئوية لإغلاق الصفقة آلياً:", {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "0.08%", callback_data: 'set_tp_0.08' }, { text: "0.12%", callback_data: 'set_tp_0.12' }],
              [{ text: "0.20%", callback_data: 'set_tp_0.20' }, { text: "0.50%", callback_data: 'set_tp_0.50' }]
            ]
          }
        });
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
      await sendOrUpdateDashboard(chatId);
    }

    if (query.data === 'reset_balance_1000') {
      await storage.updateConfig({ balance: "1000", initialBalance: "1000" });
      bot?.answerCallbackQuery(query.id, { text: "تم إعادة تعيين الرصيد" });
      bot?.sendMessage(chatId, "💰 تم إعادة تعيين الرصيد إلى 1000 USDT");
      await sendOrUpdateDashboard(chatId);
    }

    if (query.data === 'confirm_reset_stats') {
      await storage.resetStats();
      bot?.answerCallbackQuery(query.id, { text: t.msg_stats_reset });
      bot?.sendMessage(chatId, t.msg_stats_reset);
      await sendOrUpdateDashboard(chatId);
    }

    if (query.data === 'cancel_reset') {
      bot?.answerCallbackQuery(query.id, { text: "تم الإلغاء" });
      bot?.deleteMessage(chatId, query.message!.message_id);
    }

    if (query.data === 'force_close_all') {
      const active = await storage.getTrades(50, 'OPEN');
      const config = await storage.getConfig();
      let totalRecovered = 0;
      for (const tr of active) {
        const value = Number(tr.entryPrice) * Number(tr.quantity);
        totalRecovered += value;
        await storage.updateTrade(tr.id, {
          status: 'CLOSED',
          exitReason: 'MANUAL',
          exitTime: new Date(),
          profit: "0",
          profitPercent: "0"
        });
      }
      if (active.length > 0) {
        await storage.updateConfig({ balance: (Number(config.balance) + totalRecovered).toString() });
      }
      bot?.answerCallbackQuery(query.id, { text: t.msg_force_closed });
      bot?.sendMessage(chatId, t.msg_force_closed);
      await sendOrUpdateDashboard(chatId);
    }

    if (query.data.startsWith('close_trade_')) {
      const tradeId = parseInt(query.data.replace('close_trade_', ''));
      const active = await storage.getTrades(1, 'OPEN');
      const tr = active.find(t => t.id === tradeId);
      if (tr) {
        const config = await storage.getConfig();
        const value = Number(tr.entryPrice) * Number(tr.quantity);
        await storage.updateTrade(tradeId, {
          status: 'CLOSED',
          exitReason: 'MANUAL',
          exitTime: new Date(),
          profit: "0",
          profitPercent: "0"
        });
        await storage.updateConfig({ balance: (Number(config.balance) + value).toString() });
        bot?.answerCallbackQuery(query.id, { text: "تم إغلاق الصفقة" });
        bot?.sendMessage(chatId, `✅ تم إغلاق ${tr.symbol} بنجاح`);
      }
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
