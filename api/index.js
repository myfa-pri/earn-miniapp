import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import crypto from 'crypto';

// =================================================================
// 1. CONFIGURATION (HARDCODED AS REQUESTED)
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyADDpimqoG8PDeSgzd6XeI8bahZZRTRqRM",
  authDomain: "besh-81e22.firebaseapp.com",
  databaseURL: "https://besh-81e22-default-rtdb.firebaseio.com",
  projectId: "besh-81e22",
  storageBucket: "besh-81e22.firebasestorage.app",
  messagingSenderId: "324768534552",
  appId: "1:324768534552:web:dcfc91e34509c3e104336d"
};

const BOT_TOKEN = '8509274087:AAFm2BTuXcgaY7KNoihTKnVgK8sNBces9p0'; 
const ADMIN_SECRET = "Yichu123";
const WELCOME_IMG = "https://i.ibb.co/GQxC1zDf/Resized-Image-2026-01-11-09-14-06-1.png"; 
const IMAGE_API_URL = "https://welcomeapi.vercel.app/api";

const bot = new TelegramBot(BOT_TOKEN, { polling: false }); 
const app = express();
app.use(express.json());
app.use(cors());

// =================================================================
// 2. FIREBASE REST API HELPER FUNCTIONS
// =================================================================
async function dbCall(path, method, data = null) {
    try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        const options = { method: method, headers: { "Content-Type": "application/json" } };
        if (data) options.body = JSON.stringify(data);
        const response = await fetch(url, options);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`DB Error (${path}):`, error.message);
        return null;
    }
}
async function dbGet(path) { return await dbCall(path, 'GET'); }
async function dbSet(path, data) { return await dbCall(path, 'PUT', data); }
async function dbUpdate(path, partialData) { return await dbCall(path, 'PATCH', partialData); }
async function dbRemove(path) { return await dbCall(path, 'DELETE'); }

function logAction(user, actionStr) {
    if(!user.logs) user.logs = [];
    user.logs.push(`[${new Date().toISOString()}] ${actionStr}`);
    if(user.logs.length > 20) user.logs.shift();
    return user.logs;
}

// =================================================================
// 3. CORE LOGIC: USER CREATION & REFERRALS (YOUR ORIGINAL LOGIC)
// =================================================================
async function ensureUserExists(userId, username, refParam) {
    const existingUser = await dbGet(`users/${userId}`);
    if (existingUser) return existingUser;

    const config = (await dbGet('config')) || {};
    const referrerId = refParam ? refParam.replace(/^ref/, '') : null;

    const newUser = {
        username: username, points: 0, adsWatchedToday: 0, totalAdsWatchedLifetime: 0,
        referredBy: referrerId || null, referredUsers: [], isBanned: false, 
        createdAt: Date.now(), streak: 1, lastLoginDate: Date.now(),
        logs: [`[${new Date().toISOString()}] Account created`]
    };

    if (referrerId && referrerId !== userId) {
        newUser.points = (config.referralBonusReferee || 0);
        const referrer = await dbGet(`users/${referrerId}`);
        if (referrer) {
            const rBonus = config.referralBonusReferrer || 0;
            const newRefList = [...(referrer.referredUsers || []), userId];
            await dbUpdate(`users/${referrerId}`, { points: (referrer.points || 0) + rBonus, referredUsers: newRefList, logs: logAction(referrer, `Invited ${username} (+${rBonus})`) });
            bot.sendMessage(referrerId, `<b>🎉 New Referral!</b>\n${username} joined! You earned +${rBonus} Gems.`, {parse_mode:'HTML'}).catch(() => {});
        }
    }
    await dbSet(`users/${userId}`, newUser);

    // YOUR CUSTOM IMAGE NOTIFICATION TO CHANNEL
    try {
        const botInfo = await bot.getMe();
        const botId = BOT_TOKEN.split(':')[0];
        const params = new URLSearchParams();
        params.append('botToken', BOT_TOKEN);
        params.append('user1', botId);
        params.append('user2', userId);

        const imgResponse = await fetch(IMAGE_API_URL, { method: 'POST', body: params });
        if (imgResponse.ok) {
            const imgBuffer = await imgResponse.buffer();
            const safeName = username.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const captionText = `<b>⭐ ｢ɴᴇᴡ ᴜꜱᴇʀ ɴᴏᴛᴛɪꜰɪᴄᴀᴛɪᴏɴ 」⭐</b>\n━━━━━━━━•❅•°•❈•°•❅•━━━━━━━━\n<b>➠ 👤 Name:</b> <a href='tg://user?id=${userId}'>${safeName}</a>\n━━━━━━━━━━━━━━━━━━━━━━━\n<b>➠ 🆔 User ID:</b> ${userId}\n━━━━━━━━━━━━━━━━━━━━━━━\n🤖 ʙᴏᴛ: @${botInfo.username} ❤️`;
            await bot.sendPhoto('@Besh_beshs', imgBuffer, { caption: captionText, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💫 Start Bot", url: `https://t.me/${botInfo.username}/earn?startapp=ref${userId}` }]] } });
        } else {
            await bot.sendMessage('@Besh_beshs', `🎉 New User: ${username} (ID: ${userId})`);
        }
    } catch (e) { console.log("Channel Notification Error:", e.message); }

    return newUser;
}

// =================================================================
// 4. TELEGRAM WEBHOOK (THE WELCOME MESSAGE)
// =================================================================
app.post('/api/webhook', async (req, res) => {
    try {
        const update = req.body;
        if (update.message && update.message.text) {
            const msg = update.message;
            const chatId = msg.chat.id.toString();
            const text = msg.text;
            const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

            if (text.startsWith('/start')) {
                const args = text.split(' ');
                const refParam = args.length > 1 ? args[1] : null;
                await ensureUserExists(chatId, username, refParam);
                
                const config = (await dbGet('config')) || {};
                const webUrl = config.webAppUrl || 'https://earning-peach.vercel.app'; 
                const caption = `<b>${username} እንኳን ወደ MYFA BIRR መጡ </b>\n\nከታች ያለውን MYFA BIRR ምለውን ይጫኑ ገንዘብ ለማግኘት እና መተግበሪያውን ለመጀመር።`;

                try {
                    await bot.sendPhoto(chatId, WELCOME_IMG, {
                        caption: caption, parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [[{ text: "🚀 Open App ", web_app: { url: `${webUrl}?userId=${chatId}` } }]] }
                    });
                } catch (e) {
                    await bot.sendMessage(chatId, caption, {
                        parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 Open App ", web_app: { url: `${webUrl}?userId=${chatId}` } }]] }
                    });
                }
            }
        }
        res.status(200).send('OK');
    } catch (e) { res.status(200).send('OK'); }
});

// =================================================================
// 5. MINI APP API (GAMES & FEATURES)
// =================================================================
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    let u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error:"Not found"});
    res.json(u);
});

