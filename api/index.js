import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Required for Node < 18 (Vercel default)

// =================================================================
// 1. CONFIGURATION
// =================================================================
const DB_BASE_URL = "https://data-myfa.vercel.app/api/db/warningbot"; 
const DB_SECRET_KEY = "IOtJTi_L3F-7Je8Y";

// FIXED: Direct Image Link (The previous link was a webpage, which crashes the bot)
const WELCOME_IMG = "https://i.ibb.co/GQxC1zDf/Resized-Image-2026-01-11-09-14-06-1.png"; 

// YOUR NEW API LINK
const IMAGE_API_URL = "https://welcomeapi.vercel.app/api";

const BOT_TOKEN = process.env.BOT_TOKEN || '8509274087:AAFm2BTuXcgaY7KNoihTKnVgK8sNBces9p0'; 
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "Yichu123";

// IMPORTANT: Polling must be false for Serverless/Vercel
const bot = new TelegramBot(BOT_TOKEN, { polling: false }); 
const app = express();

app.use(express.json());
app.use(cors());

// =================================================================
// 2. DATABASE HELPER FUNCTIONS (Optimized)
// =================================================================
async function dbCall(endpoint, method, data = null) {
    try {
        const url = `${DB_BASE_URL}/${endpoint}`;
        const options = {
            method: method,
            headers: { "Content-Type": "application/json", "x-secret-key": DB_SECRET_KEY }
        };
        if (data) options.body = JSON.stringify(data);

        // Timeout to prevent Vercel execution freeze
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
        options.signal = controller.signal;

        const response = await fetch(url, options);
        clearTimeout(timeout);

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`DB Error (${endpoint}):`, error.message);
        return null;
    }
}

async function dbGet(path) { return await dbCall(path, 'GET'); }
async function dbSet(path, data) { return await dbCall(path, 'POST', data); }
async function dbUpdate(path, partialData) {
    const currentData = await dbGet(path) || {};
    const mergedData = { ...(typeof currentData === 'object' ? currentData : {}), ...partialData };
    return await dbSet(path, mergedData);
}
async function dbRemove(path) { return await dbCall(path, 'DELETE'); }


