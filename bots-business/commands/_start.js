/*CMD
  command: /start
  help: Open MYFA BIRR
  need_reply: false
  auto_retry_time:
  folder:
  answer:
  keyboard:
  aliases:
  group:
CMD*/

var parts=String(message||"").trim().split(/\s+/);
var refParam=parts.length>1?parts[1]:"";
User.setProp("MYFA_PENDING_REF",refParam,"string");

var apiUrl=Libs.Webhooks.getUrlFor({command:"/myfa-api-v2",user_id:user.id});
var gameApiUrl=Libs.Webhooks.getUrlFor({command:"/myfa-games",user_id:user.id});
var AppURL=WebApp.getUrl({command:"index",options:{ref:refParam,apiUrl:apiUrl,gameApiUrl:gameApiUrl}});

Api.sendMessage({
  text:"💎 MYFA BIRR\n\nEarn gems, complete tasks, watch sponsored ads, play games, invite friends and withdraw rewards.\n\nOpen MYFA BIRR below.",
  reply_markup:{inline_keyboard:[[{text:"💎 Open MYFA BIRR",web_app:{url:AppURL}}]]}
});
