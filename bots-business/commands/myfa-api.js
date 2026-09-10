/*CMD
  command: /myfa-api
  help: MYFA BIRR secure WebApp API
  need_reply: false
  auto_retry_time:
  folder: MYFA API
  answer:
  keyboard:
  aliases:
  group:
CMD*/

// Secure user-bound webhook API. The URL is generated with Libs.Webhooks.getUrlFor
// so the caller cannot change the bound Telegram user id or command.

function out(value){
  WebApp.render({
    content: JSON.stringify(value),
    mime_type: "application/json"
  });
}

function num(value, fallback){
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function text(value, fallback, max){
  var s = String(value == null ? fallback : value);
  if(max && s.length > max) s = s.slice(0, max);
  return s;
}

function arr(v){ return Array.isArray(v) ? v : []; }

function today(){ return new Date().toISOString().slice(0,10); }

function cleanState(s){
  if(!s || typeof s !== "object") s = {};
  s.points = num(s.points, 0);
  s.realBalance = num(s.realBalance, 0);
  s.adsWatchedToday = num(s.adsWatchedToday, 0);
  s.totalAdsWatchedLifetime = num(s.totalAdsWatchedLifetime, 0);
  s.referredUsers = arr(s.referredUsers);
  s.claimedTasks = arr(s.claimedTasks);
  s.claimedAds = arr(s.claimedAds);
  s.games = s.games && typeof s.games === "object" ? s.games : {};
  s.settings = s.settings && typeof s.settings === "object" ? s.settings : {};
  s.withdrawals = arr(s.withdrawals);
  s.createdAt = num(s.createdAt, Date.now());
  s.isBanned = Boolean(s.isBanned);
  return s;
}

function getState(){
  return cleanState(User.getProp("MYFA_STATE", {}));
}

function saveState(s){
  User.setProp({name:"MYFA_STATE", value:cleanState(s)});
}

function cfg(){
  var c = Bot.getProp("MYFA_CONFIG", {});
  return c && typeof c === "object" ? c : {};
}

function defaultTaskSet(){
  return [
    {id:"welcome", title:"Welcome to MYFA BIRR", description:"Open the app and claim your starter task.", type:"internal", reward:100, url:"", active:true},
    {id:"follow-channel", title:"Join the official channel", description:"Join MYFA BIRR official Telegram channel.", type:"telegram", reward:100, url:"https://t.me/Besh_beshs", active:true}
  ];
}

function tasks(){
  var t = Bot.getProp("MYFA_TASKS", null);
  return Array.isArray(t) && t.length ? t : defaultTaskSet();
}

function saveTasks(t){ Bot.setProp("MYFA_TASKS", t.slice(0,100), "json"); }

function campaigns(){
  var c = Bot.getProp("MYFA_CAMPAIGNS", []);
  return Array.isArray(c) ? c : [];
}

function saveCampaigns(c){ Bot.setProp("MYFA_CAMPAIGNS", c.slice(-100), "json"); }

function withdrawals(){
  var w = Bot.getProp("MYFA_WITHDRAWALS", []);
  return Array.isArray(w) ? w : [];
}

function saveWithdrawals(w){ Bot.setProp("MYFA_WITHDRAWALS", w.slice(-200), "json"); }

function topUsers(){
  var t = Bot.getProp("MYFA_TOP", []);
  return Array.isArray(t) ? t : [];
}

function updateTop(s){
  var t = topUsers();
  var id = String(user.telegramid);
  var existing = null;
  for(var i=0;i<t.length;i++){
    if(String(t[i].telegramId) === id){ existing = i; break; }
  }
  var row = {telegramId:id,name:text(s.accountName || s.username || user.first_name,"User",80),points:num(s.points,0)};
  if(existing !== null) t[existing] = row; else t.push(row);
  t.sort(function(a,b){ return num(b.points,0)-num(a.points,0); });
  Bot.setProp("MYFA_TOP", t.slice(0,50), "json");
  return t.slice(0,50);
}

function defaultState(){
  var first = text(user.first_name || "Unknown User","Unknown User",80);
  var full = text(((user.first_name||"") + " " + (user.last_name||"")).trim() || first, first,100);
  return {
    username: first,
    accountName: full,
    points:0,
    realBalance:0,
    adsWatchedToday:0,
    totalAdsWatchedLifetime:0,
    referredBy:null,
    referredUsers:[],
    referralAwarded:false,
    isBanned:false,
    claimedTasks:[],
    claimedAds:[],
    dailyClaimDate:null,
    streakCount:0,
    lastLoginDate:today(),
    createdAt:Date.now(),
    games:{},
    settings:{sound:true,theme:"dark",lang:"EN"},
    withdrawals:[]
  };
}

function initUser(s, refParam){
  if(s.createdAt) return s;
  s = defaultState();
  var ref = text(refParam || "","",100).replace(/^ref/i,"");
  if(ref && ref !== String(user.telegramid)){
    s.referredBy = ref;
    var rs = Bot.getProp({name:"MYFA_STATE", user_telegramid:ref});
    if(rs && typeof rs === "object"){
      rs = cleanState(rs);
      if(rs.referredUsers.indexOf(String(user.telegramid)) === -1) rs.referredUsers.push(String(user.telegramid));
      var bonus = num(cfg().referralBonusReferrer,0);
      rs.realBalance += bonus;
      updateTop(rs);
      Bot.setProp({name:"MYFA_STATE", value:rs, user_telegramid:ref});
      s.realBalance += num(cfg().referralBonusReferee,0);
      s.referralAwarded = true;
      Api.sendMessage({chat_id:ref,text:"🎉 New MYFA referral! You earned +"+bonus+" cash."});
    }
  }
  var total = num(Bot.getProp("MYFA_TOTAL_USERS",0),0)+1;
  Bot.setProp("MYFA_TOTAL_USERS",total,"integer");
  saveState(s);
  updateTop(s);
  return s;
}

function maybeResetDaily(s){
  var d = today();
  if(s.lastLoginDate !== d){
    var prev = s.lastLoginDate;
    s.lastLoginDate = d;
    if(prev){
      var diff = new Date(d+"T00:00:00Z").getTime()-new Date(prev+"T00:00:00Z").getTime();
      if(diff <= 172800000) s.streakCount = num(s.streakCount,0)+1; else s.streakCount = 1;
    } else s.streakCount = 1;
    s.adsWatchedToday = 0;
    s.claimedAds = [];
  }
  return s;
}

var payload = {};
try { payload = typeof content === "string" ? JSON.parse(content || "{}") : (content || {}); }
catch(e){ return out({ok:false,error:"INVALID_JSON"}); }

var action = text(payload.action,"",60);
var state = getState();
if(!state.createdAt) state = initUser(state, payload.refParam || "");
state = maybeResetDaily(state);

if(state.isBanned && ["bootstrap","user","globals"].indexOf(action) === -1){
  saveState(state); return out({ok:false,error:"ACCOUNT_BANNED"});
}

if(action === "bootstrap" || action === "user"){
  updateTop(state);
  saveState(state);
  return out({
    ok:true,
    user:Object.assign({},state,{telegramId:String(user.telegramid),id:user.id,first_name:user.first_name||"",last_name:user.last_name||"",tgUsername:user.username||""}),
    config:cfg(),
    tasks:tasks(),
    campaigns:campaigns().filter(function(c){return c.active!==false;}),
    leaderboard:topUsers()
  });
}

if(action === "globals"){
  return out({ok:true,config:cfg(),totalUsers:num(Bot.getProp("MYFA_TOTAL_USERS",0),0),leaderboard:topUsers()});
}

if(action === "save-profile"){
  if(payload.username) state.username=text(payload.username,"User",80);
  if(payload.accountName) state.accountName=text(payload.accountName,state.username,100);
  saveState(state); updateTop(state); return out({ok:true,user:state});
}

if(action === "save-settings"){
  state.settings = {
    sound: payload.sound !== false,
    theme: payload.theme === "light" ? "light" : "dark",
    lang: String(payload.lang||"EN").toUpperCase() === "AM" ? "AM" : "EN"
  };
  saveState(state); return out({ok:true,user:state});
}

if(action === "daily-claim"){
  var day=today();
  if(state.dailyClaimDate===day) return out({ok:false,error:"ALREADY_CLAIMED",user:state});
  var dc=cfg();
  var reward=num(dc.dailyReward,50);
  var streakBonus=Math.min(num(state.streakCount,1),7)*num(dc.streakStep,10);
  var totalReward=reward+streakBonus;
  state.points += totalReward;
  state.dailyClaimDate=day;
  state.streakCount=Math.max(1,num(state.streakCount,1));
  saveState(state); updateTop(state);
  return out({ok:true,reward:totalReward,streak:state.streakCount,user:state});
}

if(action === "claim-task"){
  var tid=text(payload.taskId,"",100);
  var allTasks=tasks(); var task=null;
  for(var ti=0;ti<allTasks.length;ti++) if(String(allTasks[ti].id)===tid) { task=allTasks[ti]; break; }
  if(!task || task.active===false) return out({ok:false,error:"TASK_NOT_FOUND"});
  if(state.claimedTasks.indexOf(tid)!==-1) return out({ok:false,error:"ALREADY_CLAIMED"});
  var tr=num(task.reward,0); if(tr<=0) return out({ok:false,error:"INVALID_REWARD"});
  state.claimedTasks.push(tid); state.points += tr;
  if(task.cashReward) state.realBalance += num(task.cashReward,0);
  saveState(state); updateTop(state); return out({ok:true,reward:tr,user:state});
}

if(action === "tasks") return out({ok:true,tasks:tasks()});

if(action === "claim-ad"){
  var aid=text(payload.adId,"",100);
  var list=campaigns(); var ad=null;
  for(var ai=0;ai<list.length;ai++) if(String(list[ai].id)===aid && list[ai].active!==false){ ad=list[ai]; break; }
  if(!ad) return out({ok:false,error:"AD_NOT_FOUND"});
  if(state.claimedAds.indexOf(aid)!==-1) return out({ok:false,error:"ALREADY_CLAIMED"});
  var adLimit=num(cfg().adsDailyLimit,10);
  if(num(state.adsWatchedToday,0)>=adLimit) return out({ok:false,error:"DAILY_AD_LIMIT"});
  var ar=num(ad.reward,0); if(ar<=0 || ar>100000) return out({ok:false,error:"INVALID_REWARD"});
  state.claimedAds.push(aid); state.adsWatchedToday+=1; state.totalAdsWatchedLifetime+=1; state.points+=ar;
  saveState(state); updateTop(state); return out({ok:true,reward:ar,user:state});
}

if(action === "create-ad"){
  var title=text(payload.title,"MYFA Ad",80);
  var url=text(payload.url,"",500);
  var reward=num(payload.reward,0);
  if(!url || reward<=0) return out({ok:false,error:"INVALID_AD"});
  var budget=num(payload.budget,0);
  var cost=Math.max(0,reward*100);
  if(budget<cost) return out({ok:false,error:"INVALID_BUDGET"});
  var c=campaigns();
  var cid="AD-"+Date.now()+"-"+String(user.telegramid);
  c.push({id:cid,title:title,url:url,reward:reward,budget:budget,spent:0,active:true,owner:String(user.telegramid),createdAt:Date.now()});
  state.realBalance -= budget;
  if(state.realBalance<0) state.realBalance=0;
  saveCampaigns(c); saveState(state); return out({ok:true,campaign:c[c.length-1],user:state});
}

if(action === "create-task"){
  var isAdmin=(String(user.telegramid)==String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID","")));
  if(!isAdmin) return out({ok:false,error:"UNAUTHORIZED"});
  var nt=tasks();
  nt.push({id:"TASK-"+Date.now(),title:text(payload.title,"MYFA Task",100),description:text(payload.description,"",300),type:text(payload.type,"internal",40),reward:num(payload.reward,0),url:text(payload.url,"",500),active:true});
  saveTasks(nt); return out({ok:true,tasks:nt});
}

if(action === "referrals"){
  var names=[];
  for(var ri=0;ri<state.referredUsers.length;ri++){
    var rid=state.referredUsers[ri];
    var ruser=Bot.getProp({name:"MYFA_STATE", user_telegramid:rid});
    if(ruser) names.push({id:rid,name:ruser.accountName||ruser.username||"User",points:num(ruser.points,0)});
  }
  return out({ok:true,count:names.length,referrals:names,referrer:state.referredBy||null});
}

if(action === "leaderboard"){
  var top=topUsers(); var rank=null;
  for(var li=0;li<top.length;li++) if(String(top[li].telegramId)===String(user.telegramid)){rank=li+1;break;}
  return out({ok:true,rank:rank,rows:top});
}

if(action === "game"){
  var g=text(payload.game,"",30);
  var todayKey=today();
  state.games=state.games||{};
  var gs=state.games[g]||{date:todayKey,plays:0,wins:0};
  if(gs.date!==todayKey){gs={date:todayKey,plays:0,wins:0};}
  var maxPlays=num(cfg().gameDailyPlays,20);
  if(gs.plays>=maxPlays) return out({ok:false,error:"GAME_DAILY_LIMIT",user:state});
  gs.plays++;
  var reward=0, win=false, result={};

  if(g === "aviator"){
    var stake=num(payload.stake,0); var target=num(payload.target,1.2);
    if(stake<=0 || stake>state.points || target<1.01 || target>20) return out({ok:false,error:"INVALID_AVIATOR"});
    state.points-=stake;
    var crash=Number((1.05+Math.random()*4.95).toFixed(2));
    win=target<=crash;
    if(win){reward=Number((stake*target).toFixed(2));state.points+=reward;gs.wins++;}
    result={crash:crash,target:target,stake:stake,payout:win?reward:0,win:win};
  } else if(g === "drop"){
    var score=Math.max(0,Math.min(500,Math.floor(num(payload.score,0))));
    reward=Math.floor(score/10); win=reward>0; state.points+=reward; if(win)gs.wins++;
    result={score:score,reward:reward};
  } else if(g === "multi-ox"){
    var pick=text(payload.pick,"",10);
    var ox=["A","B","C","D","E"]; var draw=ox[Math.floor(Math.random()*ox.length)];
    win=pick===draw; reward=win?num(cfg().multiOxReward,100):0; state.points+=reward; if(win)gs.wins++;
    result={pick:pick,draw:draw,reward:reward,win:win};
  } else if(g === "sketch"){
    var correct=["cat","car","house","tree","phone"][Math.floor(Math.random()*5)];
    var answer=text(payload.answer,"",30).toLowerCase(); win=answer===correct; reward=win?num(cfg().sketchReward,75):0; state.points+=reward;if(win)gs.wins++;
    result={answer:correct,reward:reward,win:win};
  } else if(g === "daily-combo"){
    var symbols=["💎","⭐","🔥","🍀","🎁"]; var combo=[0,1,2].map(function(){return symbols[Math.floor(Math.random()*symbols.length)];});
    var chosen=arr(payload.combo).map(function(x){return String(x)}); win=chosen.length===3&&chosen.join("")===combo.join(""); reward=win?num(cfg().dailyComboReward,250):0;state.points+=reward;if(win)gs.wins++;
    result={combo:combo,reward:reward,win:win};
  } else return out({ok:false,error:"UNKNOWN_GAME"});

  state.games[g]=gs; saveState(state); updateTop(state);
  return out({ok:true,game:g,result:result,user:state});
}

if(action === "withdrawals"){
  var own=withdrawals().filter(function(w){return String(w.telegramId)===String(user.telegramid);});
  own.sort(function(a,b){return num(b.createdAt,0)-num(a.createdAt,0);});
  return out({ok:true,withdrawals:own});
}

if(action === "withdraw-create"){
  var amount=num(payload.amount,0); var minw=num(cfg().minWithdraw,1);
  if(amount<minw) return out({ok:false,error:"MINIMUM_WITHDRAWAL"});
  if(amount>state.realBalance) return out({ok:false,error:"INSUFFICIENT_BALANCE"});
  var method=text(payload.method,"unknown",50); var account=text(payload.account,"",150);
  if(!account) return out({ok:false,error:"ACCOUNT_REQUIRED"});
  var ws=withdrawals(); var wid="WD-"+Date.now()+"-"+String(user.telegramid);
  var row={id:wid,telegramId:String(user.telegramid),name:state.accountName||state.username,amount:Number(amount.toFixed(2)),method:method,account:account,status:"pending",createdAt:Date.now()};
  ws.push(row); state.realBalance-=amount; state.withdrawals.unshift(row); state.withdrawals=state.withdrawals.slice(0,20); saveWithdrawals(ws);saveState(state);
  var admin=Bot.getProp("MYFA_ADMIN_TELEGRAM_ID",""); if(admin) Api.sendMessage({chat_id:admin,text:"💸 New MYFA withdrawal\n"+row.name+"\nAmount: $"+row.amount+"\nMethod: "+row.method+"\nAccount: "+row.account+"\nID: "+row.id});
  return out({ok:true,withdrawal:row,user:state});
}

if(action === "promo-claim"){
  var code=text(payload.code,"",80); var promos=Bot.getProp("MYFA_PROMOS",{})||{}; var p=promos[code];
  if(!p) return out({ok:false,error:"INVALID_PROMO"});
  state.claimedPromos=arr(state.claimedPromos);
  if(state.claimedPromos.indexOf(code)!==-1) return out({ok:false,error:"PROMO_ALREADY_CLAIMED"});
  var pr=num(p.reward,0); if(pr<=0) return out({ok:false,error:"INVALID_PROMO"});
  state.claimedPromos.push(code);state.points+=pr;saveState(state);updateTop(state);return out({ok:true,reward:pr,user:state});
}

if(action === "admin-stats"){
  if(String(user.telegramid)!==String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID",""))) return out({ok:false,error:"UNAUTHORIZED"});
  var av=withdrawals(); var pending=av.filter(function(x){return x.status==="pending"}).length;
  return out({ok:true,totalUsers:num(Bot.getProp("MYFA_TOTAL_USERS",0),0),pendingWithdrawals:pending,tasks:tasks().length,campaigns:campaigns().length,leaderboard:topUsers()});
}

if(action === "admin-withdraw"){
  if(String(user.telegramid)!==String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID",""))) return out({ok:false,error:"UNAUTHORIZED"});
  var wid2=text(payload.id,"",100); var status2=text(payload.status,"",30); if(["approved","rejected","paid"].indexOf(status2)===-1) return out({ok:false,error:"INVALID_STATUS"});
  var wlist=withdrawals(); var target=null;
  for(var wi=0;wi<wlist.length;wi++) if(String(wlist[wi].id)===wid2){target=wlist[wi];break;}
  if(!target) return out({ok:false,error:"WITHDRAWAL_NOT_FOUND"});
  target.status=status2; target.reviewedAt=Date.now(); target.reviewedBy=String(user.telegramid);
  saveWithdrawals(wlist);
  if(target.telegramId) Api.sendMessage({chat_id:target.telegramId,text:"💸 MYFA withdrawal update\nID: "+target.id+"\nStatus: "+status2});
  return out({ok:true,withdrawal:target});
}

if(action === "admin-ban"){
  if(String(user.telegramid)!==String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID",""))) return out({ok:false,error:"UNAUTHORIZED"});
  var bid=text(payload.telegramId,"",50); var ban=Boolean(payload.banned); if(!bid) return out({ok:false,error:"USER_REQUIRED"});
  var bs=Bot.getProp({name:"MYFA_STATE",user_telegramid:bid}); if(!bs||typeof bs!=="object") return out({ok:false,error:"USER_NOT_FOUND"});
  bs=cleanState(bs);bs.isBanned=ban;Bot.setProp({name:"MYFA_STATE",value:bs,user_telegramid:bid});return out({ok:true,telegramId:bid,banned:ban});
}

if(action === "admin-config"){
  if(String(user.telegramid)!==String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID",""))) return out({ok:false,error:"UNAUTHORIZED"});
  var nc=payload.config; if(!nc||typeof nc!=="object") return out({ok:false,error:"INVALID_CONFIG"});
  Bot.setProp("MYFA_CONFIG",nc,"json");return out({ok:true,config:nc});
}

return out({ok:false,error:"UNKNOWN_ACTION",action:action});
