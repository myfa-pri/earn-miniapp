import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import crypto from 'crypto';

// ============================================================================
// 1. SYSTEM CONFIGURATION & SECURITY
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
    // UPDATE: Even if user exists, we can update their display name to latest Real Account Name if we wanted, 
    // but we will prioritize keeping the initial one or updating if blank.
    if (existingUser) {
        const now = Date.now();
        if (!existingUser.accountName || existingUser.accountName === 'Unknown User') {
            existingUser.accountName = username;
        }
        let streakCount = existingUser.streakCount || 1;
        const lastLogin = existingUser.lastLoginTimestamp || existingUser.lastLoginDate;
        if (lastLogin) {
            const diff = now - lastLogin;
            const hours = diff / (1000 * 60 * 60);
            if (hours >= 24 && hours <= 48) {
                streakCount++;
            } else if (hours > 48) {
                streakCount = 1;
            }
        }
        // Auto-claim logic
        if (existingUser.settings?.autoClaimDaily) {
            const bonus = streakCount * 50;
            existingUser.points = (existingUser.points || 0) + bonus;
        }
        
        await dbUpdate(`users/${userId}`, { 
            accountName: existingUser.accountName, 
            username: existingUser.accountName,
            lastLoginTimestamp: now,
            lastLoginDate: now,
            streakCount: streakCount,
            points: existingUser.points
        });
        existingUser.streakCount = streakCount;
        existingUser.lastLoginTimestamp = now;
        return existingUser;
}

    const config = (await dbGet('config')) || {};
    const referrerId = refParam ? refParam.replace(/^ref/, '') : null;

    const newUser = {
        username: username, accountName: username, points: 0, realBalance: 0, adsWatchedToday: 0, totalAdsWatchedLifetime: 0,
        referredBy: referrerId || null, referredUsers: [], isBanned: false, claimedBonuses: [],
        createdAt: Date.now(), streak: 1, lastLoginDate: Date.now(),
        logs: [`[${new Date().toISOString()}] Account created`]
    };

    if (referrerId && referrerId !== userId) {
        newUser.points = (config.referralBonusReferee || 0);
        const referrer = await dbGet(`users/${referrerId}`);
        if (referrer) {
            if (config.gateEnabled) {
                newUser.referralAwarded = false;
                newUser.referredBy = referrerId;
            } else {
                const rBonus = config.referralBonusReferrer || 0;
                const rBonusAmount = parseFloat(rBonus);
                const newRefList = [...(referrer.referredUsers || []), userId];
                await dbUpdate(`users/${referrerId}`, { 
                    realBalance: (referrer.realBalance || 0) + rBonusAmount, 
                    referredUsers: newRefList, 
                    logs: logAction(referrer, `Invited ${username} (+$${rBonusAmount} Cash)`) 
                });
                newUser.referralAwarded = true;
                bot.sendMessage(referrerId, `<b>🎉 New Referral!</b>\n${username} joined using your link!\nYou earned +$${rBonusAmount} Cash.`, {parse_mode:'HTML'}).catch(() => {});
            }
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
// 4. TELEGRAM WEBHOOK SETUP & LISTENER 
// ============================================================================

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

app.post('/api/webhook', async (req, res) => {
    try {
        const update = req.body;

        if (update.message && update.message.text) {
            const msg = update.message;
            const chatId = msg.chat.id.toString();
            const text = msg.text;
            
            // Capture Real Account Name
            const firstName = msg.from.first_name || '';
            const lastName = msg.from.last_name || '';
            const accountName = `${firstName} ${lastName}`.trim() || 'Unknown User';

            if (text.startsWith('/start')) {
                const args = text.split(' ');
                const refParam = args.length > 1 ? args[1] : null;
                await ensureUserExists(chatId, accountName, refParam);
                
                const config = (await dbGet('config')) || {};
                const protocol = req.headers['x-forwarded-proto'] || 'https';
                const host = req.headers.host;
                const fallbackUrl = `${protocol}://${host}`;
                const webUrl = (config && config.webAppUrl) ? config.webAppUrl : fallbackUrl; 
                const caption = `<b>${accountName} እንኳን ወደ MYFA BIRR መጡ! </b>\n\nከታች ያለውን MYFA BIRR የሚለውን ይጫኑ ገንዘብ ለማግኘት እና መተግበሪያውን ለመጀመር።`;

                // TASK 1 FIX: Strictly use pure webUrl, NEVER append ?userId=
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
            } else if (text === '/admin') {
                const config = (await dbGet('config')) || {};
                const protocol = req.headers['x-forwarded-proto'] || 'https';
                const host = req.headers.host;
                const fallbackUrl = `${protocol}://${host}`;
                const webUrl = (config && config.webAppUrl) ? config.webAppUrl : fallbackUrl; 
                const adminIds = (config.adminTelegramIds || '').split(',').map(id => id.trim());
                
                if (adminIds.includes(chatId)) {
                    const caption = `<b>Welcome Admin ${accountName}</b>\n\nClick below to open the Admin Panel.`;
                    await bot.sendMessage(chatId, caption, {
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [[{ text: "⚙️ Open Admin Panel", web_app: { url: `${webUrl}/myfa.html` } }]] }
                    });
                } else {
                    await bot.sendMessage(chatId, "Unauthorized.", { parse_mode: 'HTML' });
                }
            }
        }
        return res.status(200).send('OK');
    } catch (e) { 
        console.error("Webhook Error:", e);
        return res.status(200).send('OK');
    }
});

// ============================================================================
// 5. USER FACING APIs (Profile, Config, Tasks)
// ============================================================================
const ipCache = {};
app.get('/api/check-ip', async (req, res) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if(clientIp && clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();
    if(ipCache[clientIp]) return res.json(ipCache[clientIp]);
    
    try {
        const response = await fetch(`https://ipapi.co/${clientIp}/json/`);
        const data = await response.json();
        const badOrgs = ['AWS', 'Amazon', 'Google Cloud', 'DigitalOcean', 'Hostinger', 'Azure', 'Linode', 'Hetzner', 'OVH'];
        const isVpn = data.vpn || data.proxy || data.tor || (data.org && badOrgs.some(o => data.org.toLowerCase().includes(o.toLowerCase())));
        const result = { allowed: !isVpn };
        ipCache[clientIp] = result;
        return res.json(result);
    } catch(e) {
        return res.json({ allowed: true });
    }
});
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const sessionId = req.query.sessionId;
    let u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error:"Not found"});

    // Max Sessions Logic
    const config = await dbGet('config') || {};
    if (sessionId && config.maxSessions > 0) {
        u.activeSessions = u.activeSessions || [];
        if (!u.activeSessions.includes(sessionId)) {
            u.activeSessions.push(sessionId);
        }
        if (u.activeSessions.length > config.maxSessions) {
            u.activeSessions.shift(); // Remove oldest
        }
        if (!u.activeSessions.includes(sessionId)) {
            return res.status(401).json({ error: "Session revoked", logout: true });
        }
    }

    const now = Date.now();
    const lastLogin = new Date(u.lastLoginDate || 0);
    const today = new Date(now);

    // Daily Streak & Escrow Yield Logic
    if(lastLogin.getDate() !== today.getDate() || lastLogin.getMonth() !== today.getMonth()) {
        const diffDays = Math.floor((now - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
        if(diffDays <= 2) {
            u.streak = Math.min(7, Math.max(Number(u.streak || 0), Number(u.streakCount || 0)) + 1);
            u.streakCount = u.streak; 
        } else {
            u.streak = 1;
            u.streakCount = 1;
        }
        
        let dailyYield = 0;
        if ((u.stuckBalance || 0) > 0) {
            dailyYield = Math.floor(u.stuckBalance * 0.01);
            u.points = (u.points || 0) + dailyYield;
            u.escrowYield = (u.escrowYield || 0) + dailyYield;
            if(dailyYield > 0) {
                u.logs = logAction(u, `Escrow Staking Yield: +${dailyYield} Gems (1% of ${u.stuckBalance})`);
            }
        }

        u.lastLoginDate = now;
        u.lastActivityDate = now;
        u.monetagWatchedToday = 0;
        u.adsgramWatchedToday = 0;
        u.adsterraWatchedToday = 0;
        dbUpdate(`users/${userId}`, { 
            streak: u.streak, streakCount: u.streakCount, lastLoginDate: now, lastActivityDate: now, activeSessions: u.activeSessions, 
            monetagWatchedToday: 0, adsgramWatchedToday: 0, adsterraWatchedToday: 0,
            points: u.points, escrowYield: u.escrowYield, logs: u.logs
        }).catch(()=>{});
    } else if (sessionId) {
        dbUpdate(`users/${userId}`, { activeSessions: u.activeSessions }).catch(()=>{});
    }

    

    // TASK 1: ALWAYS ON GATE CHECK
    if (config.gateEnabled && config.officialChannels && config.officialChannels.length > 0) {
        const checks = config.officialChannels.map(ch => fetchMultiAPI(ch.id, userId, BOT_TOKEN));
        const results = await Promise.all(checks);
        const allPassed = results.every(member => member.success);
        if (!allPassed) {
            u.requireGate = true;
            u.isOfficialMember = false;
        } else {
            u.requireGate = false;
            u.isOfficialMember = true;
        }
    }

    // TASK 5: 7-DAY ANTI-LEAVE SYSTEM (LAZY EVALUATION AUDIT)
    if (u.active7DayEscrows && u.active7DayEscrows.length > 0) {
        let keptEscrows = [];
        let audits = [];
        let auditIndices = [];

        for (let i = 0; i < u.active7DayEscrows.length; i++) {
            const escrow = u.active7DayEscrows[i];
            if (now - escrow.timestamp >= 604800000) {
                // Cleared 7 days safely. Do not keep it in the active list.
            } else {
                audits.push(fetchMultiAPI(escrow.channelId, userId, BOT_TOKEN));
                auditIndices.push(escrow);
            }
        }

        if (audits.length > 0) {
            const results = await Promise.all(audits);
            for (let i = 0; i < results.length; i++) {
                const escrow = auditIndices[i];
                const member = results[i];

                if (member.status !== 'error' && !member.success) {
                    // Penalty Applied! (Left Early)
                    u.points = (u.points || 0) - escrow.reward;
                    u.logs = logAction(u, `Penalty: Left Sponsored Channel early. (-${escrow.reward} Gems)`);

                    // Refund Sponsor
                    const sponsor = await dbGet(`users/${escrow.sponsorUserId}`);
                    if (sponsor) {
                        await dbUpdate(`users/${escrow.sponsorUserId}`, {
                            stuckBalance: (sponsor.stuckBalance || 0) + escrow.reward
                        });
                    }
                    
                    // Decrement Claims
                    const campaign = await dbGet(`campaigns/${escrow.taskId}`);
                    if (campaign) {
                        await dbUpdate(`campaigns/${escrow.taskId}`, {
                            claims: Math.max(0, (campaign.claims || 0) - 1)
                        });
                    }

                    // Fire Telegram Alert
                    bot.sendMessage(userId, `🚨 <b>Penalty Applied!</b>\nYou left a sponsored channel before 7 days. Your Gems (-${escrow.reward}) have been deducted and refunded to the sponsor.`, {parse_mode: 'HTML'}).catch(()=>{});
                    
                } else {
                    // Passed audit (still in channel, but not 7 days yet). Keep it.
                    keptEscrows.push(escrow);
                }
            }
        }
        
        // Update user state with remaining escrows
        u.active7DayEscrows = keptEscrows;
        await dbUpdate(`users/${userId}`, { 
            active7DayEscrows: keptEscrows,
            points: u.points,
            logs: u.logs
        }).catch(()=>{});
    }

    // Rank is intentionally not calculated here. The leaderboard endpoint owns rank calculation
    // so the hot profile endpoint does not scan every user on every page load.
    u.streakCount = Math.max(1, Number(u.streakCount || 0), Number(u.streak || 0));
    u.streak = u.streakCount;
    if (!u.lastActivityDate) u.lastActivityDate = u.lastLoginDate || Date.now();

    res.json(u);
});

