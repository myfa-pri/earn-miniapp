from pathlib import Path
import re

p=Path('api/index.js')
s=p.read_text()

repls=[
("res.json({ success: true, user: { id:userId, points:u.points||0, stuckBalance:u.stuckBalance||0 }, campaigns, summary });",
 "res.json({ success: true, user: { id:userId, points:u.points||0, stuckBalance:u.stuckBalance||0, campaignReserved:u.campaignReserved||summary.reserved||0 }, campaigns, summary });"),
("await dbUpdate(`users/${userId}`, { points:cmNum(u.points) - total, logs:logAction(u, `Campaign created: ${name} (-${total} Gems)`) });",
 "await dbUpdate(`users/${userId}`, { points:cmNum(u.points) - total, campaignReserved:cmNum(u.campaignReserved) + total, logs:logAction(u, `Campaign created: ${name} (-${total} Gems, +${total} campaign reserve)`) });"),
("return c.task && c.task.enabled === true && c.delivery && c.delivery.status === 'Running';",
 "return c.task && c.task.enabled === true && c.delivery && c.delivery.status === 'Running' && Number(c.taskBudgetRemaining || 0) > 0;"),
("maxUsers: Math.floor(c.budget.total / c.task.reward),",
 "maxUsers: Number(c.task.maxUsers || c.maxUsers || 0),"),
("spend: cmNum(c.adSpend),",
 "spend: cmNum(c.adSpend) + cmNum(c.taskSpend),"),
("await dbUpdate(`users/${userId}`, { points:cmNum(u.points)-delta, logs:logAction(u, `Campaign budget updated: ${current.name}`) });",
 "await dbUpdate(`users/${userId}`, { points:cmNum(u.points)-delta, campaignReserved:Math.max(0,cmNum(u.campaignReserved)+delta), logs:logAction(u, `Campaign budget updated: ${current.name}`) });"),
("await dbUpdate(`users/${userId}`,{points:cmNum(u.points)-total,logs:logAction(u,`Campaign duplicated: ${c.name}`)});",
 "await dbUpdate(`users/${userId}`,{points:cmNum(u.points)-total,campaignReserved:cmNum(u.campaignReserved)+total,logs:logAction(u,`Campaign duplicated: ${c.name}`)});"),
("if(refund)await dbUpdate(`users/${userId}`,{points:cmNum(u.points)+refund,logs:logAction(u,`Campaign refunded: ${c.name} (+${refund} Gems)`)});",
 "if(refund)await dbUpdate(`users/${userId}`,{points:cmNum(u.points)+refund,campaignReserved:Math.max(0,cmNum(u.campaignReserved)-refund),logs:logAction(u,`Campaign refunded: ${c.name} (+${refund} Gems)`)});"),
("raw.impressions=cmNum(raw.impressions)+1;raw.adBudgetRemaining=Math.max(0,cmNum(raw.adBudgetRemaining)-1);raw.adSpend=cmNum(raw.adSpend)+1;raw.budgetRemaining=Math.max(0,cmNum(raw.adBudgetRemaining)+cmNum(raw.taskBudgetRemaining));",
 "raw.impressions=cmNum(raw.impressions)+1;raw.adBudgetRemaining=cmNum(raw.adBudgetRemaining);raw.adSpend=cmNum(raw.adSpend);raw.budgetRemaining=Math.max(0,cmNum(raw.adBudgetRemaining)+cmNum(raw.taskBudgetRemaining));"),
]
for a,b in repls:
    s=s.replace(a,b)