// --- GAMES LOGIC ---
app.post('/api/game/spin', async (req, res) => {
    const { userId } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = await dbGet('config') || {};
    const riggedReward = c.spinRiggedReward || 50; 
    
    // Rigged Odds: 75% chance to hit admin's rigged amount
    const rand = Math.random();
    let amount = 0;
    if (rand < 0.75) amount = parseInt(riggedReward);
    else if (rand < 0.99) amount = 10;
    else amount = 1000; 

    await dbUpdate(`users/${userId}`, { points: (u.points||0) + amount });
    res.json({ success: true, amount });
});

app.post('/api/aviator/start', async (req, res) => {
    const { userId, betAmount } = req.body;
    const user = await dbGet(`users/${userId}`);

    // Cryptographically Secure RNG (Unpredictable)
    const buf = crypto.randomBytes(4);
    const rand = buf.readUInt32BE(0) / 0xFFFFFFFF; 

    // Rigged logic: 85% chance to crash before 2.0x
    let crashPoint = 1.00;
    if (Math.random() < 0.85) {
        crashPoint = parseFloat((1.01 + (rand * 0.98)).toFixed(2)); // Between 1.01 and 1.99
    } else {
        crashPoint = parseFloat((2.00 + (rand * 8.00)).toFixed(2)); // Between 2.00 and 10.00
    }

    await dbUpdate(`users/${userId}`, { points: (user.points||0) - betAmount });
    const roundId = Date.now().toString();
    await dbSet(`aviatorRounds/${roundId}`, { crashPoint, active: true });
    res.json({ success: true, crashPoint, roundId });
});

app.post('/api/aviator/cashout', async (req, res) => {
    const { userId, roundId, multiplier, betAmount } = req.body;
    const round = await dbGet(`aviatorRounds/${roundId}`);
    if(!round || !round.active || multiplier > round.crashPoint) return res.json({ success: false });

    const user = await dbGet(`users/${userId}`);
    const winnings = Math.floor(betAmount * multiplier);
    await dbUpdate(`users/${userId}`, { points: (user.points||0) + winnings });
    res.json({ success: true, winnings });
});

app.post('/api/ox', async (req, res) => {
    const { userId, bet, playBot } = req.body;
    const user = await dbGet(`users/${userId}`);
    // If playing the Minimax Bot, win chance is < 10%
    const winChance = playBot ? 0.08 : 0.75; 
    const win = Math.random() < winChance;
    if(win) await dbUpdate(`users/${userId}`, { points: (user.points||0) + bet });
    else await dbUpdate(`users/${userId}`, { points: (user.points||0) - bet });
    res.json({ success: true, win });
});

// Exchange System
app.post('/api/exchange', async (req, res) => {
    const { userId, gemsToExchange } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = await dbGet('config') || {};
    const rate = c.exchangeRate || 10; // 10 Gems = 1 Unit
    
    if(u.points < gemsToExchange) return res.status(400).json({error: "Not enough Gems"});
    
    const realMoney = gemsToExchange / rate;
    await dbUpdate(`users/${userId}`, { points: u.points - gemsToExchange, realBalance: (u.realBalance||0) + realMoney });
    res.json({ success: true, realMoney });
});

// Real Telegram Avatar Fetcher
app.get('/api/avatar/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        if (photos.total_count > 0) {
            const fileId = photos.photos[0][0].file_id;
            const file = await bot.getFile(fileId);
            const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            res.set('Content-Type', 'image/jpeg');
            res.send(Buffer.from(buffer));
        } else {
            res.status(404).send('No avatar found');
        }
    } catch (e) { res.status(500).send('Error'); }
});

// Export for Vercel
export default app;