let leaderboardCache = { byPoints: [] };
app.get('/api/leaderboard/:id', async (req, res) => {
    const userId = req.params.id;
    const config = await dbGet('config') || {};
    
    let u = await dbGet(`users/${userId}`);
    let userRank = '-';
    
    if (config.leaderboardFreeze) {
        return res.json({ frozen: true, byPoints: leaderboardCache.byPoints, userRankPoints: u ? u.rank : '-' });
    }

    const usersObj = await dbGet('users');
    if(!usersObj) return res.json({ frozen: false, byPoints: [], userRankPoints: '-' });
    
    const usersArr = Object.values(usersObj).filter(x => !x.isBanned);
    const sorted = usersArr.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    if (u) {
        const rankIndex = sorted.findIndex(x => x.username === u.username);
        userRank = rankIndex >= 0 ? rankIndex + 1 : '-';
        if(userRank !== '-') {
            u.rank = userRank;
            dbUpdate(`users/${userId}`, { rank: userRank }).catch(()=>{});
        }
    }

    const top100 = sorted.slice(0, 100).map(user => ({
        id: user.id || '',
        accountName: user.accountName || user.username || 'Anonymous',
        username: user.username || 'User',
        points: user.points,
        isVip: user.isVip || false,
        avatarUrl: user.avatarUrl || null
    }));
    
    leaderboardCache = { byPoints: top100 };
    res.json({ frozen: false, byPoints: top100, userRankPoints: userRank });
});

// TASK 1: LIGHT-SPEED TELEGRAM MEMBERSHIP API
async function fetchMultiAPI(channelId, userId, botToken) {
    try {
        const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channelId}&user_id=${userId}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ok && ['creator', 'administrator', 'member', 'restricted'].includes(data.result.status)) {
            return { success: true, status: data.result.status };
        }
        
        // Return clear error if bot is not admin or user not found
        if (!data.ok) {
            console.error("TG API Error:", data.description);
            if (data.description.includes('bot is not a member') || data.description.includes('chat not found')) {
                return { success: false, status: 'error', error: "Bot must be an admin in the channel/group!" };
            }
        }
        
        return { success: false, status: data.ok ? data.result.status : 'error' };
    } catch (e) {
        console.error("Fetch Error:", e.message);
        return { success: false, status: 'error' };
    }
}

async function nativeTelegramCheck(channelId, userId) {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${channelId}&user_id=${userId}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.ok && ['creator', 'administrator', 'member', 'restricted'].includes(data.result.status)) {
            return { success: true, status: data.result.status };
        }
        return { success: false, status: data.ok ? data.result.status : 'error' };
    } catch (e) {
        return { success: false, status: 'error' };
    }
}

// Tasks & Referrals
app.get('/api/tasks', async (req, res) => {
    const bonusTasks = await dbGet('bonusTasks') || {};
    
    // Fetch and process campaigns (Sponsor Tasks)
    const campaignsObj = await dbGet('campaigns') || {};
    const sponsorTasks = Object.values(campaignsObj)
        .filter(c => {
            if (c.schemaVersion === 2) {
                return c.task && c.task.enabled === true && c.delivery && c.delivery.status === 'Running';
            }
            // Must not be paused
            if(c.paused) return false;
            // Claims must be less than maxUsers limit
            if(c.claims >= c.maxUsers) return false;
            return true;
        })
        .map(c => {
            if (c.schemaVersion === 2) {
                return {
                    ...c,
                    reward: c.task.reward,
                    maxUsers: Math.floor(c.budget.total / c.task.reward),
                    claims: c.analytics.conversions,
                    type: c.task.type
                };
            }
            return c;
        })
        .sort((a, b) => b.reward - a.reward); // Sort strictly by reward DESC

    res.json({ bonusTasks, sponsorTasks });
});

// TASK 4: Auto Verify Sponsor Task
app.post('/api/sponsor/verify-auto', async (req, res) => {
    const { userId, taskId, channelId, reward } = req.body;
    
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error:"Not found"});
    
    // Check if already claimed
    if((u.claimedSponsorTasks || []).includes(taskId)) {
        return res.json({success: false, error: "Already claimed"});
    }

    const c = await dbGet(`campaigns/${taskId}`);
    if(!c) return res.status(404).json({error:"Campaign not found"});
    if(c.paused || c.claims >= c.maxUsers) return res.json({success: false, error: "Campaign is closed or full"});

    try {
        const member = await fetchMultiAPI(channelId, userId, BOT_TOKEN);
        if (member.status === 'error') {
            return res.json({ success: false, error: member.error || "Verification failed. Is the bot an admin in the channel?" });
        }
        if (member.success) {
            // Update Campaign claims
            await dbUpdate(`campaigns/${taskId}`, { claims: (c.claims || 0) + 1 });
            
            // Deduct reward from Sponsor's stuckBalance
            const sponsor = await dbGet(`users/${c.userId}`);
            if(sponsor) {
                await dbUpdate(`users/${c.userId}`, { 
                    stuckBalance: Math.max(0, (sponsor.stuckBalance || 0) - c.reward)
                });
            }

            // Reward User
            const finalReward = c.reward;
            const newBal = (u.points||0) + finalReward;
            const newClaimed = [...(u.claimedSponsorTasks||[]), taskId];
            
            // TASK 5: Add to active7DayEscrows
            const newEscrows = [...(u.active7DayEscrows||[]), {
                taskId, channelId, reward: finalReward, sponsorUserId: c.userId, timestamp: Date.now()
            }];
            
            await dbUpdate(`users/${userId}`, {
                claimedSponsorTasks: newClaimed,
                active7DayEscrows: newEscrows,
                points: newBal,
                logs: logAction(u, `Completed Sponsor Task '${c.name}' (+${finalReward} Gems)`)
            });
            
            return res.json({ success: true, points: newBal });
        } else {
            return res.json({ success: false, error: "Not Joined" });
        }
    } catch (e) {
        return res.json({ success: false, error: "Not Joined" });
    }
});

// TASK 4: Manual Verify Sponsor Task (Screenshot Upload)
app.post('/api/sponsor/verify-manual', async (req, res) => {
    const { userId, taskId, imageBase64 } = req.body;
    
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error:"Not found"});
    
    // Check if already claimed
    if((u.claimedSponsorTasks || []).includes(taskId)) {
        return res.json({success: false, error: "Already claimed"});
    }

    const c = await dbGet(`campaigns/${taskId}`);
    if(!c) return res.status(404).json({error:"Campaign not found"});
    if(c.paused || c.claims >= c.maxUsers) return res.json({success: false, error: "Campaign is closed or full"});

    // Add to Campaign Queue
    const queue = c.queue || [];
    // Check if already in queue
    if(queue.find(q => q.userId === userId)) {
        return res.json({success: false, error: "Verification already pending"});
    }

    const submissionId = 'sub_' + Date.now();
    queue.push({
        id: submissionId,
        userId: userId,
        imgUrl: imageBase64, // In a real app we'd upload to S3, but Base64 is fine for this demo
        submittedAt: Date.now()
    });

    await dbUpdate(`campaigns/${taskId}`, { queue });

    // Mark as claimed for the user so they can't submit again
    const newClaimed = [...(u.claimedSponsorTasks||[]), taskId];
    await dbUpdate(`users/${userId}`, {
        claimedSponsorTasks: newClaimed,
        logs: logAction(u, `Submitted proof for Sponsor Task '${c.name}'`)
    });

    res.json({ success: true });
});

app.post('/api/verify-membership', async (req, res) => {
    const { userId, taskId, channelId, reward } = req.body;
    const u = await dbGet(`users/${userId}`);
    let isSponsor = false;
    let t = await dbGet(`bonusTasks/${taskId}`);

    if (!t) {
        t = await dbGet(`campaigns/${taskId}`);
        isSponsor = true;
    }

    const c = await dbGet('config') || {};
    if(!u || !t) return res.status(404).json({error:"Not found"});

    if(!isSponsor && (u.claimedBonuses||[]).includes(taskId)) return res.json({success:true, alreadyClaimed:true});
    if(isSponsor && (u.claimedSponsorTasks||[]).includes(taskId)) return res.json({success:true, alreadyClaimed:true});
    
    try {
        const member = await fetchMultiAPI(channelId, userId, BOT_TOKEN);
        if (member.status === 'error') {
            return res.json({ success: false, error: member.error || "Verification failed. Is the bot an admin in the channel?" });
        }
        if (member.success) {
            
            // CHECK TASK LIMITS
            let rewardVal = (t.reward || reward || 0) * (c.globalMultiplier || 1);
            let rType = t.rewardType || 'gems';

            if (!isSponsor && t.maxUsers && t.maxUsers > 0) {
                if ((t.claims || 0) >= t.maxUsers) return res.json({ success: false, error: "Task is full!" });
                await dbUpdate(`bonusTasks/${taskId}`, { claims: (t.claims || 0) + 1 });
            }
            
            if (isSponsor) {
                const max = t.maxUsers || (t.task ? t.task.maxUsers : 0) || 0;
                const claims = t.claims || (t.analytics ? t.analytics.conversions : 0) || 0;
                const taskReward = t.reward || (t.task ? t.task.reward : reward);
                rewardVal = taskReward * (c.globalMultiplier || 1);

                if (max > 0 && claims >= max) return res.json({ success: false, error: "Task is full!" });

                // Update sponsor claims/analytics
                await dbUpdate(`campaigns/${taskId}`, {
                    claims: claims + 1,
                    analytics: {
                        ...(t.analytics || {}),
                        conversions: claims + 1
                    }
                });
            }

            const updates = {};
            if(isSponsor) {
                updates.claimedSponsorTasks = [...(u.claimedSponsorTasks||[]), taskId];
            } else {
                updates.claimedBonuses = [...(u.claimedBonuses||[]), taskId];
            }
            
            let logMsg = `Completed task ${t.name || t.title || 'Sponsor Task'}`;
            
            if (rType === 'money') {
                updates.realBalance = (u.realBalance || 0) + rewardVal;
                logMsg += ` (+${rewardVal} Birr)`;
            } else {
                updates.points = (u.points || 0) + rewardVal;
                updates.dropGameChances = (u.dropGameChances || 0) + 1;
                logMsg += ` (+${rewardVal} Gems & 1 Drop Chance)`;
            }

            updates.logs = logAction(u, logMsg);
            await dbUpdate(`users/${userId}`, updates);

            return res.json({ success: true });
        } else {
            return res.json({ success: false, error: "Not Joined" });
        }
    } catch(e) {
        return res.json({ success: false, error: e.message });
    }
});


