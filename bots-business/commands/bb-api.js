/*CMD
  command: bb-api
  help: Secure MYFA BIRR WebApp API endpoint
  need_reply: false
  auto_retry_time:
  folder: MYFA API
  answer:
  keyboard:
  aliases:
  group:
CMD*/

var payload;
try {
  payload = typeof content === "string" ? JSON.parse(content || "{}") : (content || {});
} catch (e) {
  Bot.sendMessage(JSON.stringify({ok:false,error:"Invalid JSON"}));
  return;
}

function reply(data){ Bot.sendMessage(JSON.stringify(data)); }
function num(v,d){ var n=Number(v); return isFinite(n)?n:d; }
function state(){
  var s=User.getProp("MYFA_STATE");
  if(!s || typeof s!=="object") s={};
  if(!Array.isArray(s.logs)) s.logs=[];
  if(!Array.isArray(s.referredUsers)) s.referredUsers=[];
  return s;
}
function save(s){ User.setProp({name:"MYFA_STATE",value:s}); }
function log(s,t){ s.logs.push(new Date().toISOString()+" "+t); if(s.logs.length>30)s.logs.shift(); }

var s=state();
if(!s.createdAt){
  s={username:user.first_name||"Unknown User",accountName:((user.first_name||"")+" "+(user.last_name||"")).trim()||"Unknown User",points:0,realBalance:0,adsWatchedToday:0,totalAdsWatchedLifetime:0,referredBy:null,referredUsers:[],isBanned:false,claimedBonuses:[],claimedTasks:[],createdAt:Date.now(),lastLoginTimestamp:Date.now(),streakCount:1,logs:[]};
  log(s,"Account created in Bots.Business"); save(s);
}

var action=String(payload.action||"");

if(action==="user"){
  reply({ok:true,user:Object.assign({},s,{id:user.id,telegramId:user.telegramid,first_name:user.first_name,last_name:user.last_name,username:user.username})}); return;
}
if(action==="ensure-user"){
  s.username=String(payload.username||s.username||user.first_name||"Unknown User").slice(0,120);
  s.accountName=s.username; s.lastLoginTimestamp=Date.now();
  if(payload.refParam&&!s.referredBy){var r=String(payload.refParam).replace(/^ref/i,"");if(r&&r!==String(user.telegramid))s.referredBy=r;}
  save(s); reply({ok:true,user:s}); return;
}
if(action==="globals"){
  var cfg=Bot.getProp("MYFA_CONFIG",{}); if(!cfg||typeof cfg!=="object")cfg={};
  reply({ok:true,config:cfg,totalUsers:num(Bot.getProp("MYFA_TOTAL_USERS",0),0)}); return;
}
if(action==="set-profile"){
  if(s.isBanned)return reply({ok:false,error:"ACCOUNT_BANNED"});
  if(payload.username)s.username=String(payload.username).slice(0,120);
  if(payload.accountName)s.accountName=String(payload.accountName).slice(0,120);
  save(s); reply({ok:true,user:s}); return;
}
if(action==="claim-daily"){
  if(s.isBanned)return reply({ok:false,error:"ACCOUNT_BANNED"});
  var day=new Date().toISOString().slice(0,10);
  if(s.dailyClaimDate===day)return reply({ok:false,error:"ALREADY_CLAIMED",user:s});
  var cfg2=Bot.getProp("MYFA_CONFIG",{})||{}; var reward=num(cfg2.dailyReward,50);
  s.points=num(s.points,0)+reward; s.dailyClaimDate=day; s.streakCount=num(s.streakCount,0)+1;
  log(s,"Daily reward +"+reward); save(s); reply({ok:true,reward:reward,user:s}); return;
}
if(action==="add-gems"){
  if(s.isBanned)return reply({ok:false,error:"ACCOUNT_BANNED"});
  var amount=num(payload.amount,0); if(amount<=0||amount>1000000)return reply({ok:false,error:"INVALID_AMOUNT"});
  s.points=num(s.points,0)+amount; log(s,"Gems +"+amount); save(s); reply({ok:true,points:s.points,user:s}); return;
}
if(action==="withdraw-request"){
  if(s.isBanned)return reply({ok:false,error:"ACCOUNT_BANNED"});
  var cash=num(payload.amount,0); if(cash<=0)return reply({ok:false,error:"INVALID_AMOUNT"});
  if(cash>num(s.realBalance,0))return reply({ok:false,error:"INSUFFICIENT_BALANCE"});
  var cfg3=Bot.getProp("MYFA_CONFIG",{})||{}; var minW=num(cfg3.minWithdraw,0);
  if(cash<minW)return reply({ok:false,error:"MINIMUM_WITHDRAWAL"});
  var all=Bot.getProp("MYFA_WITHDRAWALS",{})||{}; var id="WD-"+Date.now()+"-"+user.telegramid;
  all[id]={id:id,telegramId:String(user.telegramid),username:s.username,amount:cash,method:String(payload.method||"unknown").slice(0,50),account:String(payload.account||"").slice(0,120),status:"pending",createdAt:Date.now()};
  s.realBalance=num(s.realBalance,0)-cash; s.pendingWithdrawals=num(s.pendingWithdrawals,0)+cash; log(s,"Withdrawal requested "+id); Bot.setProp("MYFA_WITHDRAWALS",all,"json"); save(s);
  reply({ok:true,request:all[id],user:s}); return;
}
if(action==="withdrawals"){
  var rows=Bot.getProp("MYFA_WITHDRAWALS",{})||{}, mine=[];
  for(var k in rows)if(String(rows[k].telegramId)===String(user.telegramid))mine.push(rows[k]);
  mine.sort(function(a,b){return(b.createdAt||0)-(a.createdAt||0)}); reply({ok:true,withdrawals:mine}); return;
}
if(action==="config-save"){
  if(String(user.telegramid)!==String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID","")))return reply({ok:false,error:"UNAUTHORIZED"});
  if(!payload.config||typeof payload.config!=="object")return reply({ok:false,error:"INVALID_CONFIG"});
  Bot.setProp("MYFA_CONFIG",payload.config,"json"); reply({ok:true,config:payload.config}); return;
}
reply({ok:false,error:"UNKNOWN_ACTION",action:action});
