from pathlib import Path
import re

p=Path('api/index.js'); s=p.read_text()
start=s.index("app.post('/api/sponsor/verify-auto'")
end=s.index("// TASK 4: Manual Verify Sponsor Task", start)
block=s[start:end]
if 't.schemaVersion===2' in block or 'c.schemaVersion===2' in block:
    pass
else:
    marker="    const c = await dbGet(`campaigns/${taskId}`);\n    if(!c) return res.status(404).json({error:\"Campaign not found\"});\n    if(c.paused || c.claims >= c.maxUsers) return res.json({success:false,error:\"Campaign is closed or full\"});"
    insert="""    const c = await dbGet(`campaigns/${taskId}`);
    if(!c) return res.status(404).json({error:\"Campaign not found\"});
    if(c.schemaVersion===2) {
        const task=c.task||{}, max=Number(task.maxUsers||c.maxUsers||0), claims=Number(c.claims||c.analytics?.conversions||0), rewardGems=Number(task.reward||c.reward||0), remaining=Number(c.taskBudgetRemaining||0), ownerId=String(c.ownerId||c.userId||''), verifiedChannel=String(channelId||task.channelId||'');
        if(c.archived||c.paused||(c.status&&c.status!=='active')) return res.json({success:false,error:'Campaign is closed or paused'});
        if(!verifiedChannel||rewardGems<=0) return res.json({success:false,error:'Task verification data is incomplete'});
        if(max>0&&claims>=max) return res.json({success:false,error:'Task is full!'});
        if(remaining<rewardGems) return res.json({success:false,error:'Task budget exhausted'});
        try {
            const member=await fetchMultiAPI(verifiedChannel,userId,BOT_TOKEN);
            if(member.status==='error'||!member.success) return res.json({success:false,error:member.error||'Telegram membership verification failed'});
            const nextRemaining=remaining-rewardGems,nextBudget=Math.max(0,Number(c.budgetRemaining||0)-rewardGems),nextClaims=claims+1;
            await dbUpdate(`campaigns/${taskId}`,{taskBudgetRemaining:nextRemaining,budgetRemaining:nextBudget,escrowReserved:nextBudget,taskSpend:Number(c.taskSpend||0)+rewardGems,claims:nextClaims,conversions:nextClaims,analytics:{...(c.analytics||{}),conversions:nextClaims}});
            const sponsor=ownerId?await dbGet(`users/${ownerId}`):null;
            if(sponsor) await dbUpdate(`users/${ownerId}`,{campaignReserved:Math.max(0,Number(sponsor.campaignReserved||0)-rewardGems),logs:logAction(sponsor,`Sponsored task completed: ${c.name||taskId} (-${rewardGems} Gems from campaign reserve)`)});
            const newPoints=Number(u.points||0)+rewardGems;
            await dbUpdate(`users/${userId}`,{claimedSponsorTasks:[...(u.claimedSponsorTasks||[]),taskId],points:newPoints,active7DayEscrows:[...(u.active7DayEscrows||[]),{taskId,channelId:verifiedChannel,reward:rewardGems,sponsorUserId:ownerId,timestamp:Date.now()}],logs:logAction(u,`Completed Sponsor Task '${c.name||taskId}' (+${rewardGems} Gems)`)});
            return res.json({success:true,points:newPoints,reward:rewardGems,remaining:nextRemaining});
        } catch(e) { return res.json({success:false,error:e.message||'Task verification failed'}); }
    }
    if(c.paused || c.claims >= c.maxUsers) return res.json({success:false,error:\"Campaign is closed or full\"});"""
    if marker not in block: raise SystemExit('verify-auto marker not found inside route')
    block=block.replace(marker,insert,1)
    s=s[:start]+block+s[end:]

# Ensure manual approval route also settles schema-v2 task budget.
start=s.index("app.post('/api/campaigns/review'")
end=s.index("// ============================================================================\n// 7. WEB3 GAME ENGINES", start)
block=s[start:end]
if 'c.schemaVersion===2' not in block.split("if(action === 'approve')",1)[0]:
    marker="    if(action === 'approve') {\n        await dbUpdate(`campaigns/${campaignId}`, { claims: (c.claims || 0) + 1 });"
    insert="""    if(action === 'approve' && c.schemaVersion===2) {
        const task=c.task||{}, max=Number(task.maxUsers||c.maxUsers||0), claims=Number(c.claims||c.analytics?.conversions||0), rewardGems=Number(task.reward||c.reward||0), remaining=Number(c.taskBudgetRemaining||0), ownerId=String(c.ownerId||c.userId||'');
        if(c.archived||c.paused||(c.status&&c.status!=='active')) return res.json({success:false,error:'Task is closed or paused'});
        if(max>0&&claims>=max) return res.json({success:false,error:'Task is full'});
        if(rewardGems<=0||remaining<rewardGems) return res.json({success:false,error:'Task budget exhausted'});
        const nextRemaining=remaining-rewardGems,nextBudget=Math.max(0,Number(c.budgetRemaining||0)-rewardGems),nextClaims=claims+1;
        await dbUpdate(`campaigns/${campaignId}`,{taskBudgetRemaining:nextRemaining,budgetRemaining:nextBudget,escrowReserved:nextBudget,taskSpend:Number(c.taskSpend||0)+rewardGems,claims:nextClaims,conversions:nextClaims,analytics:{...(c.analytics||{}),conversions:nextClaims}});
        const sponsor=ownerId?await dbGet(`users/${ownerId}`):null;
        if(sponsor) await dbUpdate(`users/${ownerId}`,{campaignReserved:Math.max(0,Number(sponsor.campaignReserved||0)-rewardGems),logs:logAction(sponsor,`Sponsored task approved: ${c.name||campaignId} (-${rewardGems} Gems from campaign reserve)`)});
        const submitter=await dbGet(`users/${item.userId}`);
        if(submitter) await dbUpdate(`users/${item.userId}`,{points:Number(submitter.points||0)+rewardGems,logs:logAction(submitter,`Task Approved: ${c.name||campaignId} (+${rewardGems} Gems)`)});
        await dbUpdate(`verifications/${id}`,{status:'approved',approvedAt:Date.now(),reward:rewardGems});
        bot.sendMessage(item.userId,`✅ Your task verification was approved! +${rewardGems} Gems`).catch(()=>{});
        return res.json({success:true,reward:rewardGems});
    }
    if(action === 'approve') {
        await dbUpdate(`campaigns/${campaignId}`, { claims: (c.claims || 0) + 1 });"""
    if marker not in block: raise SystemExit('manual review marker not found')
    block=block.replace(marker,insert,1)
    s=s[:start]+block+s[end:]

p.write_text(s)

# Manager button must use backend-supported action names.
p=Path('public/campaign-manager-app.js'); s=p.read_text(); s=s.replace('data-action="toggle"','data-action="${c.status===\'paused\'?\'resume\':\'pause\'}"',1); p.write_text(s)

# Cache-bust the standalone manager.
p=Path('public/ad-studio-pro.html'); s=p.read_text(); s=re.sub(r'(campaign-manager-app\.css\?v=)\d{8}-\d+',r'\g<1>20260909-11',s); s=re.sub(r'(campaign-manager-app\.js\?v=)\d{8}-\d+',r'\g<1>20260909-11',s); p.write_text(s)