# Schema-v2 task completion in verify-auto. Insert before legacy closed/full check.
marker="    const c = await dbGet(`campaigns/${taskId}`);\n    if(!c) return res.status(404).json({error:\"Campaign not found\"});\n    if(c.paused || c.claims >= c.maxUsers) return res.json({success:false,error:\"Campaign is closed or full\"});"
insert="""    const c = await dbGet(`campaigns/${taskId}`);
    if(!c) return res.status(404).json({error:\"Campaign not found\"});
    if(c.schemaVersion===2) {
        const task=c.task||{}, max=Number(task.maxUsers||c.maxUsers||0), claims=Number(c.claims||c.analytics?.conversions||0), rewardGems=Number(task.reward||c.reward||0), remaining=Number(c.taskBudgetRemaining||0), verifiedChannel=String(channelId||task.channelId||'');
        if(c.archived||c.paused||(c.status&&c.status!=='active')) return res.json({success:false,error:'Campaign is closed or paused'});
        if(!verifiedChannel||rewardGems<=0) return res.json({success:false,error:'Task verification data is incomplete'});
        if(max>0&&claims>=max) return res.json({success:false,error:'Task is full!'});
        if(remaining<rewardGems) return res.json({success:false,error:'Task budget exhausted'});
        try {
            const member=await fetchMultiAPI(verifiedChannel,userId,BOT_TOKEN);
            if(member.status==='error'||!member.success) return res.json({success:false,error:member.error||'Telegram membership verification failed'});
            const newClaims=claims+1,nextRemaining=remaining-rewardGems,nextBudget=Math.max(0,Number(c.budgetRemaining||0)-rewardGems),ownerId=String(c.ownerId||c.userId||'');
            await dbUpdate(`campaigns/${taskId}`,{taskBudgetRemaining:nextRemaining,budgetRemaining:nextBudget,escrowReserved:nextBudget,taskSpend:Number(c.taskSpend||0)+rewardGems,claims:newClaims,conversions:newClaims,analytics:{...(c.analytics||{}),conversions:newClaims}});
            const sponsor=ownerId?await dbGet(`users/${ownerId}`):null;
            if(sponsor) await dbUpdate(`users/${ownerId}`,{campaignReserved:Math.max(0,Number(sponsor.campaignReserved||0)-rewardGems),logs:logAction(sponsor,`Sponsored task completed: ${c.name||taskId} (-${rewardGems} Gems from campaign reserve)`)});
            const newPoints=Number(u.points||0)+rewardGems;
            await dbUpdate(`users/${userId}`,{claimedSponsorTasks:[...(u.claimedSponsorTasks||[]),taskId],active7DayEscrows:[...(u.active7DayEscrows||[]),{taskId,channelId:verifiedChannel,reward:rewardGems,sponsorUserId:ownerId,timestamp:Date.now()}],points:newPoints,logs:logAction(u,`Completed Sponsor Task '${c.name||taskId}' (+${rewardGems} Gems)`)});
            return res.json({success:true,points:newPoints,reward:rewardGems,remaining:nextRemaining});
        } catch(e) { return res.json({success:false,error:e.message||'Task verification failed'}); }
    }
    if(c.paused || c.claims >= c.maxUsers) return res.json({success:false,error:\"Campaign is closed or full\"});"""
if marker in s:s=s.replace(marker,insert,1)

# Schema-v2 task completion in verify-membership after Telegram verification passes.
marker="        if (member.success) {\n            \n            // CHECK TASK LIMITS"
insert="""        if (member.success) {
            if(isSponsor && t.schemaVersion===2) {
                const task=t.task||{}, max=Number(task.maxUsers||t.maxUsers||0), claims=Number(t.claims||t.analytics?.conversions||0), rewardGems=Number(task.reward||t.reward||0), remaining=Number(t.taskBudgetRemaining||0), ownerId=String(t.ownerId||t.userId||'');
                if(t.archived||t.paused||(t.status&&t.status!=='active')) return res.json({success:false,error:'Task is closed or paused'});
                if(max>0&&claims>=max) return res.json({success:false,error:'Task is full!'});
                if(rewardGems<=0||remaining<rewardGems) return res.json({success:false,error:'Task budget exhausted'});
                const nextClaims=claims+1,nextRemaining=remaining-rewardGems,nextBudget=Math.max(0,Number(t.budgetRemaining||0)-rewardGems);
                await dbUpdate(`campaigns/${taskId}`,{taskBudgetRemaining:nextRemaining,budgetRemaining:nextBudget,escrowReserved:nextBudget,taskSpend:Number(t.taskSpend||0)+rewardGems,claims:nextClaims,conversions:nextClaims,analytics:{...(t.analytics||{}),conversions:nextClaims}});
                const sponsor=ownerId?await dbGet(`users/${ownerId}`):null;
                if(sponsor) await dbUpdate(`users/${ownerId}`,{campaignReserved:Math.max(0,Number(sponsor.campaignReserved||0)-rewardGems),logs:logAction(sponsor,`Sponsored task completed: ${t.name||taskId} (-${rewardGems} Gems from campaign reserve)`)});
                const newPoints=Number(u.points||0)+rewardGems;
                await dbUpdate(`users/${userId}`,{claimedSponsorTasks:[...(u.claimedSponsorTasks||[]),taskId],active7DayEscrows:[...(u.active7DayEscrows||[]),{taskId,channelId:channelId||task.channelId||'',reward:rewardGems,sponsorUserId:ownerId,timestamp:Date.now()}],points:newPoints,logs:logAction(u,`Completed Sponsor Task '${t.name||taskId}' (+${rewardGems} Gems)`)});
                return res.json({success:true,points:newPoints,reward:rewardGems});
            }
            
            // CHECK TASK LIMITS"""
