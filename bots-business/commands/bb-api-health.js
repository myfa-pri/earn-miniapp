/*CMD
  command: bb-api-health
  help: MYFA BIRR BB backend health check
  need_reply: false
  folder: MYFA API
  answer:
  keyboard:
  aliases:
  group:
CMD*/

var cfg = Bot.getProp("MYFA_CONFIG", {}) || {};
Bot.sendMessage(JSON.stringify({ok:true,backend:"bots-business",version:"1.0.0",telegramUser:String(user.telegramid),configLoaded:!!cfg}));
