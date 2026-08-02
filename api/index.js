import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import crypto from 'crypto';

// ============================================================================
// 1. SYSTEM CONFIGURATION & SECURITY (HARDCODED)
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyADDpimqoG8PDeSgzd6XeI8bahZZRTRqRM",
  authDomain: "besh-81e22.firebaseapp.com",
  databaseURL: "https://besh-81e22-default-rtdb.firebaseio.com",
  projectId: "besh-81e22",
  storageBucket: "besh-81e22.firebasestorage.app",
  messagingSenderId: "324768534552",
  appId: "1:324768534552:web:dcfc91e34509c3e104336d"
};

const BOT_TOKEN = '8509274087:AAGpwWGbBSI2GCDNQYxqwTYqdN8M4g1Oa-s';
const ADMIN_SECRET = "Yichu123";
const WELCOME_IMG = "https://i.ibb.co/GQxC1zDf/Resized-Image-2026-01-11-09-14-06-1.png";
const IMAGE_API_URL = "https://welcomeapi.vercel.app/api";

const bot = new TelegramBot(BOT_TOKEN, { polling: false }); 
const app = express();
app.use(express.json());
app.use(cors());

// ============================================================================
// 2. FIREBASE DATABASE CORE HELPER FUNCTIONS
// ============================================================================
async function dbCall(path, method, data = null) {
    try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        const options = { method: method, headers: { "Content-Type": "application/json" } };
        if (data) options.body = JSON.stringify(data);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        options.signal = controller.signal;

        const response = await fetch(url, options);
        clearTimeout(timeout);

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`[DB Error] ${method} on ${path}:`, error.message);
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
    if(user.logs.length > 30) user.logs.shift(); // Keep last 30 logs
    return user.logs;
}

// ============================================================================
// 3. USER MANAGEMENT & REFERRAL SYSTEM
// ============================================================================
async function ensureUserExists(userId, username, refParam) {
    const existingUser = await dbGet(`users/${userId}`);
    if (existingUser) return existingUser;

    const config = (await dbGet('config')) || {};
    const referrerId = refParam ? refParam.replace(/^ref/, '') : null;

    const newUser = {
        username: username, points: 0, realBalance: 0, adsWatchedToday: 0, totalAdsWatchedLifetime: 0,
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
            await dbUpdate(`users/${referrerId}`, { 
                points: (referrer.points || 0) + rBonus, 
                referredUsers: newRefList, 
                logs: logAction(referrer, `Invited ${username} (+${rBonus} Gems)`) 
            });
            bot.sendMessage(referrerId, `<b>🎉 New Referral!</b>\n${username} joined using your link!\nYou earned +${rBonus} Gems.`, {parse_mode:'HTML'}).catch(() => {});
        }
    }
    await dbSet(`users/${userId}`, newUser);

    // Channel Notification logic
    try {
        const botInfo = await bot.getMe();
        const botId = BOT_TOKEN.split(':')[0];
        const params = new URLSearchParams({ botToken: BOT_TOKEN, user1: botId, user2: userId });
        const imgResponse = await fetch(IMAGE_API_URL, { method: 'POST', body: params });
        
        if (imgResponse.ok) {
            const imgBuffer = await imgResponse.buffer();
            const safeName = username.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const captionText = `<b>⭐ ｢ɴᴇᴡ ᴜꜱᴇʀ ɴᴏᴛᴛɪꜰɪᴄᴀᴛɪᴏɴ 」⭐</b>\n━━━━━━━━•❅•°•❈•°•❅•━━━━━━━━\n<b>➠ 👤 Name:</b> <a href='tg://user?id=${userId}'>${safeName}</a>\n━━━━━━━━━━━━━━━━━━━━━━━\n<b>➠ 🆔 User ID:</b> ${userId}\n━━━━━━━━━━━━━━━━━━━━━━━\n🤖 ʙᴏᴛ: @${botInfo.username} ❤️`;
            await bot.sendPhoto('@Besh_beshs', imgBuffer, { caption: captionText, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "💫 Start Bot", url: `https://t.me/${botInfo.username}/earn?startapp=ref${userId}` }]] } });
        }
    } catch (e) { console.log("Channel Notification Error:", e.message); }

    return newUser;
}

// ============================================================================
// 4. TELEGRAM WEBHOOK SETUP & LISTENER (THE FIX FOR DEAF BOT)
// ============================================================================