app.get('/api/dropgame/status/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const u = await dbGet(`users/${userId}`);
        if (!u) return res.status(404).json({ success: false, error: 'User not found' });
        const now = new Date();
        const lastPlay = new Date(u.lastDropGamePlay || 0);
        let chances = u.dropGameChances !== undefined ? Number(u.dropGameChances) : 1;
        if (now.getDate() !== lastPlay.getDate() || now.getMonth() !== lastPlay.getMonth() || now.getFullYear() !== lastPlay.getFullYear()) {
            chances = Math.max(chances, 1);
        }
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, chancesRemaining: Math.max(0, chances) });
    } catch (e) {
        return res.status(500).json({ success: false, error: 'Failed to load Drop Game status' });
    }
});

app.post('/api/dropgame/start', async (req, res) => {
    try {
        const { userId } = req.body;
        const u = await dbGet(`users/${userId}`);
        if(!u) return res.status(404).json({success: false, error: "User not found"});

        const now = new Date();
        const lastPlay = new Date(u.lastDropGamePlay || 0);
        let chances = u.dropGameChances !== undefined ? u.dropGameChances : 1;

        // Daily reset logic
        if(now.getDate() !== lastPlay.getDate() || now.getMonth() !== lastPlay.getMonth() || now.getFullYear() !== lastPlay.getFullYear()) {
            chances = Math.max(chances, 1);
        }

        if(chances <= 0) {
            return res.json({success: false, error: "No chances left today"});
        }

        const sessionId = `drop_${userId}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
        await dbUpdate(`users/${userId}`, {
            dropGameChances: chances - 1,
            lastDropGamePlay: now.toISOString(),
            currentDropGameScore: 0,
            activeDropSession: sessionId,
            activeDropStartedAt: Date.now()
        });

        res.json({success: true, sessionId, chancesRemaining: chances - 1});
    } catch(e) {
        console.error(e);
        res.status(500).json({success: false, error: e.message});
    }
});

app.post('/api/dropgame/claim', async (req, res) => {
    try {
        const { userId, score, sessionId } = req.body;
        const u = await dbGet(`users/${userId}`);
        if(!u) return res.status(404).json({success: false, error: "User not found"});

        if(!u.activeDropSession || u.activeDropSession !== sessionId) {
            return res.json({success: false, error: "Invalid Session"});
        }

        // Basic security check to prevent abuse, e.g. unrealistic score
        const safeScore = Math.max(0, Math.min(150, Number(score) || 0));
        if(!Number.isFinite(safeScore)) {
            return res.json({success: false, error: 'Invalid score'});
        }
        if(score > 150) { 
            return res.json({success: false, error: "Score too high"});
        }

        const newPoints = (u.points || 0) + safeScore;
        await dbUpdate(`users/${userId}`, { points: newPoints, activeDropSession: null, activeDropStartedAt: null, currentDropGameScore: 0 });

        res.json({success: true, points: newPoints,
        dropGameChances: u.dropGameChances, added: safeScore});
    } catch(e) {
        console.error(e);
        res.status(500).json({success: false, error: e.message});
    }
});
// =======================================================

// TASK 3: PROMO CODES
app.post('/api/claim-promo', async (req, res) => {
    const { userId, code } = req.body;
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error:"Not found"});
    const promos = await dbGet('promos') || {};
    const promo = promos[code];
    if(!promo) return res.json({ success: false, error: "Invalid Code" });
    
    // Support limit or maxUses
    const limit = promo.limit !== undefined ? promo.limit : (promo.maxUses !== undefined ? promo.maxUses : 999);
    
    if((promo.uses || 0) >= limit) return res.json({ success: false, error: "Limit Reached" });
    if((u.claimedPromos || []).includes(code)) return res.json({ success: false, error: "Already Claimed" });
    
    promo.uses = (promo.uses || 0) + 1;
    await dbUpdate(`promos/${code}`, { uses: promo.uses });
    
    const reward = parseInt(promo.reward) || 0;
    const newBal = (u.points || 0) + reward;
    
    await dbUpdate(`users/${userId}`, {
        points: newBal, claimedPromos: [...(u.claimedPromos || []), code],
        logs: logAction(u, `Claimed promo code ${code} (+${reward} Gems)`)
    });
    res.json({ success: true, newBal: newBal, reward: reward, streakCount: streakCount, claimDate: today });
});

// TASK 5: VERIFY GATE ROUTE
app.post('/api/verify-gate', async (req, res) => {
    const { userId } = req.body;
    const c = await dbGet('config') || {};
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error: "User not found"});

    try {
        if (!c.officialChannels || c.officialChannels.length === 0) {
            return res.json({ success: true });
        }

        const checks = c.officialChannels.map(ch => nativeTelegramCheck(ch.id, userId));
        const results = await Promise.all(checks);
        
        const allPassed = results.every(member => member.success);

        if (allPassed) {
            let updates = { isOfficialMember: true };
            
            // Referral Logic Validation
            if (u.referralAwarded === false && u.referredBy) {
                const referrer = await dbGet(`users/${u.referredBy}`);
                if (referrer) {
                    const rBonus = c.referralBonusReferrer || 0;
                    const rBonusAmount = parseFloat(rBonus);
                    const newRefList = [...(referrer.referredUsers || []), userId];
                    await dbUpdate(`users/${u.referredBy}`, { 
                        realBalance: (referrer.realBalance || 0) + rBonusAmount, 
                        referredUsers: newRefList, 
                        logs: logAction(referrer, `Invited user passed channel gate: +$${rBonusAmount} Cash`) 
                    });
                    bot.sendMessage(u.referredBy, `<b>🎉 New Referral Verified!</b>\n${u.accountName} joined the channel.\nYou earned +$${rBonusAmount} Cash.`, {parse_mode:'HTML'}).catch(() => {});
                    updates.referralAwarded = true;
                }
            }
            await dbUpdate(`users/${userId}`, updates);
            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: "You must join all channels to continue!" });
        }
    } catch(e) {
        return res.json({ success: false, message: "You must join all channels to continue!", error: e.message });
    }
});

app.get('/api/referrer/:id', async (req, res) => {
    const userId = req.params.id;
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.json([]);
    
    const usersObj = await dbGet('users') || {};
    const refs = (u.referredUsers || []).map(refId => {
        const refU = usersObj[refId];
        return {
            id: refId,
            accountName: refU ? (refU.accountName || refU.username) : 'Unknown',
            createdAt: refU ? refU.createdAt : 0
        };
    });
    res.json(refs);
});



app.post('/api/first-open-complete', async (req, res) => {
        const { userId } = req.body;
        if (!userId) return res.json({ success: false, error: "Missing user" });
        try {
            const u = await dbGet(`users/${userId}`);
            const c = await dbGet('config') || {};
            if (!u) return res.json({ success: false, error: "User not found" });

            if (u.firstOpenCompleted) {
                return res.json({ success: false, error: "Already completed." });
            }

            const updateData = { firstOpenCompleted: true };
            
            if (c.enableFirstOpenReward && parseFloat(c.firstOpenRewardAmount) > 0) {
                const rewardType = c.firstOpenRewardType || 'gems';
                const amount = parseFloat(c.firstOpenRewardAmount);
                
                if (rewardType === 'money') {
                    updateData.realBalance = (u.realBalance || 0) + amount;
                } else if (rewardType === 'spin') {
                    updateData.freeSpins = (u.freeSpins || 0) + amount;
                } else if (rewardType === 'scratch') {
                    updateData.freeScratches = (u.freeScratches || 0) + amount;
                } else if (rewardType === 'drop') {
                    updateData.freeDrops = (u.freeDrops || 0) + amount;
                } else {
                    updateData.points = (u.points || 0) + amount;
                }
            }

            await dbUpdate(`users/${userId}`, updateData);
            res.json({ success: true, updated: updateData });
        } catch (e) {
            console.error(e);
            res.json({ success: false, error: "Server error." });
        }
    });

app.post('/api/ensure-user', async (req, res) => {
    const { userId, username, refParam } = req.body;
    try { await ensureUserExists(userId, username, refParam); res.json({success: true}); }
    catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/config', async (req, res) => res.json((await dbGet('config')) || {}));

// TASK 5: Real Avatar Fetcher
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
    const { userId, network } = req.body;
    const u = await dbGet(`users/${userId}`);
    const c = (await dbGet('config')) || {};
    if(u) {
        const limit = network === 'monetag' ? (c.monetagLimit || 5) : (c.adsgramLimit || 5);
        const watchedToday = network === 'monetag' ? (u.monetagWatchedToday || 0) : (u.adsgramWatchedToday || 0);

        if (watchedToday >= limit) return res.status(403).json({ error: "Limit reached" });

        const realMoneyAmount = parseFloat(c.realMoneyPerAd || 0.05);
        
        let updates = {
            realBalance: (u.realBalance || 0) + realMoneyAmount,
            totalAdsWatchedLifetime: (u.totalAdsWatchedLifetime || 0) + 1,
            logs: logAction(u, `Watched ${network} Ad (+$${realMoneyAmount})`)
        };
        if (network === 'monetag') updates.monetagWatchedToday = watchedToday + 1;
        else if (network === 'adsgram') updates.adsgramWatchedToday = watchedToday + 1;

        await dbUpdate(`users/${userId}`, updates);
        res.json({success:true, added: realMoneyAmount});
    } else res.status(404).send();
});

// TASK 2: ADSGRAM S2S WEBHOOK
app.get('/api/adsgram-reward', async (req, res) => {
    const userId = req.query.userid;
    if(!userId) return res.status(400).json({ error: "Missing userid" });
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({ error: "User not found" });
    
    const c = (await dbGet('config')) || {};
    const realMoneyAmount = parseFloat(c.realMoneyPerAd || 0.05);
    const watchedToday = (u.adsgramWatchedToday || 0);
    
    let updates = {
        realBalance: (u.realBalance || 0) + realMoneyAmount,
        totalAdsWatchedLifetime: (u.totalAdsWatchedLifetime || 0) + 1,
        adsgramWatchedToday: watchedToday + 1,
        logs: logAction(u, `Adsgram S2S Reward (+$${realMoneyAmount})`)
    };
    
    await dbUpdate(`users/${userId}`, updates);
    res.status(200).json({ success: true });
});

// TASK 2: ADSTERRA REWARD
app.post('/api/adsterra-reward', async (req, res) => {
    const { userId } = req.body;
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({ error: "User not found" });
    
    const c = (await dbGet('config')) || {};
    const limit = c.adsterraLimit || 10;
    const watchedToday = (u.adsterraWatchedToday || 0);
    
    if (watchedToday >= limit) return res.status(400).json({ error: "Daily limit reached" });
    
    const realMoneyAmount = parseFloat(c.realMoneyPerAd || 0.01);
    
    let updates = {
        realBalance: (u.realBalance || 0) + realMoneyAmount,
        totalAdsWatchedLifetime: (u.totalAdsWatchedLifetime || 0) + 1,
        adsterraWatchedToday: watchedToday + 1,
        logs: logAction(u, `Watched Adsterra Ad (+$${realMoneyAmount} Cash)`)
    };
    
    await dbUpdate(`users/${userId}`, updates);
    res.status(200).json({ success: true });
});

// TASK 2: EXCHANGE REPLACEMENT 
app.post('/api/exchange', async (req, res) => {
    const { userId, amount, mode } = req.body; // mode: 'gemsToCash' or 'cashToGems'
    const u = await dbGet(`users/${userId}`);
    const c = await dbGet('config') || {};
    const rate = c.exchangeRate || 100; // e.g. 100 Gems = 1 Unit
    
    // Legacy support for frontend not updated yet
    const exchangeMode = mode || 'gemsToCash';
    const exchangeAmt = amount || req.body.gemsToExchange;
    
    if (exchangeMode === 'gemsToCash') {
        if(u.points < exchangeAmt) return res.status(400).json({error: "Not enough Gems"});
        
        let realMoney = exchangeAmt / rate;
        let taxAmount = 0;
        
        if (c.taxRate && parseFloat(c.taxRate) > 0) {
            taxAmount = exchangeAmt * (parseFloat(c.taxRate) / 100);
            realMoney = (exchangeAmt - taxAmount) / rate;
            const stats = await dbGet('stats') || {};
            stats.totalBurned = (stats.totalBurned || 0) + taxAmount;
            await dbUpdate('stats', stats).catch(()=>{});
        }

        await dbUpdate(`users/${userId}`, { 
            points: u.points - exchangeAmt, 
            realBalance: (u.realBalance||0) + realMoney,
            logs: logAction(u, `Exchanged ${exchangeAmt} Gems (Tax: ${taxAmount}) for ${realMoney} Units`)
        });
        res.json({ success: true, realMoney, points: u.points - exchangeAmt });
    } else if (exchangeMode === 'cashToGems') {
        if((u.realBalance || 0) < exchangeAmt) return res.status(400).json({error: "Not enough Cash"});
        
        let gemsReceived = exchangeAmt * rate;
        let taxAmount = 0;
        
        if (c.cashToGemsTaxRate && parseFloat(c.cashToGemsTaxRate) > 0) {
            taxAmount = exchangeAmt * (parseFloat(c.cashToGemsTaxRate) / 100);
            gemsReceived = (exchangeAmt - taxAmount) * rate;
            // No burn for cash? Or maybe just note it
        }

        await dbUpdate(`users/${userId}`, { 
            points: u.points + gemsReceived, 
            realBalance: (u.realBalance||0) - exchangeAmt,
            logs: logAction(u, `Exchanged ${exchangeAmt} Units (Tax: ${taxAmount}) for ${gemsReceived} Gems`)
        });
        res.json({ success: true, gemsReceived, realBalance: (u.realBalance||0) - exchangeAmt });
    }
});

app.post('/api/promo/redeem', async (req, res) => {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({error: "Missing parameters"});
    
    const promo = await dbGet(`promos/${code}`);
    if (!promo) return res.status(404).json({error: "Invalid promo code"});
    if (promo.uses >= promo.maxUses) return res.status(400).json({error: "Promo code expired"});
    
    const user = await dbGet(`users/${userId}`);
    if (!user) return res.status(404).json({error: "User not found"});
    
    if (user.redeemedPromos && user.redeemedPromos.includes(code)) {
        return res.status(400).json({error: "You have already redeemed this promo code"});
    }
    
    const newPoints = (user.points || 0) + parseInt(promo.reward);
    const redeemed = user.redeemedPromos ? [...user.redeemedPromos, code] : [code];
    
    await dbUpdate(`users/${userId}`, { 
        points: newPoints,
        dropGameChances: newDropChances,
        redeemedPromos: redeemed,
        logs: logAction(user, `Redeemed promo code ${code} for ${promo.reward} Gems`)
    });
    
    await dbUpdate(`promos/${code}`, { uses: (promo.uses || 0) + 1 });
    
    res.json({ success: true, reward: promo.reward, newPoints });
});

app.post('/api/request-withdrawal', async (req, res) => {
    const { userId, amount, method, account, accountName } = req.body;
    if (method !== 'Telebirr') return res.status(400).json({ error: 'Only Telebirr is supported' });

    const u = await dbGet(`users/${userId}`);
    const c = (await dbGet('config')) || {};

    if (c.minWithdraw && amount < c.minWithdraw) return res.status(400).json({ error: `Minimum withdrawal is ${c.minWithdraw}` });
    if (c.maxWithdraw && amount > c.maxWithdraw) return res.status(400).json({ error: `Maximum withdrawal is ${c.maxWithdraw}` });

    if ((u.realBalance || 0) < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }

    let status = 'pending';
    const wid = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char txid
    const wData = { 
        id: wid, userId, amount: amount, originalAmount: amount, method, 
        account, accountName, status, date: Date.now() 
    };

    await dbSet(`withdrawals/${wid}`, wData);
    await dbUpdate(`users/${userId}`, {
        realBalance: (u.realBalance || 0) - amount,
        totalWithdrawn: (u.totalWithdrawn || 0) + Number(amount),
        withdrawCount: (u.withdrawCount || 0) + 1,
        logs: logAction(u, `Withdrawal Request: ${amount} via ${method} - ${status}`)
    });

    res.json({success:true, status});
});

// CRON JOB FOR AUTO WITHDRAWALS
app.get('/api/cron/process-withdrawals', async (req, res) => {
    try {
        const c = (await dbGet('config')) || {};
        if (!c.autoWithdrawEnabled) return res.json({ success: true, message: 'Auto withdraw disabled' });

        const delayMs = (c.autoWithdrawDelayMinutes || 5) * 60 * 1000;
        const now = Date.now();

        const withdrawals = await dbGet('withdrawals') || {};
        let processedCount = 0;

        for (const [wid, wData] of Object.entries(withdrawals)) {
            if (wData.status === 'pending' && wData.method === 'Telebirr') {
                if (now - wData.date >= delayMs) {
                    // It's time to process
                    let paymentSuccess = true;
                    let txid = wData.id;

                    // Mock Payment API Call if configured
                    if (c.paymentApiEndpoint) {
                        try {
                            const pRes = await fetch(c.paymentApiEndpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ amount: wData.amount, account: wData.account, name: wData.accountName })
                            });
                            if (!pRes.ok) paymentSuccess = false;
                            const pData = await pRes.json().catch(()=>({}));
                            if (pData.txid) txid = pData.txid;
                            if (pData.success === false) paymentSuccess = false;
                        } catch (e) {
                            paymentSuccess = false;
                        }
                    }

                    if (paymentSuccess) {
                        wData.status = 'paid';
                        
                        // Generate Receipt and Send to Channel
                        if (c.withdrawalChannelId && c.enableWithdrawalNotification) {
                            const d = new Date();
                            d.setUTCHours(d.getUTCHours() + 3); // UTC+3 Ethiopian time
                            const timeStr = d.toISOString().replace('T', ' ').substring(0, 19);
                            
                            const receiptUrl = `https://withdrawapi.vercel.app/api/generate?amount=${wData.amount}&name=${encodeURIComponent(wData.accountName)}&txid=${txid}&time=${encodeURIComponent(timeStr)}`;
                            
                            const caption = `<b>MYFA BIRR WITHDRAWAL</b>\n\nAmount: ${wData.amount} Birr\nAccount Holder: ${wData.accountName}\nMethod: Telebirr\nDate: ${timeStr}\nStatus: PAID\nTransaction: ${txid}\n`;
                            
                            try {
                                const response = await fetch(receiptUrl);
                                const imgBuffer = await response.buffer();
                                await bot.sendPhoto(c.withdrawalChannelId, imgBuffer, { caption, parse_mode: 'HTML' });
                            } catch(e) {
                                console.error('Failed to post withdrawal channel notif:', e);
                            }
                        }
                    } else {
                        wData.status = 'failed';
                        // Refund user if failed
                        const u = await dbGet(`users/${wData.userId}`);
                        if (u) {
                            await dbUpdate(`users/${wData.userId}`, {
                                realBalance: (u.realBalance || 0) + wData.amount,
                                logs: logAction(u, `Withdrawal Failed: ${wData.amount} refunded`)
                            });
                        }
                    }

                    await dbSet(`withdrawals/${wid}`, wData);
                    processedCount++;
                }
            }
        }
        res.json({ success: true, processedCount });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});


