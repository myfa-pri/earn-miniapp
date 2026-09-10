/*CMD
  command: /myfa-games
  help: MYFA BIRR secure game backend
  need_reply: false
  auto_retry_time:
  folder: MYFA API
  answer:
  keyboard:
  aliases:
  group:
CMD*/

function out(v){WebApp.render({content:JSON.stringify(v),mime_type:"application/json"})}
function n(v,d){var x=Number(v);return isFinite(x)?x:d}
function s(v,d,m){var x=String(v==null?d:v);return m&&x.length>m?x.slice(0,m):x}
function st(){var x=User.getProp("MYFA_STATE",{});if(!x||typeof x!=="object")x={};x.points=n(x.points,0);x.realBalance=n(x.realBalance,0);x.games=x.games&&typeof x.games==="object"?x.games:{};return x}
function save(x){User.setProp({name:"MYFA_STATE",value:x})}
var p={};try{p=typeof content==="string"?JSON.parse(content||"{}"):content||{}}catch(e){return out({ok:false,error:"INVALID_JSON"})}
var a=s(p.action,"",40),u=st();
if(u.isBanned&&!['bootstrap'].includes(a))return out({ok:false,error:"ACCOUNT_BANNED"});

if(a==="ludo-play"){
  var wager=n(p.wager,0);if(wager<=0||wager>u.realBalance)return out({ok:false,error:"INVALID_WAGER"});
  var roll=Math.floor(Math.random()*6)+1;var win=roll===6;var payout=win?Number((wager*2).toFixed(2)):0;
  u.realBalance-=wager;if(win)u.realBalance+=payout;u.games.ludo={lastRoll:roll,lastWager:wager,lastPayout:payout,lastWin:win,updatedAt:Date.now()};save(u);
  return out({ok:true,roll:roll,win:win,payout:payout,balance:u.realBalance,user:u});
}
if(a==="chicken-start"){
  var w=n(p.wager,0);if(w<=0||w>u.realBalance)return out({ok:false,error:"INVALID_WAGER"});
  u.realBalance-=w;
  var r=Math.random(),deathLane;
  if(r<0.75)deathLane=Math.floor(Math.random()*2)+1;else if(r<0.90)deathLane=3;else deathLane=Math.floor(Math.random()*5)+4;
  var mult=[1,1.2,1.5,2,3,5,10,25];
  u.games.chicken={active:true,wager:w,deathLane:deathLane,lane:0,multipliers:mult,startedAt:Date.now()};save(u);
  return out({ok:true,deathLane:deathLane,multipliers:mult,balance:u.realBalance});
}
if(a==="chicken-cashout"){
  var g=u.games.chicken||{};var lane=Math.max(1,Math.floor(n(p.lane,0)));
  if(!g.active)return out({ok:false,error:"NO_ACTIVE_ROUND"});
  if(lane>=g.deathLane)return out({ok:false,error:"ROUND_ALREADY_LOST"});
  if(lane>7)return out({ok:false,error:"INVALID_LANE"});
  var multiplier=(g.multipliers||[1,1.2,1.5,2,3,5,10,25])[lane];var pay=Number((g.wager*multiplier).toFixed(2));
  u.realBalance+=pay;g.active=false;g.cashoutLane=lane;g.payout=pay;g.updatedAt=Date.now();save(u);
  return out({ok:true,payout:pay,multiplier:multiplier,balance:u.realBalance,user:u});
}
if(a==="chicken-state")return out({ok:true,round:u.games.chicken||null,balance:u.realBalance,user:u});
return out({ok:false,error:"UNKNOWN_ACTION",action:a});
