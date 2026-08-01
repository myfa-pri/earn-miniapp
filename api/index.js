import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =================================================================
// 1. CONFIGURATION (HARDCODED)
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

const BOT_TOKEN = '8509274087:AAGpwWGbBSI2GCDNQYxqwTYqdN8M4g1Oa-s';
const ADMIN_SECRET = "Yichu123";
const WELCOME_IMG = "https://i.ibb.co/GQxC1zDf/Resized-Image-2026-01-11-09-14-06-1.png";
const IMAGE_API_URL = "https://welcomeapi.vercel.app/api";

// Polling must be false for Serverless/Vercel
const bot = new TelegramBot(BOT_TOKEN, { polling: false }); 
const app = express();

app.use(express.json());
app.use(cors());

// =================================================================
// 2. DATABASE HELPER FUNCTIONS
// =================================================================
async function dbCall(path, method, data = null) {
    try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        const options = {
            method: method,
            headers: { "Content-Type": "application/json" }
        };
        if (data) options.body = JSON.stringify(data);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        options.signal = controller.signal;

        const response = await fetch(url, options);
        clearTimeout(timeout);

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

function logUserAction(user, actionStr) {
    if(!user.logs) user.logs = [];
    user.logs.push(`[${new Date().toISOString()}] ${actionStr}`);
    if(user.logs.length > 20) user.logs.shift(); // Keep last 20
    return user.logs;
}

// =================================================================
// 3. CORE LOGIC: USER CREATION & REFERRALS
// =================================================================
async function ensureUserExists(userId, username, refParam) {
    const existingUser = await dbGet(`users/${userId}`);
    if (existingUser) return existingUser;

    const config = (await dbGet('config')) || {};
    const referrerId = refParam ? refParam.replace(/^ref/, '') : null;

    const newUser = {
        username: username, 
        points: 0, 
        adsWatchedToday: 0, 
        totalAdsWatchedLifetime: 0,
        referredBy: referrerId || null, 
        referredUsers: [], 
        isBanned: false, 
        createdAt: Date.now(),
        streak: 1,
        lastLoginDate: Date.now(),
        logs: [`[${new Date().toISOString()}] Account created`]
    };

    if (referrerId && referrerId !== userId) {
        newUser.points = (config.referralBonusReferee || 0);
        const referrer = await dbGet(`users/${referrerId}`);
        if (referrer) {
            const rBonus = config.referralBonusReferrer || 0;
            const newRefList = [...(referrer.referredUsers || []), userId];
            const logs = logUserAction(referrer, `Invited ${username} (+${rBonus})`);

            await dbUpdate(`users/${referrerId}`, {
                points: (referrer.points || 0) + rBonus,
                referredUsers: newRefList,
                logs: logs
            });

            bot.sendMessage(referrerId, `<b>New Referral!</b>\n${username} joined using your link! You earned +${rBonus} points.`, {parse_mode:'HTML'}).catch(() => {});
        }
    }

    await dbSet(`users/${userId}`, newUser);

    // Channel Notification
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
            const clickableName = `<a href='tg://user?id=${userId}'>${safeName}</a>`;
            const captionText = 
                `<b>⭐ ｢ɴᴇᴡ ᴜꜱᴇʀ ɴᴏᴛᴛɪꜰɪᴄᴀᴛɪᴏɴ 」⭐</b>\n` +
                `━━━━━━━━•❅•°•❈•°•❅•━━━━━━━━\n` +
                `<b>➠ 👤 Name:</b> ${clickableName}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `<b>➠ 🆔 User ID:</b> ${userId}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🤖 ʙᴏᴛ: @${botInfo.username} ❤️`;

            // Send Photo to Channel
            await bot.sendPhoto('@Besh_beshs', imgBuffer, {
                caption: captionText,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: "💫 Start Bot", url: `https://t.me/${botInfo.username}/earn?startapp=ref${userId}` }
                    ]]
                }
            });
        } else {
            // Fallback if API fails: Send text only
            console.log("Image API Failed, sending text fallback.");
            await bot.sendMessage('@Besh_beshs', `🎉 New User: ${username} (ID: ${userId})`);
        }
    } catch (e) {
        console.log("Channel Notification Error:", e.message);
    }


    return newUser;
}