// [CRITICAL FIX]: Run this route once in your browser to connect Telegram
app.get('/api/setup', async (req, res) => {
    try {
        const host = req.headers.host;
        const webhookUrl = `https://${host}/api/webhook`;
        const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
        
        const response = await fetch(telegramUrl);
        const data = await response.json();
        
        if (data.ok) {
            res.status(200).json({ success: true, message: 'Webhook successfully configured!', url: webhookUrl });
        } else {
            res.status(500).json({ success: false, error: data.description });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// The Main Webhook Receiver
app.post('/api/webhook', async (req, res) => {
    try {
        const update = req.body;
        console.log("Incoming Webhook:", JSON.stringify(update)); // Debug logging

        if (update.message && update.message.text) {
            const msg = update.message;
            const chatId = msg.chat.id.toString();
            const text = msg.text;
            const firstName = msg.from.first_name || '';
            const lastName = msg.from.last_name || '';
            const accountName = `${firstName} ${lastName}`.trim() || 'Unknown User';

            if (text.startsWith('/start')) {
                const args = text.split(' ');
                const refParam = args.length > 1 ? args[1] : null;
                await ensureUserExists(chatId, accountName, refParam);
                
                const config = (await dbGet('config')) || {};
                const webUrl = config.webAppUrl || 'https://earn-miniapp.vercel.app'; 
                const caption = `<b>${accountName} እንኳን ወደ MYFA BIRR መጡ! </b>\n\nከታች ያለውን MYFA BIRR የሚለውን ይጫኑ ገንዘብ ለማግኘት እና መተግበሪያውን ለመጀመር።`;

                try {
                    await bot.sendPhoto(chatId, WELCOME_IMG, {
                        caption: caption, parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [[{ text: "🚀 Open Mini App", web_app: { url: `${webUrl}` } }]] }
                    });
                } catch (e) {
                    await bot.sendMessage(chatId, caption, {
                        parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🚀 Open Mini App", web_app: { url: `${webUrl}` } }]] }
                    });
                }
            }
        }
        return res.status(200).send('OK');
    } catch (e) { 
        console.error("Webhook Error:", e);
        return res.status(200).send('OK'); // Always return 200 so Telegram doesn't retry infinitely
    }
});

// ============================================================================
// 5. USER FACING APIs (Profile, Config, Tasks)
// ============================================================================
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    let u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error:"Not found"});

    const now = Date.now();
    const lastLogin = new Date(u.lastLoginDate || 0);
    const today = new Date(now);

    // Daily Streak Logic
    if(lastLogin.getDate() !== today.getDate() || lastLogin.getMonth() !== today.getMonth()) {
        const diffDays = Math.floor((now - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
        if(diffDays <= 2) {
            u.streak = (u.streak || 0) + 1;
            if(u.streak > 7) u.streak = 1; 
        } else {
            u.streak = 1; 
        }
        u.lastLoginDate = now;
        dbUpdate(`users/${userId}`, { streak: u.streak, lastLoginDate: now }).catch(()=>{});
    }

    // Rank Calculation
    try {
        const allUsers = Object.values(await dbGet('users') || {}).filter(x => !x.isBanned);
        const sorted = allUsers.sort((a,b) => (b.points||0) - (a.points||0));
        const rank = sorted.findIndex(x => x.username === u.username) + 1;
        u.rank = rank > 0 ? rank : '-';
    } catch(e) { u.rank = '-'; }

    res.json(u);
});

app.post('/api/ensure-user', async (req, res) => {
    const { userId, username, refParam } = req.body;
    try { await ensureUserExists(userId, username, refParam); res.json({success: true}); }
    catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/config', async (req, res) => res.json((await dbGet('config')) || {}));
app.get('/api/tasks', async (req, res) => res.json((await dbGet('bonusTasks')) || {}));

// Real Avatar Fetcher
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
            res.redirect(`https://ui-avatars.com/api/?name=${userId}&background=B026FF&color=fff`);
        }
    } catch (e) { res.redirect(`https://ui-avatars.com/api/?name=User&background=B026FF&color=fff`); }
});

// ============================================================================
// 6. ECONOMY API (Ads, Promo, Exchange, Withdraw)
// ============================================================================
app.post('/api/watch-ad', async (req, res) => {
    const { userId } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = (await dbGet('config')) || {};
    if(u) {
        const pts = (c.pointsPerAd || 50) * (c.globalMultiplier || 1);
        await dbUpdate(`users/${userId}`, {
            points: (u.points || 0) + pts,
            adsWatchedToday: (u.adsWatchedToday || 0) + 1,
            totalAdsWatchedLifetime: (u.totalAdsWatchedLifetime || 0) + 1,
            logs: logAction(u, `Watched Ad (+${pts} Gems)`)
        });
        res.json({success:true});
    } else res.status(404).send();
});

