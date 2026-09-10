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

var parts = String(message || "").trim().split(/\s+/);
var refParam = parts.length > 1 ? parts[1] : "";

if(refParam){
  User.setProp("MYFA_PENDING_REF", refParam, "string");
}

var AppURL = WebApp.getUrl({
  command: "index",
  options: { ref: refParam }
});

Api.sendMessage({
  text: "💎 MYFA BIRR\n\nEarn gems, complete tasks, watch ads, complete tasks, play games, invite friends and withdraw your rewards.\n\nOpen the Mini App below to start.",
  reply_markup: {
    inline_keyboard: [
      [{ text: "💎 Open MYFA BIRR", web_app: { url: AppURL } }]
    ]
  }
});