// =================================================================
// 4. SUPER FAST WEBHOOK HANDLER
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

                const caption = `<b>Welcome ${username}!</b>\n\nClick the button below to start earning points.`;

                try {
                    await bot.sendPhoto(chatId, WELCOME_IMG, {
                        caption: caption, 
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [[{ text: "Open App", web_app: { url: `${webUrl}?userId=${chatId}` } }]] }
                    });
                } catch (imgError) {
                    await bot.sendMessage(chatId, caption, {
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [[{ text: "Open App", web_app: { url: `${webUrl}?userId=${chatId}` } }]] }
                    });
                }
            }
        }
        res.status(200).send('OK');
    } catch (e) {
        res.status(200).send('Error'); 
    }
});

// =================================================================
// 5. MINI APP API ROUTES (USER FACING)
// =================================================================

app.post('/api/ensure-user', async (req, res) => {
    const { userId, username, refParam } = req.body;
    try { await ensureUserExists(userId, username, refParam); res.json({success: true}); }
    catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error:"Not found"});

    // Update name
    let updateNeeded = false;
    let updates = {};

    if(req.query.name && u.username !== req.query.name) {
        updates.username = req.query.name;
        u.username = req.query.name;
        updateNeeded = true;
    }

    // Daily Streak Logic
    const now = Date.now();
    const lastLogin = new Date(u.lastLoginDate || 0);
    const today = new Date(now);

    // Check if it's a new day
    if(lastLogin.getDate() !== today.getDate() || lastLogin.getMonth() !== today.getMonth()) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const diffDays = Math.floor((now - lastLogin.getTime()) / msPerDay);

        if(diffDays <= 2) {
            updates.streak = (u.streak || 0) + 1;
            if(updates.streak > 7) updates.streak = 1; // Reset after 7
            updates.points = (u.points||0) + (updates.streak * 10); // Reward
            u.points = updates.points;
        } else {
            updates.streak = 1; // Reset streak if missed a day
        }
        updates.lastLoginDate = now;
        u.streak = updates.streak;
        updateNeeded = true;
    }

    if(updateNeeded) dbUpdate(`users/${userId}`, updates).catch(()=>{});

    // Fast Rank
    try {
        const allUsers = Object.values(await dbGet('users') || {});
        const sorted = allUsers.sort((a,b) => (b.points||0) - (a.points||0));
        const rank = sorted.findIndex(x => x.username === u.username) + 1;
        u.rank = rank > 0 ? rank : '-';
    } catch(e) { u.rank = '-'; }

    res.json(u);
});

app.post('/api/update-avatar', async (req, res) => {
    const { userId, avatar } = req.body;
    await dbUpdate(`users/${userId}`, { customAvatar: avatar });
    res.json({success:true});
});

app.get('/api/config', async (req, res) => res.json((await dbGet('config')) || {}));
app.get('/api/tasks', async (req, res) => res.json((await dbGet('bonusTasks')) || {}));
app.get('/api/referrer/:id', async (req, res) => {
    const s = await dbGet(`users/${req.params.id}`);
    res.json({username: s ? s.username : 'Unknown'});
});

// ACTIONS
app.post('/api/claim-ad-reward', async (req, res) => {
    const u = await dbGet(`users/${req.body.userId}`);
    if(u) {
        await dbUpdate(`users/${req.body.userId}`, { points: (u.points || 0) + 10, logs: logUserAction(u, 'Claimed Special Ad (+10)') });
        res.json({success:true});
    } else res.status(404).json({error:"Not found"});
});

