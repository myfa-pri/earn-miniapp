/*CMD
  command: /start
  help:
  need_reply: false
  auto_retry_time:
  folder:
  answer:
  keyboard:
  aliases:
  group:
CMD*/

// MYFA BIRR — Bots.Business WebApp launcher.
// Keep all balance/withdraw/reward mutations behind the existing protected API.
var AppURL = WebApp.getUrl({ command: "index" });

Api.sendMessage({
  text: "💎 MYFA BIRR\n\nEarn gems, complete tasks, play games, invite friends and withdraw your rewards.",
  reply_markup: {
    inline_keyboard: [
      [{ text: "💎 Open MYFA BIRR", web_app: { url: AppURL } }]
    ]
  }
});