app.post('/api/exchange', async (req, res) => {
    const { userId, gemsToExchange } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = await dbGet('config') || {};
    const rate = c.exchangeRate || 100; // e.g. 100 Gems = 1 Unit
    
    if(u.points < gemsToExchange) return res.status(400).json({error: "Not enough Gems"});
    
    const realMoney = gemsToExchange / rate;
    await dbUpdate(`users/${userId}`, { 
        points: u.points - gemsToExchange, 
        realBalance: (u.realBalance||0) + realMoney,
        logs: logAction(u, `Exchanged ${gemsToExchange} Gems for ${realMoney} Units`)
    });
    res.json({ success: true, realMoney });
});

app.post('/api/request-withdrawal', async (req, res) => {
    const { userId, amount, method, account, accountName } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = (await dbGet('config')) || {};

    let status = 'pending';
    if(c.autoApproveLimit > 0 && amount <= c.autoApproveLimit) status = 'approved';

    const wid = Date.now().toString();
    const wData = { id: wid, userId, amount, method, account, accountName, status, date: Date.now() };

    await dbSet(`withdrawals/${wid}`, wData);
    await dbUpdate(`users/${userId}`, {
        points: u.points - amount,
        totalWithdrawn: (u.totalWithdrawn || 0) + Number(amount),
        logs: logAction(u, `Withdrawal Request: ${amount} via ${method} - ${status}`)
    });

    if(c.telegramChatId) {
        bot.sendMessage(c.telegramChatId, `<b>Withdrawal Request</b>\nUser: ${u.username}\nAmount: ${amount}\nMethod: ${method}\nAccount: ${account}`, {parse_mode:'HTML'}).catch(()=>{});
    }
    res.json({success:true, status});
});

app.get('/api/leaderboard/:id', async (req, res) => {
    const userId = req.params.id;
    const usersObj = await dbGet('users') || {};
    // Attach original userId to each object for rank identification
    const users = Object.keys(usersObj).map(key => ({...usersObj[key], id: key})).filter(u => !u.isBanned);
    
    const byPoints = [...users].sort((a,b)=>(b.points||0)-(a.points||0));
    const byReferrals = [...users].sort((a,b)=>(b.referredUsers?.length||0)-(a.referredUsers?.length||0));
    
    let userRankPoints = byPoints.findIndex(u => u.id === userId) + 1;
    let userRankRefs = byReferrals.findIndex(u => u.id === userId) + 1;

    res.json({
        byPoints: byPoints.slice(0, 100),
        byReferrals: byReferrals.slice(0, 100),
        userRankPoints: userRankPoints > 0 ? userRankPoints : null,
        userRankRefs: userRankRefs > 0 ? userRankRefs : null
    });
});

// ============================================================================
// 7. WEB3 GAME ENGINES (Rigged & Secure Logic)
// ============================================================================