app.post('/api/watch-ad', async (req, res) => {
    const u = await dbGet(`users/${req.body.userId}`);
    const c = (await dbGet('config')) || {};
    if(u) {
        const pts = (c.pointsPerAd || 50) * (c.globalMultiplier || 1);
        await dbUpdate(`users/${req.body.userId}`, {
            points: (u.points || 0) + pts,
            adsWatchedToday: (u.adsWatchedToday || 0) + 1,
            totalAdsWatchedLifetime: (u.totalAdsWatchedLifetime || 0) + 1,
            logs: logUserAction(u, `Watched Ad (+${pts})`)
        });
        res.json({success:true});
    } else res.status(404).send();
});

// GAMES
app.post('/api/game/spin', async (req, res) => {
    const u = await dbGet(`users/${req.body.userId}`);
    if(!u) return res.status(404).send();
    if(u.lastSpinDate && (Date.now() - u.lastSpinDate < 86400000)) return res.json({error: "Already spun today"});

    const amounts = [10, 20, 50, 100, 200, 500];
    const amount = amounts[Math.floor(Math.random() * amounts.length)];

    await dbUpdate(`users/${req.body.userId}`, {
        points: u.points + amount,
        lastSpinDate: Date.now(),
        logs: logUserAction(u, `Spun Wheel (+${amount})`)
    });
    res.json({success:true, amount});
});

app.post('/api/game/scratch', async (req, res) => {
    const u = await dbGet(`users/${req.body.userId}`);
    if(!u) return res.status(404).send();
    if(u.lastScratchDate && (Date.now() - u.lastScratchDate < 86400000)) return res.json({error: "Already scratched today"});

    const amount = Math.floor(Math.random() * 50) + 10;

    await dbUpdate(`users/${req.body.userId}`, {
        points: u.points + amount,
        lastScratchDate: Date.now(),
        logs: logUserAction(u, `Scratched Card (+${amount})`)
    });
    res.json({success:true, amount});
});

// PROMO
app.post('/api/claim-promo', async (req, res) => {
    const { userId, code } = req.body;
    const promos = await dbGet('promos') || {};
    const u = await dbGet(`users/${userId}`);

    if(!promos[code]) return res.json({error: "Invalid code"});
    if(u.claimedPromos && u.claimedPromos.includes(code)) return res.json({error: "Already claimed"});
    if(promos[code].limit > 0 && promos[code].uses >= promos[code].limit) return res.json({error: "Code limit reached"});

    await dbUpdate(`promos/${code}`, { uses: (promos[code].uses || 0) + 1 });
    await dbUpdate(`users/${userId}`, {
        points: u.points + promos[code].reward,
        claimedPromos: [...(u.claimedPromos||[]), code],
        logs: logUserAction(u, `Claimed Promo ${code} (+${promos[code].reward})`)
    });

    res.json({success:true, amount: promos[code].reward});
});

// WITHDRAWAL
app.post('/api/request-withdrawal', async (req, res) => {
    const { userId, amount, method, account, accountName } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = (await dbGet('config')) || {};

    // Auto-approve logic
    let status = 'pending';
    if(c.autoApproveLimit > 0 && amount <= c.autoApproveLimit) status = 'approved';

    const wid = Date.now().toString();
    const wData = { id: wid, userId, amount, method, account, accountName, status, date: Date.now() };

    await dbSet(`withdrawals/${wid}`, wData);
    await dbUpdate(`users/${userId}`, {
        points: u.points - amount,
        totalWithdrawn: (u.totalWithdrawn || 0) + Number(amount),
        lastWithdrawalStats: { referrals: u.referredUsers?.length||0, ads: u.totalAdsWatchedLifetime||0 },
        logs: logUserAction(u, `Requested Withdrawal (-${amount}) - ${status}`)
    });

    if(status === 'approved') {
        // Log recent payout for ticker
        const payouts = await dbGet('recentPayouts') || [];
        payouts.unshift({ name: u.username, amount: amount });
        if(payouts.length > 10) payouts.pop();
        await dbSet('recentPayouts', payouts);
    }

    if(c.telegramChatId) {
        bot.sendMessage(c.telegramChatId, `<b>Withdrawal Request</b>\nUser: ${u.username}\nAmount: ${amount}\nMethod: ${method}\nAccount: ${account}\nStatus: ${status}`, {parse_mode:'HTML'}).catch(()=>{});
    }
    res.json({success:true, status});
});

