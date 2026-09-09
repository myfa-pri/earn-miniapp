from pathlib import Path
import re

# 1) Apply the previously prepared campaign ledger/accounting patch.
exec(Path('scripts/ledger_accounting_fix.py').read_text(), {})

# 2) Fix the real /api/watch-ad schema-v2 settlement path.
p=Path('api/index.js')
s=p.read_text()
pattern=re.compile(r"        if \(network === 'myfa' && tokenData\.campaignId\) \{.*?        \} else \{\n            rewardCash = Number\(c\.realMoneyPerAd \|\| 0\.05\);\n        \}",re.S)
new="""        if (network === 'myfa' && tokenData.campaignId) {
            const campaign = await dbGet(`campaigns/${tokenData.campaignId}`);
            if (!campaign || campaign.archived || campaign.paused || (campaign.status && campaign.status !== 'active')) return res.status(410).json({success:false,error:'Sponsored ad is no longer available'});
            const rewardGems = Number(campaign.reward || 0) || Number(c.myfaAdRewardGems || 50);
            if (rewardGems <= 0) return res.status(410).json({success:false,error:'Sponsored reward is not configured'});
            if (campaign.schemaVersion === 2) {
                const remaining = Number(campaign.adBudgetRemaining || 0);
                if (remaining < rewardGems) return res.status(410).json({success:false,error:'Sponsored ad budget exhausted'});
                const nextRemaining = remaining - rewardGems;
                await dbUpdate(`campaigns/${tokenData.campaignId}`, {
                    adBudgetRemaining: nextRemaining,
                    budgetRemaining: Math.max(0, Number(campaign.budgetRemaining || 0) - rewardGems),
                    escrowReserved: Math.max(0, Number(campaign.budgetRemaining || 0) - rewardGems),
                    adSpend: Number(campaign.adSpend || 0) + rewardGems,
                    claims: Number(campaign.claims || 0) + 1,
                    conversions: Number(campaign.conversions || 0) + 1,
                    analytics: {...(campaign.analytics || {}), conversions: Number(campaign.analytics?.conversions || 0) + 1, impressions: Number(campaign.analytics?.impressions || 0) + 1}
                });
                const ownerId = String(campaign.ownerId || campaign.userId || '');
                const owner = ownerId ? await dbGet(`users/${ownerId}`) : null;
                if (owner) await dbUpdate(`users/${ownerId}`, {
                    campaignReserved: Math.max(0, Number(owner.campaignReserved || 0) - rewardGems),
                    logs: logAction(owner, `Sponsored ad completed: ${campaign.name || tokenData.campaignId} (-${rewardGems} Gems from campaign reserve)`)
                });
                rewardGems = rewardGems;
            } else {
                if (Number(campaign.stuckBalance || 0) < rewardGems) return res.status(410).json({success:false,error:'Sponsored budget exhausted'});
                await dbUpdate(`campaigns/${tokenData.campaignId}`, {
                    stuckBalance: Math.max(0, Number(campaign.stuckBalance || 0) - rewardGems),
                    impressions: Number(campaign.impressions || 0) + 1,
                    views: Number(campaign.views || 0) + 1,
                    claims: Number(campaign.claims || 0) + 1
                });
                const ownerId = String(campaign.ownerId || campaign.userId || '');
                const owner = ownerId ? await dbGet(`users/${ownerId}`) : null;
                if (owner) await dbUpdate(`users/${ownerId}`, {stuckBalance: Math.max(0, Number(owner.stuckBalance || 0) - rewardGems)});
            }
        } else {
            rewardCash = Number(c.realMoneyPerAd || 0.05);
        }"""
# The replacement above cannot assign to const rewardGems; rewrite with a stable mutable variable.
new=new.replace('const rewardGems = Number(campaign.reward || 0) || Number(c.myfaAdRewardGems || 50);','let rewardGems = Number(campaign.reward || 0) || Number(c.myfaAdRewardGems || 50);').replace('                rewardGems = rewardGems;\n','')
if not pattern.search(s):
    raise SystemExit('watch-ad schema block not found')
s=pattern.sub(new,s,count=1)
p.write_text(s)

# 3) Fix schema-v2 manual sponsor task approval to spend task reserve and owner campaignReserved.
p=Path('api/index.js'); s=p.read_text()
marker="    if(action === 'approve') {\n        await dbUpdate(`campaigns/${campaignId}`, { claims: (c.claims || 0) + 1 });"
insert="""    if(action === 'approve' && c.schemaVersion === 2) {
        const task=c.task||{}, max=Number(task.maxUsers||c.maxUsers||0), claims=Number(c.claims||c.analytics?.conversions||0), rewardGems=Number(task.reward||c.reward||0), remaining=Number(c.taskBudgetRemaining||0), ownerId=String(c.ownerId||c.userId||'');
        if(c.archived||c.paused||(c.status&&c.status!=='active')) return res.json({success:false,error:'Task is closed or paused'});
        if(max>0&&claims>=max) return res.json({success:false,error:'Task is full'});
        if(rewardGems<=0||remaining<rewardGems) return res.json({success:false,error:'Task budget exhausted'});
        const nextRemaining=remaining-rewardGems, nextBudget=Math.max(0,Number(c.budgetRemaining||0)-rewardGems), nextClaims=claims+1;
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
if marker not in s:
    raise SystemExit('manual review marker not found')
s=s.replace(marker,insert,1)
p.write_text(s)

# 4) Fix Campaign Manager UI: Pause button must send pause/resume, not unsupported toggle.
p=Path('public/campaign-manager-app.js'); s=p.read_text()
s=s.replace('data-action="toggle"','data-action="${c.status===\'paused\'?\'resume\':\'pause\'}"',1)
p.write_text(s)

# 5) Bust cache for the single authoritative Campaign Manager app.
p=Path('public/ad-studio-pro.html'); s=p.read_text()
s=re.sub(r'(campaign-manager-app\.css\?v=)\d{8}-\d+',r'\g<1>20260909-10',s)
s=re.sub(r'(campaign-manager-app\.js\?v=)\d{8}-\d+',r'\g<1>20260909-10',s)
p.write_text(s)