// Leaderboard route was moved to earlier in the file to fix duplicates.

// ============================================================================
// 6.5 DECENTRALIZED AD NETWORK & ESCROW SYSTEM
// ============================================================================

app.get('/api/campaigns/:userId', async (req, res) => {
    const { userId } = req.params;
    const campaigns = await dbGet('campaigns') || {};
    const userCampaigns = {};
    Object.keys(campaigns).forEach(id => {
        if(campaigns[id].userId === userId) userCampaigns[id] = campaigns[id];
    });
    res.json(userCampaigns);
});


app.post('/api/campaigns/create-v2', async (req, res) => {
    try {
        const { userId, campaign } = req.body;
        if (!userId) return res.json({ success: false, error: 'Missing userId' });

        let budgetTotal, budgetDaily;
        let finalCampaign = {};

        if (campaign) {
             budgetTotal = campaign.budget.total;
             budgetDaily = campaign.budget.daily;
             finalCampaign = campaign;
        } else {
             const config = req.body;
             budgetTotal = config.budget ? config.budget.total : 0;
             budgetDaily = config.budget ? config.budget.daily : 0;
             finalCampaign = config;
        }

        if(!budgetTotal) return res.json({ success: false, error: 'Invalid budget' });

        if (finalCampaign.creative && finalCampaign.creative.format === 'video' && finalCampaign.creative.duration > 10) {
            return res.json({success: false, error: "Video duration must be 10 seconds or less"});
        }

        const user = await dbGet(`users/${userId}`);
        if (!user) return res.json({ success: false, error: 'User not found' });

        if ((user.points || 0) < budgetTotal) {
            return res.json({ success: false, error: 'Insufficient balance' });
        }

        await dbUpdate(`users/${userId}`, {
            points: user.points - budgetTotal,
            stuckBalance: (user.stuckBalance || 0) + budgetTotal
        });

        const campId = "camp_v2_" + Date.now();
        const campData = {
            id: campId,
            ownerId: userId,
            schemaVersion: 2,
            ...finalCampaign,
            budget: { total: budgetTotal, daily: budgetDaily, spent: 0, reserved: budgetTotal },
            delivery: { status: "Running", priority: 1 },
            analytics: { impressions: 0, clicks: 0, conversions: 0 },
            createdAt: Date.now()
        };

        await dbUpdate(`campaigns/${campId}`, campData);
        res.json({ success: true, campId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    }
});


app.post('/api/campaigns/create', async (req, res) => {
    const { userId, type, icon, name, link, desc, maxUsers, reward } = req.body;
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error: "User not found"});
    
    const totalEscrow = maxUsers * reward;
    if(totalEscrow <= 0) return res.status(400).json({error: "Invalid amount"});
    if((u.points || 0) < totalEscrow) return res.status(400).json({error: "Not enough Gems"});

    const campaignId = 'camp_' + Date.now();
    const campaignData = {
        id: campaignId,
        userId, type, icon, name, link, desc, maxUsers, reward,
        claims: 0, views: 0, paused: false, autoRenew: false,
        queue: [], createdAt: Date.now()
    };

    await dbSet(`campaigns/${campaignId}`, campaignData);
    
    await dbUpdate(`users/${userId}`, {
        points: u.points - totalEscrow,
        stuckBalance: (u.stuckBalance || 0) + totalEscrow,
        logs: logAction(u, `Created Ad Campaign (Locked ${totalEscrow} Gems in Escrow)`)
    });

    res.json({success: true, campaignId});
});

