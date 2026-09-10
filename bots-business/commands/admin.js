/*CMD
  command: /admin
  help: MYFA BIRR admin WebApp
  need_reply: false
  auto_retry_time:
  folder: MYFA ADMIN
  answer:
  keyboard:
  aliases:
  group:
CMD*/

if(String(user.telegramid)!==String(Bot.getProp("MYFA_ADMIN_TELEGRAM_ID",""))){
  Bot.sendMessage("Unauthorized.");
  return;
}
var apiUrl=Libs.Webhooks.getUrlFor({command:"/myfa-api-v2",user_id:user.id});
var css=WebApp.getUrl({command:"adminCSS"});
var js=WebApp.getUrl({command:"adminJS"});
WebApp.render({template:"admin.html",options:{apiUrl:apiUrl,CSSFile:css,JSFile:js}});