app.get('/api/recent-payouts', async (req, res) => {
    res.json((await dbGet('recentPayouts')) || []);
});

app.post('/api/verify-membership', async (req, res) => {
    const { userId, taskId, channelId, reward } = req.body;
    try {
        const m = await bot.getChatMember(channelId, userId);
        if(['creator','administrator','member'].includes(m.status)) {
            const u = await dbGet(`users/${userId}`);
            if(u.claimedBonuses?.includes(taskId)) return res.status(400).json({error:"Claimed"});
            await dbUpdate(`users/${userId}`, {
                points: (u.points||0)+reward,
                claimedBonuses: [...(u.claimedBonuses||[]), taskId],
                logs: logUserAction(u, `Completed Task ${taskId} (+${reward})`)
            });
            res.json({success:true, points: (u.points||0)+reward});
        } else res.status(400).json({error:"Not Joined"});
    } catch(e) { res.status(500).json({error:"Bot not admin in channel"}); }
});

app.get('/api/leaderboard/:userId', async (req, res) => {
    const users = Object.values(await dbGet('users') || {});
    // Exclude banned users
    const validUsers = users.filter(x => !x.isBanned);
    res.json({
        byPoints: [...validUsers].sort((a,b)=>(b.points||0)-(a.points||0)).slice(0,50),
        byReferrals: [...validUsers].sort((a,b)=>(b.referredUsers?.length||0)-(a.referredUsers?.length||0)).slice(0,50)
    });
});

// =================================================================
// 6. ADMIN API (Protected)
// =================================================================
const checkAdmin = (req, res, next) => { if(req.body.secret !== ADMIN_SECRET) return res.status(403).json({error:"Auth failed"}); next(); };

app.post('/api/admin/stats', checkAdmin, async (req, res) => {
    const u = await dbGet('users')||{};
    const w = await dbGet('withdrawals')||{};
    const c = await dbGet('config')||{};

    let p = 0;
    const usersArr = Object.values(u);
    usersArr.forEach(x => p += (x.points||0));

    // Calculate online in last 5 min
    const fiveMinsAgo = Date.now() - (5 * 60 * 1000);
    const online = usersArr.filter(x => x.lastLoginDate > fiveMinsAgo).length;

    // Top Referrers for Chart
    const topRefs = usersArr.sort((a,b)=>(b.referredUsers?.length||0)-(a.referredUsers?.length||0)).slice(0,5).map(x => ({id: x.username, username: x.username, refs: x.referredUsers?.length||0}));

    // Generate mock growth chart data based on joined dates
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = new Date().getDay();
    const labels = [];
    for(let i=6; i>=0; i--) labels.push(days[(today-i+7)%7]);

    res.json({
        users: Object.keys(u).length,
        withdrawals: Object.values(w).filter(x=>x.status==='pending').length,
        points: p,
        online,
        config: c,
        topRefs,
        chartData: { labels, data: [10, 25, 15, 30, 45, 20, 50] } // Mock growth data
    });
});

app.post('/api/admin/find-user', checkAdmin, async (req, res) => {
    const query = req.body.query;
    const users = await dbGet('users')||{};
    // Search by ID, username, phone (account)
    let found = users[query];
    if(!found) found = Object.values(users).find(u => u.username?.toLowerCase() === query.toLowerCase());

    if(!found) {
        const w = await dbGet('withdrawals')||{};
        const withdrawal = Object.values(w).find(x => x.account === query);
        if(withdrawal) found = users[withdrawal.userId];
    }

    if(found) {
        found.id = Object.keys(users).find(k => users[k] === found);
        res.json(found);
    } else {
        res.json({error:"Not found"});
    }
});