app.post('/api/campaigns/update', async (req, res) => {
    const { userId, campaignId, action, link, desc, value } = req.body;
    const c = await dbGet(`campaigns/${campaignId}`);
    if(!c || c.userId !== userId) return res.status(403).json({error: "Unauthorized"});

    if(action === 'edit') {
        await dbUpdate(`campaigns/${campaignId}`, { link, desc });
    } else if(action === 'togglePause') {
        await dbUpdate(`campaigns/${campaignId}`, { paused: !c.paused });
    } else if(action === 'autoRenew') {
        await dbUpdate(`campaigns/${campaignId}`, { autoRenew: value });
    }
    res.json({success: true});
});

app.post('/api/campaigns/liquidate', async (req, res) => {
    const { userId, campaignId } = req.body;
    const c = await dbGet(`campaigns/${campaignId}`);
    if(!c || c.userId !== userId) return res.status(403).json({error: "Unauthorized"});

    const u = await dbGet(`users/${userId}`);
    const remainingGems = (c.maxUsers - (c.claims || 0)) * c.reward;
    
    if(remainingGems > 0) {
        await dbUpdate(`users/${userId}`, {
            points: (u.points || 0) + remainingGems,
            stuckBalance: Math.max(0, (u.stuckBalance || 0) - remainingGems),
            logs: logAction(u, `Liquidated Campaign Escrow (Refunded ${remainingGems} Gems)`)
        });
    }

    await dbRemove(`campaigns/${campaignId}`);
    res.json({success: true, refunded: remainingGems});
});

app.post('/api/campaigns/review', async (req, res) => {
    const { userId, campaignId, submissionId, action, reason } = req.body;
    const c = await dbGet(`campaigns/${campaignId}`);
    if(!c || c.userId !== userId) return res.status(403).json({error: "Unauthorized"});

    const queue = c.queue || [];
    const itemIndex = queue.findIndex(q => q.id === submissionId);
    if(itemIndex === -1) return res.status(404).json({error: "Not found"});
    const item = queue[itemIndex];
    queue.splice(itemIndex, 1);
    
    await dbUpdate(`campaigns/${campaignId}`, { queue });

    if(action === 'approve') {
        await dbUpdate(`campaigns/${campaignId}`, { claims: (c.claims || 0) + 1 });
        const submitter = await dbGet(`users/${item.userId}`);
        if(submitter) {
            await dbUpdate(`users/${item.userId}`, {
                points: (submitter.points || 0) + c.reward,
                logs: logAction(submitter, `Task Approved (+${c.reward} Gems)`)
            });
            // Reduce sponsor escrow
            const sponsor = await dbGet(`users/${userId}`);
            await dbUpdate(`users/${userId}`, {
                stuckBalance: Math.max(0, (sponsor.stuckBalance || 0) - c.reward)
            });
        }
    } else if(action === 'reject' && reason) {
        bot.sendMessage(item.userId, `<b>❌ Task Rejected</b>\nYour submission for task '${c.name}' was rejected.\n\n<b>Reason from Sponsor:</b>\n${reason}`, {parse_mode: 'HTML'}).catch(()=>{});
    }

    res.json({success: true});
});


// ============================================================================
// 7. WEB3 GAME ENGINES
// ============================================================================

