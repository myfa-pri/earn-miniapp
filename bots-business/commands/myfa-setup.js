/*CMD
  command: /myfa-setup
  help: Initialize MYFA BIRR BB configuration
  need_reply: false
  auto_retry_time:
  folder: MYFA ADMIN
  answer:
  keyboard:
  aliases:
  group:
CMD*/

var existingAdmin = String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID", ""));
if(!existingAdmin){
  Bot.sendMessage("MYFA BIRR BB setup requires the Bot property MYFA_ADMIN_TELEGRAM_ID.\n\nSet it to your Telegram ID in Bots.Business, then run /myfa-setup again.");
  return;
}
if(String(user.telegramid)!==existingAdmin){
  Bot.sendMessage("Unauthorized.");
  return;
}

Bot.setProp("MYFA_CONFIG", {
  dailyReward:50,
  streakStep:10,
  referralBonusReferrer:0.10,
  referralBonusReferee:0,
  minWithdraw:1,
  adsDailyLimit:10,
  gameDailyPlays:20,
  multiOxReward:100,
  sketchReward:75,
  dailyComboReward:250,
  officialChannel:"https://t.me/Besh_beshs"
}, "json");
Bot.setProp("MYFA_TASKS", [
  {id:"welcome",title:"Welcome to MYFA BIRR",description:"Open the app and claim your starter task.",reward:100,active:true,type:"internal"},
  {id:"channel",title:"Join official channel",description:"Join the MYFA BIRR official Telegram channel.",reward:100,active:true,type:"telegram",url:"https://t.me/Besh_beshs"}
], "json");
Bot.setProp("MYFA_TOTAL_USERS", Number(Bot.getProp("MYFA_TOTAL_USERS",0)||0), "integer");
Bot.sendMessage("✅ MYFA BIRR Bots.Business backend initialized.\n\nAdmin: "+existingAdmin+"\nDefault tasks and earning configuration are ready.");
