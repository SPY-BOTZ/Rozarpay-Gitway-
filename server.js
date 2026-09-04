const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const Razorpay = require('razorpay');

const app = express();
app.use(bodyParser.json());

// Aapka Telegram Bot Token aur Channel ID
const token = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });
const CHAT_ID = '@your_telegram_channel_username'; // Apna channel username ya ID dalein

const razorpay = new Razorpay({
  key_id: 'RAZORPAY_KEY_ID',
  key_secret: 'RAZORPAY_KEY_SECRET'
});

// 1. /start Command Handler
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "👋 Welcome! Premium membership lene ke liye hamari website par visit karein aur payment karein. Payment hote hi aapko automatic join link mil jayegi.");
});

// 2. Razorpay Order Creation Endpoint (Website se call hoga)
app.post('/create-order', async (req, res) => {
  try {
    const { amount, duration, telegramUserId } = req.body;
    
    const options = {
      amount: amount * 100, // Paise mein convert karne ke liye
      currency: "INR",
      receipt: "receipt_" + Date.now(),
      notes: { duration, telegramUserId }
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Razorpay Webhook (Payment successful hone par automatic link bhejne ke liye)
app.post('/webhook', async (req, res) => {
  const event = req.body.event;

  if (event === 'payment.captured') {
    const payment = req.body.payload.payment.entity;
    const notes = payment.notes;
    const telegramUserId = notes.telegramUserId;
    const duration = notes.duration;

    // Plan ke mutabiq expiry time (Default 2 Days = 172800 seconds)
    let expireSeconds = 2 * 24 * 60 * 60; 
    if (duration === '1 Week') expireSeconds = 7 * 24 * 60 * 60;
    if (duration === '1 Month') expireSeconds = 30 * 24 * 60 * 60;
    if (duration === '2 Month') expireSeconds = 60 * 24 * 60 * 60;

    try {
      const expireDate = Math.floor(Date.now() / 1000) + expireSeconds;

      // Single-use invite link generate karna (member_limit: 1)
      const inviteLinkData = await bot.createChatInviteLink(CHAT_ID, {
        member_limit: 1,
        expire_date: expireDate
      });

      // User ko direct bot ke through link bhejna
      if (telegramUserId) {
        await bot.sendMessage(telegramUserId, `🎉 Payment Successful!\n\nAapka private link yeh raha (Yeh sirf 1 baar use ho sakta hai aur validity khatam hone par aapko channel se remove kar diya jayega):\n\n${inviteLinkData.invite_link}`);
      }
    } catch (err) {
      console.error("Link Generation Error:", err);
    }
  }

  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('Bot and Server is running on port 3000');
});