app.post('/api/admin/action', checkAdmin, async (req, res) => {
    const { query: userId, action, newBalance } = req.body;

    if(action==='update-balance') {
        const u = await dbGet(`users/${userId}`);
        await dbUpdate(`users/${userId}`, {points: parseInt(newBalance), logs: logUserAction(u, `Admin set balance to ${newBalance}`)});
    }
    if(action==='reset-ads') {
        const u = await dbGet(`users/${userId}`);
        await dbUpdate(`users/${userId}`, {adsWatchedToday: 0, logs: logUserAction(u, `Admin reset daily ads`)});
    }
    if(action==='toggle-ban') {
        const u = await dbGet(`users/${userId}`);
        await dbUpdate(`users/${userId}`, {isBanned: !u.isBanned, logs: logUserAction(u, `Admin ${u.isBanned?'unbanned':'banned'} user`)});
    }
    if(action==='broadcast') {
         const { targetType, targetId, style, message, photoUrl, btnText, btnUrl } = req.body;
         const ids = targetType==='single' ? [targetId] : Object.keys(await dbGet('users')||{});

         if(style === 'bot') {
             ids.forEach(id => {
                 const opts = { parse_mode:'HTML' };
                 if(btnText && btnUrl) opts.reply_markup = { inline_keyboard: [[{text: btnText, url: btnUrl}]] };
                 if(photoUrl) bot.sendPhoto(id, photoUrl, { caption: message, ...opts }).catch(()=>{});
                 else bot.sendMessage(id, message, opts).catch(()=>{});
             });
         } else if(style === 'toast') {
             // For global toasts, we would set it in config and app checks it
             const c = await dbGet('config') || {};
             await dbUpdate('config', { globalToast: { msg: message, expires: Date.now() + 86400000 } });
         }
    }
    res.json({success:true});
});

app.post('/api/admin/bulk-ban', checkAdmin, async (req, res) => {
    const { ids } = req.body;
    let count = 0;
    for(const id of ids) {
        const u = await dbGet(`users/${id}`);
        if(u) {
            await dbUpdate(`users/${id}`, {isBanned: true, logs: logUserAction(u, `Admin bulk banned`)});
            count++;
        }
    }
    res.json({success:true, count});
});

app.post('/api/admin/config-update', checkAdmin, async (req, res) => {
    if(req.body.fullConfig) await dbUpdate('config', req.body.fullConfig);
    if(req.body.partial) await dbUpdate('config', req.body.partial);
    res.json({success:true});
});

// Tasks
app.post('/api/admin/get-tasks', checkAdmin, async (req, res) => res.json(await dbGet('bonusTasks')||{}));
app.post('/api/admin/tasks', checkAdmin, async (req, res) => {
    const id = req.body.task.id || `t_${Date.now()}`;
    await dbSet(`bonusTasks/${id}`, {...req.body.task, id, order: req.body.task.order||Date.now()});
    res.json({success:true});
});
app.post('/api/admin/tasks/delete', checkAdmin, async (req, res) => { await dbRemove(`bonusTasks/${req.body.taskId}`); res.json({success:true}); });
app.post('/api/admin/tasks/reorder', checkAdmin, async (req, res) => {
    const { orderedIds } = req.body;
    const tasks = await dbGet('bonusTasks')||{};
    for(let i=0; i<orderedIds.length; i++) {
        const id = orderedIds[i];
        if(tasks[id]) await dbUpdate(`bonusTasks/${id}`, { order: i });
    }
    res.json({success:true});
});

// Withdrawals
app.post('/api/admin/get-withdrawals', checkAdmin, async (req, res) => {
    const w = await dbGet('withdrawals')||{};
    res.json(Object.values(w).filter(x=>x.status==='pending'));
});
app.post('/api/admin/withdraw-action', checkAdmin, async (req, res) => {
    await dbUpdate(`withdrawals/${req.body.id}`, {status: req.body.type});
    res.json({success:true});
});

// Promos
app.post('/api/admin/promo/list', checkAdmin, async (req, res) => {
    const p = await dbGet('promos')||{};
    res.json(Object.values(p));
});
app.post('/api/admin/promo/create', checkAdmin, async (req, res) => {
    const { code, reward, limit } = req.body;
    await dbSet(`promos/${code}`, { code, reward, limit, uses: 0 });
    res.json({success:true});
});
app.post('/api/admin/promo/delete', checkAdmin, async (req, res) => {
    await dbRemove(`promos/${req.body.code}`);
    res.json({success:true});
});