app.post('/api/aviator/start', async (req, res) => {
    const { userId, betAmount } = req.body;
    const user = await dbGet(`users/${userId}`);
    const config = await dbGet('config') || {};

    let crashPoint = 1.00;
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const combined = `${serverSeed}-${Date.now()}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const rand = hashInt / 0xFFFFFFFF; // 0 to 1

    if (config.forcedCrashPoint && !isNaN(parseFloat(config.forcedCrashPoint))) {
        crashPoint = parseFloat(config.forcedCrashPoint);
        await dbUpdate('config', { forcedCrashPoint: "" }); // Reset after use
    } else {
        // Rigged: 85% chance to crash extremely early (< 2.0x)
        if (rand < 0.85) {
            const innerRand = parseInt(hash.substring(8, 16), 16) / 0xFFFFFFFF;
            crashPoint = parseFloat((1.01 + (innerRand * 0.98)).toFixed(2)); 
        } else {
            const innerRand = parseInt(hash.substring(16, 24), 16) / 0xFFFFFFFF;
            crashPoint = parseFloat((2.00 + (innerRand * 8.00)).toFixed(2)); 
        }
    }

    await dbUpdate(`users/${userId}`, { 
        points: (user.points||0) - betAmount,
        logs: logAction(user, `Played Aviator (Bet: ${betAmount})`)
    });

    const roundId = Date.now().toString();
    
    // Store last 15 crashes in memory (firebase) for history
    const historyData = await dbGet('aviatorHistory') || [];
    historyData.push(crashPoint);
    if(historyData.length > 15) historyData.shift();
    await dbSet('aviatorHistory', historyData);

    await dbSet(`aviatorRounds/${roundId}`, { crashPoint, active: true, serverHash: hash });
    res.json({ success: true, crashPoint, roundId, history: historyData, serverHash: hash });
});

app.post('/api/aviator/cashout', async (req, res) => {
    const { userId, roundId, multiplier, betAmount } = req.body;
    const round = await dbGet(`aviatorRounds/${roundId}`);
    if(!round || !round.active || multiplier > round.crashPoint) return res.json({ success: false });

    const user = await dbGet(`users/${userId}`);
    const winnings = Math.floor(betAmount * multiplier);
    await dbUpdate(`users/${userId}`, { 
        points: (user.points||0) + winnings,
        logs: logAction(user, `Aviator Cashout: ${multiplier}x (Won ${winnings})`)
    });
    res.json({ success: true, winnings });
});

app.post('/api/game/spin', async (req, res) => {
    const { userId } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = await dbGet('config') || {};
    const riggedReward = c.spinRiggedReward || 50; 
    
    // Rigged 75% for admin set reward
    const rand = Math.random();
    let amount = 0;
    if (rand < 0.75) amount = parseInt(riggedReward);
    else if (rand < 0.99) amount = 10;
    else amount = 1000; 

    await dbUpdate(`users/${userId}`, { 
        points: (u.points||0) + amount,
        logs: logAction(u, `Spun Wheel (+${amount} Gems)`)
    });
    res.json({ success: true, amount });
});

app.post('/api/combo', async (req, res) => {
    const { userId, combination } = req.body;
    const c = await dbGet('config') || {};
    const correctCombo = c.dailyCombo || ["c1","c2","c3","c4","c5","c6","c7","c8","c9"]; 
    const reward = c.comboReward || 1000;

    const isCorrect = JSON.stringify(combination) === JSON.stringify(correctCombo);
    if(isCorrect) {
        const u = await dbGet(`users/${userId}`);
        await dbUpdate(`users/${userId}`, { points: (u.points||0) + reward, logs: logAction(u, `Solved Daily Combo (+${reward})`) });
        res.json({ success: true, isCorrect, reward });
    } else {
        res.json({ success: true, isCorrect });
    }
});

app.post('/api/ox', async (req, res) => {
    const { userId, bet, playBot } = req.body;
    const user = await dbGet(`users/${userId}`);
    // Minimax Bot Simulation (Win chance is <10% for hard mode)
    const winChance = playBot ? 0.08 : 0.75; 
    const win = Math.random() < winChance;
    
    if(win) {
        await dbUpdate(`users/${userId}`, { points: (user.points||0) + bet, logs: logAction(user, `Won OX Game (+${bet})`) });
    } else {
        await dbUpdate(`users/${userId}`, { points: (user.points||0) - bet, logs: logAction(user, `Lost OX Game (-${bet})`) });
    }
    res.json({ success: true, win });
});

// ============================================================================
// 8. ADMIN CONTROL PANEL API
// ============================================================================
const checkAdmin = (req, res, next) => { 
    if(req.body.secret !== ADMIN_SECRET) return res.status(403).json({error:"Auth failed"}); 
    next(); 
};

app.post('/api/admin/stats', checkAdmin, async (req, res) => {
    const u = await dbGet('users')||{};
    const w = await dbGet('withdrawals')||{};
    const c = await dbGet('config')||{};

    let p = 0;
    const usersArr = Object.values(u);
    usersArr.forEach(x => p += (x.points||0));

    const fiveMinsAgo = Date.now() - (5 * 60 * 1000);
    const online = usersArr.filter(x => x.lastLoginDate > fiveMinsAgo).length;

    const topRefs = usersArr.sort((a,b)=>(b.referredUsers?.length||0)-(a.referredUsers?.length||0)).slice(0,5).map(x => ({id: x.username, username: x.username, refs: x.referredUsers?.length||0}));

    res.json({ users: Object.keys(u).length, withdrawals: Object.values(w).filter(x=>x.status==='pending').length, points: p, online, config: c, topRefs });
});

app.post('/api/admin/config-update', checkAdmin, async (req, res) => {
    if(req.body.fullConfig) await dbUpdate('config', req.body.fullConfig);
    res.json({success:true});
});

app.post('/api/admin/action', checkAdmin, async (req, res) => {
    const { query: userId, action, newBalance } = req.body;
    if(action==='update-balance') {
        const u = await dbGet(`users/${userId}`);
        await dbUpdate(`users/${userId}`, {points: parseInt(newBalance), logs: logAction(u, `Admin set balance to ${newBalance}`)});
    }
    if(action==='toggle-ban') {
        const u = await dbGet(`users/${userId}`);
        await dbUpdate(`users/${userId}`, {isBanned: !u.isBanned, logs: logAction(u, `Admin ${u.isBanned?'unbanned':'banned'}`)});
    }
    res.json({success:true});
});

// Export for Vercel
export default app;