// =================================================================
// 3. CORE LOGIC: USER CREATION & REFERRALS (UPDATED)
// =================================================================
async function ensureUserExists(userId, username, refParam) {
    // 1. Check if user exists (Fast Check)
    const existingUser = await dbGet(`users/${userId}`);
    if (existingUser) return existingUser;

    // 2. Fetch Config
    const config = (await dbGet('config')) || {};

    // 3. Prepare New User Data
    // Clean refParam (remove 'ref' prefix if exists)
    const referrerId = refParam ? refParam.replace(/^ref/, '') : null;

    const newUser = {
        username: username, 
        points: 0, 
        adsWatchedToday: 0, 
        totalAdsWatchedLifetime: 0,
        referredBy: referrerId || null, 
        referredUsers: [], 
        isBanned: false, 
        createdAt: Date.now()
    };

    // 4. Handle Referral Bonus
    if (referrerId && referrerId !== userId) {
        // Bonus for the new user (Referee)
        newUser.points = (config.referralBonusReferee || 0);

        // Bonus for the inviter (Referrer)
        const referrer = await dbGet(`users/${referrerId}`);
        if (referrer) {
            const rBonus = config.referralBonusReferrer || 0;
            const newRefList = [...(referrer.referredUsers || []), userId];

            // Update Referrer in DB
            await dbUpdate(`users/${referrerId}`, {
                points: (referrer.points || 0) + rBonus,
                referredUsers: newRefList
            });

            // Notify Referrer (Fire and forget to speed up)
            bot.sendMessage(referrerId, `🎉 New Referral: ${username} joined! +${rBonus} Pts`).catch(() => {});
        }
    }

    // 5. Save New User
    await dbSet(`users/${userId}`, newUser);

    // 6. Channel Notification (UPDATED WITH IMAGE API)
    try {
        const botInfo = await bot.getMe();
        const botId = BOT_TOKEN.split(':')[0]; // Extract ID from token

        // Prepare Data for Image API
        const params = new URLSearchParams();
        params.append('botToken', BOT_TOKEN);
        params.append('user1', botId);
        params.append('user2', userId);

        // Fetch Generated Image
        const imgResponse = await fetch(IMAGE_API_URL, {
            method: 'POST',
            body: params
        });

        if (imgResponse.ok) {
            const imgBuffer = await imgResponse.buffer();

            // Prepare Caption (Exact style from your request)
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
// We do NOT use bot.onText() because it uses event listeners 
// which cause Vercel to timeout or freeze. We handle raw updates.

app.post('/api/webhook', async (req, res) => {
    try {
        const update = req.body;

        // A. HANDLE MESSAGES (/start)
        if (update.message && update.message.text) {
            const msg = update.message;
            const chatId = msg.chat.id.toString();
            const text = msg.text;
            const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

            if (text.startsWith('/start')) {
                // Parse "ref123" from "/start ref123"
                const args = text.split(' ');
                const refParam = args.length > 1 ? args[1] : null;

                // 1. Create/Load User
                await ensureUserExists(chatId, username, refParam);

                // 2. Get Config for URL
                const config = (await dbGet('config')) || {};
                const webUrl = config.webAppUrl || 'https://earning-peach.vercel.app'; 

                // 3. Send Welcome Message
                const caption = `<b>${username} እንኳን ወደ MYFA BIRR መጡ </b>\n\nከታች ያለውን MYFA BIRR ምለውን ይጫኑ ገንዘብ ለማግኘት እና መተግበሪያውን ለመጀመር።`;

                try {
                    await bot.sendPhoto(chatId, WELCOME_IMG, {
                        caption: caption, 
                        parse_mode: 'HTML',
                        reply_markup: { 
                            inline_keyboard: [[{ text: "🚀 MYFA BIRR ", web_app: { url: `${webUrl}?userId=${chatId}` } }]] 
                        }
                    });
                } catch (imgError) {
                    // Fallback if image fails (prevents "Nothing happened" error)
                    console.error("Image failed, sending text:", imgError.message);
                    await bot.sendMessage(chatId, caption, {
                        parse_mode: 'HTML',
                        reply_markup: { 
                            inline_keyboard: [[{ text: "🚀 MYFA BIRR ", web_app: { url: `${webUrl}?userId=${chatId}` } }]] 
                        }
                    });
                }
            }
        }

        // B. HANDLE CALLBACK QUERIES (Optional)
        // if (update.callback_query) { ... }

        // Respond OK immediately so Telegram stops retrying
        res.status(200).send('OK');

    } catch (e) {
        console.error("Webhook Logic Error:", e);
        // Always send 200 to Telegram even on error, otherwise it keeps retrying
        res.status(200).send('Error'); 
    }
});


// =================================================================
// 5. MINI APP API ROUTES
// =================================================================

// Auto-Register from Mini App (If they didn't click start)
app.post('/api/ensure-user', async (req, res) => {
    const { userId, username, refParam } = req.body;
    try {
        await ensureUserExists(userId, username, refParam);
        res.json({success: true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const u = await dbGet(`users/${userId}`);

    if(!u) return res.status(404).json({error:"Not found"});

    // Update name if changed
    if(req.query.name && u.username !== req.query.name) {
        // Non-blocking update
        dbUpdate(`users/${userId}`, {username:req.query.name}).catch(()=>{});
        u.username = req.query.name;
    }

    // Fast Rank Calculation
    try {
        const allUsers = Object.values(await dbGet('users') || {});
        const sorted = allUsers.sort((a,b) => (b.points||0) - (a.points||0));
        const rank = sorted.findIndex(x => x.username === u.username && x.createdAt === u.createdAt) + 1;
        u.rank = rank > 0 ? rank : '-';
    } catch(e) { u.rank = '-'; }

    res.json(u);
});

// Config & Tasks
app.get('/api/config', async (req, res) => res.json((await dbGet('config')) || {}));
app.get('/api/tasks', async (req, res) => res.json((await dbGet('bonusTasks')) || {}));
app.get('/api/referrer/:id', async (req, res) => {
    const s = await dbGet(`users/${req.params.id}`);
    res.json({username: s ? s.username : 'Unknown'});
});

// Actions
app.post('/api/claim-ad-reward', async (req, res) => {
    const u = await dbGet(`users/${req.body.userId}`);
    if(u) {
        await dbUpdate(`users/${req.body.userId}`, { points: (u.points || 0) + 10 });
        res.json({success:true});
    } else res.status(404).json({error:"User not found"});
});

app.post('/api/watch-ad', async (req, res) => {
    const u = await dbGet(`users/${req.body.userId}`);
    const c = (await dbGet('config')) || {};
    if(u) {
        const pts = (c.pointsPerAd || 50);
        await dbUpdate(`users/${req.body.userId}`, {
            points: (u.points || 0) + pts,
            adsWatchedToday: (u.adsWatchedToday || 0) + 1,
            totalAdsWatchedLifetime: (u.totalAdsWatchedLifetime || 0) + 1
        });
        res.json({success:true});
    } else res.status(404).send();
});

app.post('/api/request-withdrawal', async (req, res) => {
    const { userId, amount, method, account, accountName } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = (await dbGet('config')) || {};
    const wid = Date.now().toString();

    await dbSet(`withdrawals/${wid}`, { id: wid, userId, amount, method, account, accountName, status: 'pending', date: Date.now() });

    // Update user balance
    await dbUpdate(`users/${userId}`, {
        points: u.points - amount,
        totalWithdrawn: (u.totalWithdrawn || 0) + Number(amount),
        lastWithdrawalStats: { referrals: u.referredUsers?.length||0, ads: u.totalAdsWatchedLifetime||0 }
    });

    // Notify Admin (Fire & Forget)
    if(c.telegramChatId) {
        bot.sendMessage(c.telegramChatId, `🔔 *Withdrawal*: ${u.username} - ${amount} Pts\n${method} - ${account}`, {parse_mode:'Markdown'}).catch(()=>{});
    }
    res.json({success:true});
});

app.post('/api/verify-membership', async (req, res) => {
    const { userId, taskId, channelId, reward } = req.body;
    try {
        const m = await bot.getChatMember(channelId, userId);
        if(['creator','administrator','member'].includes(m.status)) {
            const u = await dbGet(`users/${userId}`);
            if(u.claimedBonuses?.includes(taskId)) return res.status(400).json({error:"Claimed"});
            await dbUpdate(`users/${userId}`, { points: (u.points||0)+reward, claimedBonuses: [...(u.claimedBonuses||[]), taskId] });
            res.json({success:true, points: (u.points||0)+reward});
        } else res.status(400).json({error:"Not Joined"});
    } catch(e) { res.status(500).json({error:"Bot not admin"}); }
});

app.get('/api/leaderboard/:userId', async (req, res) => {
    const users = Object.values(await dbGet('users') || {});
    res.json({
        byPoints: [...users].sort((a,b)=>(b.points||0)-(a.points||0)).slice(0,50),
        byReferrals: [...users].sort((a,b)=>(b.referredUsers?.length||0)-(a.referredUsers?.length||0)).slice(0,50)
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
    let p = 0; Object.values(u).forEach(x => p += (x.points||0));
    res.json({ users: Object.keys(u).length, withdrawals: Object.values(w).filter(x=>x.status==='pending').length, points: p, config: c });
});

app.post('/api/admin/find-user', checkAdmin, async (req, res) => res.json(await dbGet(`users/${req.body.userId}`)));

app.post('/api/admin/action', checkAdmin, async (req, res) => {
    const { userId, action, newBalance } = req.body;
    if(action==='update-balance') await dbUpdate(`users/${userId}`, {points: parseInt(newBalance)});
    if(action==='reset-ads') await dbUpdate(`users/${userId}`, {adsWatchedToday: 0});
    if(action==='toggle-ban') { const u = await dbGet(`users/${userId}`); await dbUpdate(`users/${userId}`, {isBanned: !u.isBanned}); }
    if(action==='broadcast') {
         const ids = req.body.targetType==='single' ? [req.body.targetId] : Object.keys(await dbGet('users')||{});
         ids.forEach(id => bot.sendMessage(id, req.body.message, {parse_mode:'HTML'}).catch(()=>{}));
    }
    res.json({success:true});
});

app.post('/api/admin/config-update', checkAdmin, async (req, res) => { await dbUpdate('config', req.body.fullConfig); res.json({success:true}); });
app.post('/api/admin/tasks', checkAdmin, async (req, res) => { const id = req.body.task.id || `t_${Date.now()}`; await dbSet(`bonusTasks/${id}`, {...req.body.task, id}); res.json({success:true}); });
app.post('/api/admin/tasks/delete', checkAdmin, async (req, res) => { await dbRemove(`bonusTasks/${req.body.taskId}`); res.json({success:true}); });
app.post('/api/admin/get-withdrawals', checkAdmin, async (req, res) => { const w = await dbGet('withdrawals')||{}; res.json(Object.values(w).filter(x=>x.status==='pending')); });
app.post('/api/admin/withdraw-action', checkAdmin, async (req, res) => { await dbUpdate(`withdrawals/${req.body.id}`, {status: req.body.type}); res.json({success:true}); });

// Export for Vercel
export default app;