// Export CSV
app.post('/api/admin/export-csv', checkAdmin, async (req, res) => {
    const { type } = req.body;
    let csv = '';

    if(type === 'users') {
        const users = Object.values(await dbGet('users')||{});
        csv = 'ID,Username,Points,Joined,Referred By,Invites,Total Ads,Withdrawn,Banned\n';
        users.forEach(u => {
            const id = u.id || u.username;
            csv += `${id},${u.username},${u.points},${new Date(u.createdAt).toISOString()},${u.referredBy||''},${u.referredUsers?.length||0},${u.totalAdsWatchedLifetime||0},${u.totalWithdrawn||0},${u.isBanned}\n`;
        });
    } else if (type === 'withdrawals') {
        const w = Object.values(await dbGet('withdrawals')||{});
        csv = 'ID,Date,User ID,Amount,Method,Account,Name,Status\n';
        w.forEach(x => {
            csv += `${x.id},${new Date(x.date).toISOString()},${x.userId},${x.amount},${x.method},${x.account},${x.accountName},${x.status}\n`;
        });
    }

    res.json({ success: true, csv });
});

// =================================================================
// GAME API (Phase 3)
// =================================================================

app.post('/api/spin', async (req, res) => {
    // Game 1: Spin Wheel (Rigged)
    // 75% chance for a specific reward chosen by admin
    const { userId } = req.body;
    const c = await dbGet('config') || {};
    const riggedReward = c.spinRiggedReward || "10 Gems"; // Admin configured

    let result = "";
    const rand = Math.random();
    if (rand < 0.75) {
        result = riggedReward;
    } else if (rand < 0.99) {
        result = "5 Gems"; // small fallback
    } else {
        result = "1000 Gems"; // <1% chance for high payout
    }

    res.json({ success: true, result });
});

app.post('/api/combo', async (req, res) => {
    // Game 2: Combo (Verification)
    const { userId, combination } = req.body;
    const c = await dbGet('config') || {};
    const correctCombo = c.dailyCombo || []; // Array of IDs
    const reward = c.comboReward || 50;

    const isCorrect = JSON.stringify(combination) === JSON.stringify(correctCombo);
    if(isCorrect) {
        const u = await dbGet(`users/${userId}`);
        await dbUpdate(`users/${userId}`, { points: (u.points||0) + reward });
        res.json({ success: true, isCorrect, reward });
    } else {
        res.json({ success: true, isCorrect });
    }
});

app.post('/api/aviator/start', async (req, res) => {
    const { userId, bets } = req.body;
    const user = await dbGet(`users/${userId}`);

    // Cryptographically Secure RNG (CSPRNG)
    const buf = crypto.randomBytes(4);
    const rand = buf.readUInt32BE(0) / 0xFFFFFFFF; // Generates 0 to 1

    let crashPoint = 0.99 / (1 - (rand === 1 ? 0.999 : rand));
    crashPoint = parseFloat(Math.max(1.00, crashPoint).toFixed(2));

    let totalBet = 0;
    bets.forEach(b => {
        if(b.active) totalBet += b.amount;
    });

    await dbUpdate(`users/${userId}`, { points: (user.points||0) - totalBet });

    // Store current round for validation
    const roundId = Date.now().toString();
    await dbSet(`aviatorRounds/${roundId}`, { crashPoint, active: true });

    res.json({ success: true, crashPoint, roundId });
});

app.post('/api/aviator/cashout', async (req, res) => {
    const { userId, roundId, multiplier, betAmount } = req.body;
    const round = await dbGet(`aviatorRounds/${roundId}`);

    if(!round || !round.active || multiplier > round.crashPoint) {
        return res.json({ success: false, error: "Invalid cashout" });
    }

    const user = await dbGet(`users/${userId}`);
    const winnings = betAmount * multiplier;

    await dbUpdate(`users/${userId}`, { points: (user.points||0) + winnings });
    res.json({ success: true, winnings });
});

