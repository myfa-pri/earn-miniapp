from pathlib import Path
import re

p=Path('api/index.js'); s=p.read_text()
start=s.index("app.post('/api/sponsor/verify-auto'")
end=s.index("// TASK 4: Manual Verify Sponsor Task", start)
route="""app.post('/api/sponsor/verify-auto', async (req, res) => {
    const { userId, taskId, channelId } = req.body || {};
    const userIdStr = String(userId || '');
    const u = await dbGet(`users/${userIdStr}`);
    if(!u) return res.status(404).json({error:'Not found'});
    if((u.claimedSponsorTasks || []).includes(taskId)) return res.json({success:false,error:'Already claimed'});

    const c = await dbGet(`campaigns/${taskId}`);
    if(!c) return res.status(404).json({error:'Campaign not found'});

    if(c.schemaVersion === 2) {
        const task = c.task || {};
        const maxUsers = Number(task.maxUsers || c.maxUsers || 0);
        const claims = Number(c.claims || c.analytics?.conversions || 0);
        const rewardGems = Number(task.reward || c.reward || 0);
        const remaining = Number(c.taskBudgetRemaining || 0);
        const verifiedChannel = String(channelId || task.channelId || '');
        const sponsorId = String(c.ownerId || c.userId || '');
        if(c.archived || c.paused || (c.status && c.status !== 'active')) return res.json({success:false,error:'Task is closed or paused'});
        if(!verifiedChannel || rewardGems <= 0) return res.json({success:false,error:'Task verification data is incomplete'});
        if(maxUsers > 0 && claims >= maxUsers) return res.json({success:false,error:'Task is full!'});
        if(remaining < rewardGems) return res.json({success:false,error:'Task budget exhausted'});
        try {
            const member = await fetchMultiAPI(verifiedChannel, userIdStr, BOT_TOKEN);
            if(member.status === 'error' || !member.success) return res.json({success:false,error:member.error || 'Verification failed. Is the bot an admin in the channel?'});
            const nextClaims = claims + 1;
            const nextRemaining = remaining - rewardGems;
            const nextBudget = Math.max(0, Number(c.budgetRemaining || 0) - rewardGems);
            await dbUpdate(`campaigns/${taskId}`, {
                taskBudgetRemaining: nextRemaining,
                budgetRemaining: nextBudget,
                escrowReserved: nextBudget,
                taskSpend: Number(c.taskSpend || 0) + rewardGems,
                claims: nextClaims,
                conversions: nextClaims,
                analytics: { ...(c.analytics || {}), conversions: nextClaims }
            });
            const sponsor = sponsorId ? await dbGet(`users/${sponsorId}`) : null;
            if(sponsor) await dbUpdate(`users/${sponsorId}`, {
                campaignReserved: Math.max(0, Number(sponsor.campaignReserved || 0) - rewardGems),
                logs: logAction(sponsor, `Sponsored task completed: ${c.name || taskId} (-${rewardGems} Gems from campaign reserve)`)
            });
            const newPoints = Number(u.points || 0) + rewardGems;
            await dbUpdate(`users/${userIdStr}`, {
                claimedSponsorTasks:[...(u.claimedSponsorTasks || []), taskId],
                active7DayEscrows:[...(u.active7DayEscrows || []), {taskId,channelId:verifiedChannel,reward:rewardGems,sponsorUserId:sponsorId,timestamp:Date.now()}],
                points:newPoints,
                logs:logAction(u, `Completed Sponsor Task '${c.name || taskId}' (+${rewardGems} Gems)`)
            });
            return res.json({success:true,points:newPoints,reward:rewardGems,remaining:nextRemaining});
        } catch(e) {
            return res.json({success:false,error:e.message || 'Verification failed'});
        }
    }

    if(c.paused || c.claims >= c.maxUsers) return res.json({success:false,error:'Campaign is closed or full'});
    try {
        const member = await fetchMultiAPI(channelId, userIdStr, BOT_TOKEN);
        if(member.status === 'error') return res.json({success:false,error:member.error || 'Verification failed. Is the bot an admin in the channel?'});
        if(!member.success) return res.json({success:false,error:'Not Joined'});
        const finalReward = Number(c.reward || 0);
        const sponsor = await dbGet(`users/${c.userId}`);
        await dbUpdate(`campaigns/${taskId}`, {claims:(c.claims||0)+1});
        if(sponsor) await dbUpdate(`users/${c.userId}`, {stuckBalance:Math.max(0,Number(sponsor.stuckBalance||0)-finalReward)});
        const newBal = Number(u.points||0) + finalReward;
        await dbUpdate(`users/${userIdStr}`, {
            claimedSponsorTasks:[...(u.claimedSponsorTasks||[]),taskId],
            active7DayEscrows:[...(u.active7DayEscrows||[]),{taskId,channelId,reward:finalReward,sponsorUserId:c.userId,timestamp:Date.now()}],
            points:newBal,
            logs:logAction(u,`Completed Sponsor Task '${c.name}' (+${finalReward} Gems)`)
        });
        return res.json({success:true,points:newBal,reward:finalReward});
    } catch(e) {
        return res.json({success:false,error:'Not Joined'});
    }
});

"""
s=s[:start]+route+s[end:]
p.write_text(s)

# Manager: backend supports pause/resume, not toggle.
p=Path('public/campaign-manager-app.js'); s=p.read_text(); s=s.replace('data-action="toggle"','data-action="${c.status===\'paused\'?\'resume\':\'pause\'}"',1); p.write_text(s)

# Force fresh standalone manager assets.
p=Path('public/ad-studio-pro.html'); s=p.read_text(); s=re.sub(r'(campaign-manager-app\.css\?v=)\d{8}-\d+',r'\g<1>20260909-11',s); s=re.sub(r'(campaign-manager-app\.js\?v=)\d{8}-\d+',r'\g<1>20260909-11',s); p.write_text(s)
