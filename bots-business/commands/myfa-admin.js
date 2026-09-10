/*CMD
  command: myfa-admin
  help: MYFA BIRR protected admin backend
  need_reply: false
  folder: MYFA Admin
  answer:
  keyboard:
  aliases:
  group:
CMD*/

var adminId = String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID", ""));
if(!adminId || String(user.telegramid)!==adminId){ Bot.sendMessage("Unauthorized"); return; }

var config = Bot.getProp("MYFA_CONFIG", {}) || {};
var withdrawals = Bot.getProp("MYFA_WITHDRAWALS", {}) || {};
var pending = 0;
for(var id in withdrawals){ if(withdrawals[id].status === "pending") pending++; }

Bot.sendMessage(JSON.stringify({
  ok:true,
  admin:true,
  telegramId:String(user.telegramid),
  config:config,
  pendingWithdrawals:pending,
  withdrawalCount:Object.keys(withdrawals).length
}));