app.post('/api/ox', async (req, res) => {
    // Game 4: OX (Tic-Tac-Toe & Wagering)
    const { userId, bet, playBot } = req.body;
    const user = await dbGet(`users/${userId}`);

    // For single requests, we emulate the result directly here since we lack WS setup in this snippet
    // If playBot is true (Hard mode), win chance < 10%
    // If real player matchmaking fails, we fake a bot and user has 75% win chance

    const rand = Math.random();
    let winChance = playBot ? 0.08 : 0.75;

    const win = rand < winChance;
    if(win) {
        await dbUpdate(`users/${userId}`, { points: (user.points||0) + bet }); // User wins pot
    } else {
        await dbUpdate(`users/${userId}`, { points: (user.points||0) - bet }); // User loses bet
    }

    res.json({ success: true, win });
});

app.post('/api/mines', async (req, res) => {
    // Game 5: Mines
    const { userId, bet, spacesCleared } = req.body;
    const user = await dbGet(`users/${userId}`);

    // Simplistic rigged check for now
    const win = Math.random() < 0.4;
    if(win) {
        const reward = bet * (1 + (spacesCleared * 0.1));
        await dbUpdate(`users/${userId}`, { points: (user.points||0) + reward - bet });
    } else {
        await dbUpdate(`users/${userId}`, { points: (user.points||0) - bet });
    }
    res.json({ success: true, win });
});

app.post('/api/plinko', async (req, res) => {
    // Game 6: Plinko
    const { userId, bet } = req.body;
    const user = await dbGet(`users/${userId}`);

    // Multipliers
    const multipliers = [0.2, 0.5, 1.1, 1.5, 3.0, 10.0];
    // Rigged weights
    const rand = Math.random();
    let multiIndex = 0;
    if(rand < 0.4) multiIndex = 0; // 0.2
    else if(rand < 0.7) multiIndex = 1; // 0.5
    else if(rand < 0.9) multiIndex = 2; // 1.1
    else if(rand < 0.96) multiIndex = 3; // 1.5
    else if(rand < 0.99) multiIndex = 4; // 3.0
    else multiIndex = 5; // 10.0

    const payout = bet * multipliers[multiIndex];
    await dbUpdate(`users/${userId}`, { points: (user.points||0) + payout - bet });

    res.json({ success: true, multiplier: multipliers[multiIndex], payout });
});

app.post('/api/admin/odds', checkAdmin, async (req, res) => {
    const { aviatorCrash, spinReward } = req.body;
    await dbUpdate('config', {
        aviatorCrashThreshold: aviatorCrash,
        spinRiggedReward: spinReward
    });
    res.json({ success: true });
});

app.post('/api/admin/combo-set', checkAdmin, async (req, res) => {
    const { combination, reward } = req.body;
    await dbUpdate('config', { dailyCombo: combination, comboReward: reward });
    res.json({ success: true });
});

app.get('/api/avatar/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        if (photos.total_count > 0) {
            const fileId = photos.photos[0][0].file_id;
            const file = await bot.getFile(fileId);
            const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
            const response = await fetch(url);
            const buffer = await response.buffer();
            res.set('Content-Type', 'image/jpeg');
            res.send(buffer);
        } else {
            res.status(404).send('No avatar found');
        }
    } catch (e) {
        res.status(500).send('Error fetching avatar');
    }
});

// Backup
app.post('/api/admin/backup-db', checkAdmin, async (req, res) => {
    // Note: Since we don't have a direct "getAll" for the root in our helper,
    // we fetch the main branches manually for backup
    const users = await dbGet('users')||{};
    const withdrawals = await dbGet('withdrawals')||{};
    const config = await dbGet('config')||{};
    const bonusTasks = await dbGet('bonusTasks')||{};
    const promos = await dbGet('promos')||{};

    res.json({ success: true, db: { users, withdrawals, config, bonusTasks, promos }});
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));

// Export for Vercel
export default app;

app.listen(3000, () => console.log('Server running on 3000'));