if marker in s:s=s.replace(marker,insert,1)

p.write_text(s)

# Legacy refund route: schema v2 uses campaignReserved as the user-facing lock ledger.
s=Path('api/index.js').read_text()
a="await dbUpdate(`users/${userId}`, {\n            points: (user.points || 0) + remaining,\n            stuckBalance: Math.max(0, (user.stuckBalance || 0) - remaining)\n        });"
b="await dbUpdate(`users/${userId}`, {\n            points: (user.points || 0) + remaining,\n            campaignReserved: Math.max(0, Number(user.campaignReserved || 0) - remaining),\n            stuckBalance: Math.max(0, (user.stuckBalance || 0) - remaining)\n        });"
Path('api/index.js').write_text(s.replace(a,b,1))

# api/ads.js: schema-v2 ads use adBudgetRemaining and settle rewards from that reserve.
p=Path('api/ads.js'); s=p.read_text()
s=s.replace("const remaining = safeNumber(c.budget?.reserved) - safeNumber(c.budget?.spent);","const remaining = c.schemaVersion === 2 ? safeNumber(c.adBudgetRemaining) : (safeNumber(c.budget?.reserved) - safeNumber(c.budget?.spent));")
old="""          const spent = safeNumber(campaign.budget?.spent);
          const reserved = safeNumber(campaign.budget?.reserved);
          if (reserved - spent < rewardGems) return json(res, 410, { success: false, error: 'Sponsored budget exhausted' });
          await update(`campaigns/${data.campaignId}`, {
            'budget/spent': spent + rewardGems,
            'budget/spentToday': safeNumber(campaign.budget?.spentToday) + rewardGems,
            'analytics/impressions': safeNumber(campaign.analytics?.impressions) + 1
          });
          if (campaign.ownerId) {
            const owner = await get(`users/${campaign.ownerId}`);
            if (owner) {
              await update(`users/${campaign.ownerId}`, {
                stuckBalance: Math.max(0, safeNumber(owner.stuckBalance) - rewardGems)
              });
            }
          }"""
new="""          const remaining = safeNumber(campaign.adBudgetRemaining);
          if (remaining < rewardGems) return json(res, 410, { success: false, error: 'Sponsored budget exhausted' });
          const nextRemaining = remaining - rewardGems;
          await update(`campaigns/${data.campaignId}`, {
            adBudgetRemaining: nextRemaining,
            budgetRemaining: Math.max(0, safeNumber(campaign.budgetRemaining) - rewardGems),
            escrowReserved: Math.max(0, safeNumber(campaign.budgetRemaining) - rewardGems),
            adSpend: safeNumber(campaign.adSpend) + rewardGems,
            claims: safeNumber(campaign.claims) + 1,
            conversions: safeNumber(campaign.conversions) + 1,
            'analytics/impressions': safeNumber(campaign.analytics?.impressions) + 1,
            'analytics/conversions': safeNumber(campaign.analytics?.conversions) + 1
          });
          if (campaign.ownerId) {
            const owner = await get(`users/${campaign.ownerId}`);
            if (owner) {
              await update(`users/${campaign.ownerId}`, {
                campaignReserved: Math.max(0, safeNumber(owner.campaignReserved) - rewardGems)
              });
            }
          }"""
if old not in s: raise SystemExit('api/ads.js completion block not found')
s=s.replace(old,new,1)
p.write_text(s)
PY
node --check scripts/ledger_accounting_fix.py 2>/dev/null || true