// TASK 6: SHA-256 Aviator Engine & Forced Admin Control
app.post('/api/aviator/start', async (req, res) => {
    const { userId, betAmount } = req.body;
    const user = await dbGet(`users/${userId}`);
    const config = await dbGet('config') || {};

    let crashPoint = 1.00;
    // Unpredictable RNG via Provably Fair Server Seed
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const combined = `${serverSeed}-${Date.now()}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const rand = hashInt / 0xFFFFFFFF; // 0 to 1

    if (config.forcedAviatorCrash && !isNaN(parseFloat(config.forcedAviatorCrash))) {
        crashPoint = parseFloat(config.forcedAviatorCrash);
        await dbUpdate('config', { forcedAviatorCrash: "" }); // Reset after use
    } else {
        const houseEdge = config.aviatorHouseEdge ? parseFloat(config.aviatorHouseEdge) : 0.85;
        const maxThreshold = config.aviatorMaxThreshold ? parseFloat(config.aviatorMaxThreshold) : 2.00;
        
        // Cryptographically randomized but constrained by house edge
        if (rand < houseEdge) {
            crashPoint = parseFloat((1.00 + (rand * (maxThreshold - 1.00) / houseEdge)).toFixed(2));
        } else {
            crashPoint = parseFloat((maxThreshold + (rand * 10)).toFixed(2));
        }
    }

    await dbUpdate(`users/${userId}`, { 
        points: (user.points||0) - betAmount,
        logs: logAction(user, `Played Aviator (Bet: ${betAmount})`)
    });

    const roundId = Date.now().toString();
    
    const historyData = await dbGet('aviatorHistory') || [];
    const oldHistory = [...historyData]; // clone history for client before adding current round
    historyData.push(crashPoint);
    if(historyData.length > 15) historyData.shift();
    await dbSet('aviatorHistory', historyData);

    await dbSet(`aviatorRounds/${roundId}`, { crashPoint, active: true, serverHash: hash, seed: serverSeed });
    res.json({ success: true, crashPoint, roundId, history: oldHistory, serverHash: hash, seed: serverSeed });
});

app.post('/api/aviator/cashout', async (req, res) => {
    const { userId, roundId, multiplier, betAmount } = req.body;
    const round = await dbGet(`aviatorRounds/${roundId}`);
    const c = await dbGet('config') || {};
    if(!round || !round.active || multiplier > round.crashPoint) return res.json({ success: false });

    const user = await dbGet(`users/${userId}`);
    const winnings = Math.floor(betAmount * multiplier) * (c.globalMultiplier || 1);
    await dbUpdate(`users/${userId}`, { 
        points: (user.points||0) + winnings,
        logs: logAction(user, `Aviator Cashout: ${multiplier}x (Won ${winnings})`)
    });
    res.json({ success: true, winnings });
});

// Deprecated duplicate spin route removed.



app.post('/api/combo', async (req, res) => {
    const { userId, combination } = req.body;
    const c = await dbGet('config') || {};
    const u = await dbGet(`users/${userId}`);
    
    // TASK 4: Daily Combo Setter logic check
    const correctCombo = c.dailyCombo || ["c1","c2","c3","c4","c5","c6","c7","c8","c9"]; 
    const reward = (c.comboReward ? parseInt(c.comboReward) : 1000) * (c.globalMultiplier || 1);

    const today = new Date().toISOString().split('T')[0];
    if (u.comboDate !== today) {
        u.comboDate = today;
        u.comboTries = 3;
    }

    if (u.comboTries <= 0) return res.json({ success: false, msg: "No tries left today" });

    const isCorrect = JSON.stringify(combination) === JSON.stringify(correctCombo);
    if(isCorrect) {
        u.comboTries = 0;
        await dbUpdate(`users/${userId}`, { points: (u.points||0) + reward, comboDate: today, comboTries: 0, logs: logAction(u, `Solved Daily Combo (+${reward})`) });
        res.json({ success: true, isCorrect, reward });
    } else {
        u.comboTries--;
        await dbUpdate(`users/${userId}`, { comboDate: today, comboTries: u.comboTries });
        res.json({ success: true, isCorrect, triesLeft: u.comboTries });
    }
});

// TASK 3: Multi-player OX
app.post('/api/ox/result', async (req, res) => {
    const { userId, bet, result } = req.body; // result = 'win', 'loss', 'draw'
    const user = await dbGet(`users/${userId}`);
    const stats = await dbGet('stats') || { oxWagered: 0, oxBotProfit: 0 };
    const c = await dbGet('config') || {};
    
    stats.oxWagered = (stats.oxWagered || 0) + bet;
    let newBal = user.points || 0;
    
    if (result === 'loss') { // User lost to bot
        stats.oxBotProfit = (stats.oxBotProfit || 0) + bet;
        newBal -= bet;
        await dbUpdate(`users/${userId}`, { points: newBal, logs: logAction(user, `Lost OX Game vs Bot (-${bet})`) });
    } else if (result === 'win') { // User beat bot (impossible via pure minimax, but just in case)
        stats.oxBotProfit = (stats.oxBotProfit || 0) - bet;
        const reward = bet * (c.globalMultiplier || 1);
        newBal += reward;
        await dbUpdate(`users/${userId}`, { points: newBal, logs: logAction(user, `Won OX Game vs Bot (+${reward})`) });
    } // Draw: no changes to balance or bot profit
    
    await dbSet('stats', stats);
    res.json({ success: true, newBal });
});

// TASK 5: Pro Spin Wheel
app.post('/api/spin', async (req, res) => {
    const { userId } = req.body;
    const user = await dbGet(`users/${userId}`);
    if (!user) return res.status(404).json({error: "Not found"});

    const config = await dbGet('config') || {};
    const cost = parseInt(config.spinCost) || 10;
    
    let usedFree = false;
    if ((user.freeSpins || 0) > 0) {
        usedFree = true;
    } else if ((user.points || 0) < cost) {
        return res.status(400).json({error: "Not enough Gems"});
    }

    const forcedReward = parseInt(config.spinForcedReward) || 0;
    const slicesStr = config.spinSlices || '10, 50, 100, 200, 500, 1000';
    const slices = slicesStr.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
    
    let finalReward = 10;
    if (forcedReward > 0) {
        finalReward = forcedReward;
    } else if (slices.length > 0) {
        // Randomly pick from available slices, slight bias to lower amounts
        const rand = Math.random();
        if (rand < 0.6) finalReward = slices[0]; // Most common
        else if (rand < 0.85 && slices.length > 1) finalReward = slices[1];
        else if (rand < 0.95 && slices.length > 2) finalReward = slices[2];
        else finalReward = slices[Math.floor(Math.random() * slices.length)];
    }

    finalReward = finalReward * (config.globalMultiplier || 1);
    
    const updates = {};
    if (usedFree) {
        updates.freeSpins = user.freeSpins - 1;
        updates.points = (user.points || 0) + finalReward;
        updates.logs = logAction(user, `Spun wheel (Free): won ${finalReward} Gems`);
    } else {
        updates.points = (user.points || 0) - cost + finalReward;
        updates.logs = logAction(user, `Spun wheel: -${cost} Gems, won ${finalReward} Gems`);
    }

    await dbUpdate(`users/${userId}`, updates);
    res.json({ success: true, reward: finalReward, newBal: updates.points });
});

// TASK 6: Daily Scratch Card
app.post('/api/scratch', async (req, res) => {
    const { userId } = req.body;
    const user = await dbGet(`users/${userId}`);
    if (!user) return res.status(404).json({error: "Not found"});

    const config = await dbGet('config') || {};
    const cost = parseInt(config.scratchCost) || 50;
    
    let usedFree = false;
    if ((user.freeScratches || 0) > 0) {
        usedFree = true;
    } else if ((user.points || 0) < cost) {
        return res.status(400).json({error: "Not enough Gems"});
    }

    const minReward = parseInt(config.scratchMin) || 10;
    const maxReward = parseInt(config.scratchMax) || 100;
    const jackpotChance = parseInt(config.scratchJackpotChance) || 5;
    
    let finalReward = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
    
    // Jackpot logic
    if (Math.random() * 100 < jackpotChance) {
        finalReward = maxReward * 5; // 5x max reward for jackpot
    }

    finalReward = finalReward * (config.globalMultiplier || 1);
    
    const updates = {};
    if (usedFree) {
        updates.freeScratches = user.freeScratches - 1;
        updates.points = (user.points || 0) + finalReward;
        updates.logs = logAction(user, `Scratched card (Free): won ${finalReward} Gems`);
    } else {
        updates.points = (user.points || 0) - cost + finalReward;
        updates.logs = logAction(user, `Scratched card: -${cost} Gems, won ${finalReward} Gems`);
    }

    await dbUpdate(`users/${userId}`, updates);
    res.json({ success: true, reward: finalReward, newBal: updates.points });
});

// ============================================================================
// 7.4. MYFA DROP API
// ============================================================================
const activeDropSessions = new Map();

app.post('/api/game/drop/start', async (req, res) => {
    const { userId } = req.body;
    const user = await dbGet(`users/${userId}`);
    if (!user) return res.status(404).json({error: "Not found"});

    const config = await dbGet('config') || {};
    const dropLimit = parseInt(config.dropDailyLimit) || 3;
    
    const today = new Date().toISOString().split('T')[0];
    let playsToday = user.dropPlaysToday || 0;
    let lastDropDate = user.lastDropDate || '';
    
    if (lastDropDate !== today) {
        playsToday = 0;
        lastDropDate = today;
    }
    
    let usedFreeChance = false;
    if ((user.freeDrops || 0) > 0) {
        usedFreeChance = true;
    } else if (playsToday >= dropLimit) {
        return res.status(400).json({error: "Daily free plays exhausted"});
    }

    const sessionId = 'drop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    activeDropSessions.set(sessionId, { userId, startTime: Date.now(), usedFreeChance, today });
    
    res.json({ success: true, sessionId });
});

app.post('/api/game/drop/finish', async (req, res) => {
    const { userId, sessionId, score } = req.body;
    const session = activeDropSessions.get(sessionId);
    if (!session || session.userId !== userId) {
        return res.status(400).json({error: "Invalid or expired session"});
    }
    
    const elapsed = Date.now() - session.startTime;
    activeDropSessions.delete(sessionId);
    
    // Validate time (30s game + 5s buffer)
    if (elapsed < 5000 || elapsed > 45000) {
        return res.status(400).json({error: "Suspicious game time"});
    }
    
    // Validate score (rough cheat check, e.g. max 500 in 30s)
    const validScore = Math.min(parseInt(score) || 0, 1000);
    
    const user = await dbGet(`users/${userId}`);
    if (!user) return res.status(404).json({error: "Not found"});
    
    const updates = {};
    if (session.usedFreeChance) {
        updates.freeDrops = (user.freeDrops || 0) - 1;
    } else {
        let playsToday = user.dropPlaysToday || 0;
        if (user.lastDropDate !== session.today) playsToday = 0;
        updates.dropPlaysToday = playsToday + 1;
        updates.lastDropDate = session.today;
    }
    
    const config = await dbGet('config') || {};
    const reward = validScore * (config.globalMultiplier || 1);
    updates.points = (user.points || 0) + reward;
    updates.logs = logAction(user, `Played MYFA Drop: won ${reward} Gems`);
    
    await dbUpdate(`users/${userId}`, updates);
    res.json({ success: true, reward, newBal: updates.points });
});

// ============================================================================
// 7.5. PUBLIC GLOBALS (CSS & Broadcast)
// ============================================================================
let publicGlobalsCache = { data: null, expiresAt: 0 };
app.get('/api/public/globals', async (req, res) => {
    const nowMs = Date.now();
    if (publicGlobalsCache.data && publicGlobalsCache.expiresAt > nowMs) {
        return res.json(publicGlobalsCache.data);
    }
    const config = await dbGet('config') || {};
    const css = await dbGet('css') || {};
    const toast = await dbGet('toastBroadcast') || {};
    
    // Calculate real users count
    const usersObj = await dbGet('users') || {};
    const totalUsers = Object.keys(usersObj).length;
    
    const payload = { config, css, toast, totalUsers };
    publicGlobalsCache = { data: payload, expiresAt: nowMs + 30000 };
    res.json(payload);
});

// ============================================================================
// 8. ADMIN CONTROL PANEL API (60+ Features)
// ============================================================================
const checkAdmin = (req, res, next) => { 
    if(req.body.secret !== ADMIN_SECRET) return res.status(403).json({error:"Auth failed"}); 
    next(); 
};

async function writeAdminLog(action) {
    const logStr = `[${new Date().toISOString()}] ${action}`;
    const adminLogs = await dbGet('adminLogs') || [];
    adminLogs.push(logStr);
    if (adminLogs.length > 50) adminLogs.shift();
    await dbSet('adminLogs', adminLogs);
}

async function logAdminAction(adminId, actionStr) {
    await writeAdminLog(actionStr);
}
const addAdminLog = logAdminAction;

app.post('/api/admin/logs', checkAdmin, async (req, res) => {
    const logs = await dbGet('adminLogs') || [];
    res.json(logs);
});

app.post('/api/admin/data', checkAdmin, async (req, res) => {
    const db = (await dbGet('')) || {};
    res.json({
        config: db.config || {},
        users: db.users || {},
        tasks: db.bonusTasks || {},
        promos: db.promos || {},
        withdrawals: db.withdrawals || {},
        stats: db.stats || { oxWagered: 0, oxBotProfit: 0 },
        verifications: db.verifications || {},
        adminLogs: db.adminLogs || []
    });
});

app.post('/api/admin/config-update', checkAdmin, async (req, res) => {
    if(req.body.fullConfig) await dbUpdate('config', req.body.fullConfig);
    await addAdminLog(req.body.adminId, 'Updated Master Config');
    res.json({success:true});
});

app.post('/api/admin/user-action', checkAdmin, async (req, res) => {
    const { userId, action, value, adminId } = req.body;
    const u = await dbGet(`users/${userId}`);
    if(!u) return res.status(404).json({error:"User not found"});

    if(action === 'add-balance') {
        await dbUpdate(`users/${userId}`, { points: (u.points||0) + parseInt(value), logs: logAction(u, `Admin added ${value} Gems`) });
        await addAdminLog(adminId, `Added ${value} Gems to ${userId}`);
    } else if(action === 'deduct-balance') {
        await dbUpdate(`users/${userId}`, { points: Math.max(0, (u.points||0) - parseInt(value)), logs: logAction(u, `Admin deducted ${value} Gems`) });
        await addAdminLog(adminId, `Deducted ${value} Gems from ${userId}`);
    } else if(action === 'reset-ads') {
        await dbUpdate(`users/${userId}`, { dailyAdsWatched: 0, logs: logAction(u, `Admin reset daily ads`) });
        await addAdminLog(adminId, `Reset daily ads for ${userId}`);
    } else if(action === 'toggle-ban') {
        await dbUpdate(`users/${userId}`, { isBanned: !u.isBanned, logs: logAction(u, `Admin ${u.isBanned?'unbanned':'banned'}`) });
        await addAdminLog(adminId, `${u.isBanned?'Unbanned':'Banned'} user ${userId}`);
    } else if(action === 'toggle-vip') {
        await dbUpdate(`users/${userId}`, { isVip: !u.isVip, logs: logAction(u, `Admin ${u.isVip?'removed':'granted'} VIP`) });
        await addAdminLog(adminId, `${u.isVip?'Removed':'Granted'} VIP for ${userId}`);
    }
    res.json({success:true});
});

app.post('/api/admin/tasks', checkAdmin, async (req, res) => {
    const { action, task, adminId } = req.body;
    if(action === 'create') {
        const taskId = 'task_' + Date.now();
        await dbSet(`bonusTasks/${taskId}`, task);
        await addAdminLog(adminId, `Created bonus task ${task.name}`);
    } else if(action === 'delete') {
        await dbRemove(`bonusTasks/${task.id}`);
        await addAdminLog(adminId, `Deleted bonus task ${task.id}`);
    }
    res.json({success:true});
});

app.post('/api/admin/promos', checkAdmin, async (req, res) => {
    const { action, promo, adminId } = req.body;
    if(action === 'create') {
        await dbSet(`promos/${promo.code}`, { reward: promo.reward, maxUses: promo.maxUses, uses: 0 });
        await addAdminLog(adminId, `Created promo code ${promo.code}`);
    }
    res.json({success:true});
});

app.post('/api/admin/withdrawals', checkAdmin, async (req, res) => {
    const { action, ids, reason } = req.body;
    for(const id of ids) {
        const w = await dbGet(`withdrawals/${id}`);
        if(!w) continue;
        if(action === 'approve') {
            await dbUpdate(`withdrawals/${id}`, { status: 'approved' });
            // Alert user via bot
            bot.sendMessage(w.userId, `✅ Your withdrawal of $${w.amount} to ${w.method} has been approved!`).catch(()=>{});
        } else if(action === 'reject') {
            await dbUpdate(`withdrawals/${id}`, { status: 'rejected', reason: reason || 'Violation of terms' });
            await addAdminLog(adminId, `Rejected withdrawal ${id}`);
            // Refund realBalance
            const u = await dbGet(`users/${w.userId}`);
            if(u) await dbUpdate(`users/${w.userId}`, { realBalance: (u.realBalance||0) + w.amount });
            bot.sendMessage(w.userId, `❌ Your withdrawal was rejected. Reason: ${reason || 'Violation of terms'}. Funds refunded.`).catch(()=>{});
        }
    }
    res.json({success:true});
});


app.post('/api/admin/broadcast-telegram', checkAdmin, async (req, res) => {
    const { message, imageUrl, target, targetIds, buttons, adminId } = req.body;
    let users = [];
    
    if (target === 'all') {
        const allUsers = await dbGet('users') || {};
        users = Object.keys(allUsers);
    } else {
        users = targetIds.split(',').map(id => id.trim()).filter(id => id);
    }
    
    if (users.length === 0) return res.status(400).json({error: "No target users found"});
    
    let inline_keyboard = [];
    if(buttons && buttons.length > 0) {
        let row = [];
        buttons.forEach(b => row.push({ text: b.text, url: b.url }));
        inline_keyboard.push(row);
    }
    
    const opts = { parse_mode: 'HTML' };
    if (inline_keyboard.length > 0) opts.reply_markup = { inline_keyboard };
    
    let successCount = 0;
    
    // Asynchronous send to not block the request for too long, but we'll await in batches for safety
    // For small sets, we can just map and Promise.all
    res.json({success: true, count: users.length}); // Respond early to prevent timeout
    
    await addAdminLog(adminId, `Started Telegram Broadcast to ${users.length} users`);
    
    (async () => {
        for(let i=0; i<users.length; i++) {
            const uid = users[i];
            try {
                if(imageUrl) {
                    await bot.sendPhoto(uid, imageUrl, { caption: message, ...opts });
                } else {
                    await bot.sendMessage(uid, message, opts);
                }
                successCount++;
            } catch(e) {
                // Ignore blocked bot errors
            }
            // Delay 50ms to prevent hitting Telegram rate limits (30 msgs/sec max)
            await new Promise(r => setTimeout(r, 50));
        }
        await addAdminLog(adminId, `Completed Telegram Broadcast: Delivered to ${successCount}/${users.length}`);
    })();
});

app.post('/api/admin/broadcast', checkAdmin, async (req, res) => {
    await dbSet('toastBroadcast', { id: Date.now(), text: req.body.text });
    await addAdminLog(req.body.adminId, `Broadcasted toast: ${req.body.text}`);
    res.json({success:true});
});

app.get('/api/channel/posts', async (req, res) => {
    const posts = await dbGet('channelPosts') || [];
    res.json(posts);
});

app.post('/api/admin/channel/post', checkAdmin, async (req, res) => {
    const { action, post, id } = req.body;
    let posts = await dbGet('channelPosts') || [];
    if(action === 'create') {
        const newPost = {
            id: Date.now().toString(),
            text: post.text,
            reactions: post.reactions || {},
            date: Date.now()
        };
        posts.unshift(newPost);
    } else if (action === 'delete') {
        posts = posts.filter(p => p.id !== id);
    } else if (action === 'update_reactions') {
        const p = posts.find(p => p.id === id);
        if (p) {
            // merge or replace reactions completely
            p.reactions = { ...(p.reactions || {}), ...post.reactions };
        }
    }
    await dbSet('channelPosts', posts);
    res.json({success:true, posts});
});

app.post('/api/channel/react', async (req, res) => {
    const { postId, emoji, userId } = req.body;
    let posts = await dbGet('channelPosts') || [];
    const p = posts.find(p => p.id === postId);
    if (p) {
        p.userReactions = p.userReactions || {};
        if (p.userReactions[userId]) {
            return res.status(400).json({error: "You have already reacted to this post."});
        }
        p.userReactions[userId] = emoji;
        p.reactions = p.reactions || {};
        p.reactions[emoji] = (p.reactions[emoji] || 0) + 1;
        await dbSet('channelPosts', posts);
        res.json({success:true, reactions: p.reactions});
    } else {
        res.status(404).json({error: "Post not found"});
    }
});

app.post('/api/admin/wipe', checkAdmin, async (req, res) => {
    await dbSet('users', {});
    await dbSet('withdrawals', {});
    res.json({success:true});
});

app.post('/api/admin/backup', checkAdmin, async (req, res) => {
    const db = await dbGet('');
    res.json(db);
});

app.post('/api/admin/invoice', checkAdmin, async (req, res) => {
    const { userId, amount, title, description } = req.body;
    try {
        const link = await bot.createInvoiceLink(
            title || 'Special Gems Package',
            description || 'Buy Gems using Telegram Stars',
            'gems_payload_' + Date.now(),
            '', // Provider token must be empty for Telegram Stars
            'XTR',
            [{ label: 'Gems', amount: parseInt(amount) }] // amount is in smallest units, 1 Star = 1
        );
        await bot.sendMessage(userId, `Hello! The admin has sent you a direct invoice:\n\n<a href="${link}">Pay with Telegram Stars</a>`, { parse_mode: 'HTML' });
        res.json({ success: true, link });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/verify/upload', async (req, res) => {
    const { userId, taskId, imageBase64 } = req.body;
    const vId = `v_${Date.now()}_${userId}`;
    await dbSet(`verifications/${vId}`, { userId, taskId, image: imageBase64, status: 'pending', timestamp: Date.now() });
    res.json({ success: true });
});

app.post('/api/admin/verifications/action', checkAdmin, async (req, res) => {
    const { id, action } = req.body;
    const v = await dbGet(`verifications/${id}`);
    if (!v) return res.status(404).json({ error: "Verification not found" });

    if (action === 'approve') {
        const t = await dbGet(`bonusTasks/${v.taskId}`);
        const u = await dbGet(`users/${v.userId}`);
        const c = await dbGet('config') || {};
        if (t && u) {
            const rewardVal = (parseInt(t.reward) || 0) * (c.globalMultiplier || 1);
            const rType = t.rewardType || 'gems';
            const claimed = u.claimedBonuses || [];
            
            if (!claimed.includes(v.taskId)) {
                claimed.push(v.taskId);
                const updates = { claimedBonuses: claimed };
                let logMsg = `Task ${v.taskId} approved`;
                
                if (rType === 'money') {
                    updates.realBalance = (u.realBalance || 0) + (parseInt(t.reward) || 0);
                    logMsg += ` (+$${t.reward})`;
                } else if (rType === 'spin') {
                    updates.freeSpins = (u.freeSpins || 0) + rewardVal;
                    logMsg += ` (+${rewardVal} Spins)`;
                } else if (rType === 'scratch') {
                    updates.freeScratches = (u.freeScratches || 0) + rewardVal;
                    logMsg += ` (+${rewardVal} Scratches)`;
                } else if (rType === 'drop') {
                    updates.freeDrops = (u.freeDrops || 0) + rewardVal;
                    logMsg += ` (+${rewardVal} Drops)`;
                } else {
                    updates.points = (u.points || 0) + rewardVal;
                    logMsg += ` (+${rewardVal} Gems)`;
                }
                
                updates.logs = logAction(u, logMsg);
                await dbUpdate(`users/${v.userId}`, updates);
            }
        }
        await dbUpdate(`verifications/${id}`, { status: 'approved' });
        bot.sendMessage(v.userId, `✅ Your task verification was approved!`).catch(()=>{});
    } else if (action === 'reject') {
        await dbUpdate(`verifications/${id}`, { status: 'rejected' });
        bot.sendMessage(v.userId, `❌ Your task verification was rejected.`).catch(()=>{});
    }
    res.json({ success: true });
});

app.post('/api/admin/css-inject', checkAdmin, async (req, res) => {
    const { css } = req.body;
    await dbSet('globalCSS', { css, timestamp: Date.now() });
    res.json({ success: true });
});

// export default app;


// ============================================================================
// MYFA ADS & ESCROW PRO
// ============================================================================


app.get('/api/myfa-ads/get', async (req, res) => {
    const userId = req.query.userId;
    const ua = req.query.userAgent ? req.query.userAgent.toLowerCase() : '';
    const campaigns = await dbGet('campaigns') || {};
    
    // Fraud tracking / Rate Limiting per User
    const now = Date.now();
    const userLogKey = 'fraud_' + userId;
    const fraudData = await dbGet(userLogKey) || { count: 0, lastTime: 0 };
    if (now - fraudData.lastTime < 60000) {
        if (fraudData.count >= 3) return res.json({ success: false, msg: 'Rate limited (Fraud Protection)' });
        fraudData.count++;
    } else {
        fraudData.count = 1;
    }
    fraudData.lastTime = now;
    await dbSet(userLogKey, fraudData);

    const active = Object.values(campaigns).filter(c => {
        if (c.schemaVersion === 2) {
            if (!c.delivery || c.delivery.status !== 'Running') return false;
            if(c.excludedIds) {
                const exList = c.excludedIds.split(',').map(s=>s.trim());
                if(exList.includes(userId)) return false;
            }
            return true;
        }

        if(c.status !== 'active' || c.stuckBalance <= 0) return false;
        
        // 1. Date Check
        if(c.startDate && now < new Date(c.startDate).getTime()) return false;
        if(c.endDate && now > new Date(c.endDate).getTime()) return false;
        
        // 2. Device Check
        if(c.device === 'ios' && !ua.includes('iphone') && !ua.includes('ipad')) return false;
        if(c.device === 'android' && !ua.includes('android')) return false;
        if(c.device === 'web' && (ua.includes('iphone') || ua.includes('ipad') || ua.includes('android'))) return false;
        
        // 3. User Exclusion Check
        if(c.excludedIds) {
            const exList = c.excludedIds.split(',').map(s=>s.trim());
            if(exList.includes(userId)) return false;
        }

        // 4. Fraud Protection Check from Campaign config
        if (c.fraudProtection && fraudData.count >= 3) return false;

        return true;
    }).map(c => {
        if (c.schemaVersion === 2) {
            return {
                ...c,
                reward: 0,
                imageUrl: c.creative ? c.creative.mediaUrl : '',
                link: c.creative ? c.creative.destinationUrl : '',
                title: c.creative ? c.creative.headline : '',
                description: c.creative ? c.creative.description : '',
                cpmBid: c.budget ? c.budget.daily : 0
            };
        }
        return c;
    });

    if(active.length === 0) return res.json({ success: false, msg: 'No active ads' });
    
    let randomAd = active[Math.floor(Math.random() * active.length)];
    
    // 5. A/B Testing Logic
    if(randomAd.imageUrlB && Math.random() > 0.5) {
        randomAd.imageUrl = randomAd.imageUrlB; // serve variant B
    }

    res.json({ success: true, ad: randomAd });
});


app.post('/api/myfa-ads/claim', async (req, res) => {
    const { userId, campaignId } = req.body;
    const user = await dbGet(`users/${userId}`);
    if(!user) return res.json({ success: false });
    
    const campaign = await dbGet(`campaigns/${campaignId}`);
    if(campaign && campaign.stuckBalance > 0) {
        const reward = campaign.cpmBid / 1000;
        await dbUpdate(`campaigns/${campaignId}`, { 
            stuckBalance: campaign.stuckBalance - reward,
            impressions: (campaign.impressions || 0) + 1
        });
        await dbUpdate(`users/${userId}`, { realBalance: (user.realBalance || 0) + reward });
        res.json({ success: true, reward });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/escrow/transfer', async (req, res) => {
    const { userId, source, target, amount } = req.body;
    const campaigns = await dbGet('campaigns') || {};
    const srcCamp = campaigns[source];
    const tgtCamp = campaigns[target];
    
    if(!srcCamp || srcCamp.userId !== userId) return res.json({ success: false, error: 'Source not found' });
    if(!tgtCamp || tgtCamp.userId !== userId) return res.json({ success: false, error: 'Target not found' });
    if((srcCamp.stuckBalance || 0) < amount) return res.json({ success: false, error: 'Insufficient stuck balance' });
    
    await dbUpdate(`campaigns/${source}`, { stuckBalance: srcCamp.stuckBalance - amount });
    await dbUpdate(`campaigns/${target}`, { stuckBalance: (tgtCamp.stuckBalance || 0) + amount });
    
    res.json({ success: true });
});

app.post('/api/campaign/create', async (req, res) => {
    const data = req.body;
    const id = 'camp_' + Date.now();
    data.status = 'active';
    data.stuckBalance = parseFloat(data.budget);
    data.impressions = 0;
    await dbSet(`campaigns/${id}`, data);
    res.json({ success: true, id });
});

app.get('/api/publisher/dashboard/:userId', async (req, res) => {
    const { userId } = req.params;
    const campaigns = await dbGet('campaigns') || {};
    let totalImp = 0;
    let avgCpm = 0;
    let count = 0;
    Object.values(campaigns).forEach(c => {
        if(c.userId === userId) {
            totalImp += (c.impressions || 0);
            avgCpm += parseFloat(c.cpmBid || 0);
            count++;
        }
    });
    if(count > 0) avgCpm /= count;
    res.json({ success: true, estRevenue: (totalImp / 1000) * avgCpm });
});

app.post('/api/user/settings', async (req, res) => {
    const { userId, settings } = req.body;
    await dbUpdate(`users/${userId}`, { settings });
    res.json({ success: true });
});

app.post('/api/user/session/revoke', async (req, res) => {
    // Revoke session
    const { userId, sessionId } = req.body;
    // Just mock removing session
    res.json({ success: true });
});

app.post('/api/user/burn', async (req, res) => {
    const { userId, amount } = req.body;
    const user = await dbGet(`users/${userId}`);
    if(!user || user.points < amount) return res.json({ success: false });
    await dbUpdate(`users/${userId}`, { points: user.points - amount });
    res.json({ success: true });
});

app.post('/api/streak/claim', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.json({ success: false, error: 'Missing userId' });
    const user = await dbGet(`users/${userId}`);
    if (!user) return res.json({ success: false, error: 'User not found' });
    
    if (user.settings?.autoClaimDaily) {
        return res.json({ success: false, error: 'Auto-claim is enabled' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const claimDate = user.streakClaimDate || null;
    
    if (claimDate === today) {
        return res.json({ success: false, error: 'Streak already claimed today', alreadyClaimed: true, streakCount: Math.max(1, Number(user.streakCount || user.streak || 1)) });
    }
    
    const streakCount = Math.min(7, Math.max(1, Number(user.streakCount || user.streak || 1)));
    const reward = streakCount * 50;
    const newPoints = (user.points || 0) + reward;
    
    logAction(user, `Claimed daily streak: ${reward} points`);
    
    await dbUpdate(`users/${userId}`, { 
        points: newPoints,
        dropGameChances: newDropChances,
        lastLoginDate: Date.now(), streakCount: 1, streak: 1, streakClaimDate: null,
        logs: user.logs 
    });
    
    res.json({ success: true, reward, streakCount, points: newPoints });
});

app.get('/api/campaigns/:userId/stats', async (req, res) => {
    const { userId } = req.params;
    const campaigns = await dbGet('campaigns') || {};
    
    let totalCampaigns = 0;
    let activeCampaigns = 0;
    let pausedCampaigns = 0;
    let completedCampaigns = 0;
    let totalImpressions = 0;
    let totalSpend = 0;
    let totalBudget = 0;

    for (const [id, campaign] of Object.entries(campaigns)) {
        if (campaign.userId === userId) {
            totalCampaigns++;
            
            const maxUsers = campaign.maxUsers || 0;
            const claims = campaign.claims || 0;
            const reward = campaign.reward || 0;
            const views = campaign.views || 0;
            const isPaused = campaign.status === 'paused';
            
            if (claims >= maxUsers) {
                completedCampaigns++;
            } else if (isPaused) {
                pausedCampaigns++;
            } else {
                activeCampaigns++;
            }
            
            totalImpressions += views;
            totalSpend += claims * reward;
            totalBudget += maxUsers * reward;
        }
    }
    
    res.json({
        success: true,
        stats: {
            totalCampaigns,
            activeCampaigns,
            pausedCampaigns,
            completedCampaigns,
            totalImpressions,
            totalSpend,
            totalBudget
        }
    });
});


app.post('/api/campaigns/:id/refund', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        if (!userId) return res.json({ success: false, error: 'Missing userId' });
        
        const campaign = await dbGet(`campaigns/${id}`);
        if (!campaign) return res.json({ success: false, error: 'Campaign not found' });
        
        const ownerId = campaign.schemaVersion === 2 ? campaign.ownerId : campaign.userId;
        if (ownerId !== userId) return res.json({ success: false, error: 'Not the owner' });
        
        let remaining = 0;
        if (campaign.schemaVersion === 2) {
            if (campaign.delivery.status === 'Refunded') return res.json({ success: false, error: 'Already refunded' });
            remaining = campaign.budget.reserved - campaign.budget.spent;
            campaign.delivery.status = 'Refunded';
        } else {
            if (campaign.status === 'liquidated') return res.json({ success: false, error: 'Already refunded' });
            const maxUsers = campaign.maxUsers || 0;
            const claims = campaign.claims || 0;
            const reward = campaign.reward || 0;
            remaining = Math.max(0, (maxUsers - claims) * reward);
            campaign.status = 'liquidated';
        }
        
        const user = await dbGet(`users/${userId}`);
        if (!user) return res.json({ success: false, error: 'User not found' });
        
        await dbUpdate(`users/${userId}`, {
            points: (user.points || 0) + remaining,
            stuckBalance: Math.max(0, (user.stuckBalance || 0) - remaining)
        });
        
        await dbUpdate(`campaigns/${id}`, campaign);
        res.json({ success: true, remaining });
    } catch(e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/campaigns/:id/track', async (req, res) => {
    try {
        const { id } = req.params;
        const { event } = req.body;
        const campaign = await dbGet(`campaigns/${id}`);
        if (!campaign || campaign.schemaVersion !== 2) return res.json({ success: false, error: 'Invalid campaign' });
        
        if (event === 'impression') {
            campaign.analytics.impressions = (campaign.analytics.impressions || 0) + 1;
        } else if (event === 'click') {
            campaign.analytics.clicks = (campaign.analytics.clicks || 0) + 1;
        }
        
        await dbUpdate(`campaigns/${id}`, campaign);
        res.json({ success: true });
    } catch(e) {
        res.json({ success: false, error: e.message });
    }
});

export default app;
