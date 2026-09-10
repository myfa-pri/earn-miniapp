/*CMD
  command: index
  help: MYFA BIRR WebApp
  need_reply:
  auto_retry_time:
  folder:
  answer:
  keyboard:
  aliases:
  group:
CMD*/

var apiUrl = Libs.Webhooks.getUrlFor({command:"/myfa-api-v2",user_id:user.id});
var gameApiUrl = Libs.Webhooks.getUrlFor({command:"/myfa-games",user_id:user.id});
var CSSFile = WebApp.getUrl({command:"renderCSS"});
var JSFile = WebApp.getUrl({command:"renderJS"});

WebApp.render({
  template:"index.html",
  options:{
    CSSFile:CSSFile,
    JSFile:JSFile,
    apiUrl:apiUrl,
    gameApiUrl:gameApiUrl,
    ref:(options&&options.ref)?options.ref:""
  }
});
