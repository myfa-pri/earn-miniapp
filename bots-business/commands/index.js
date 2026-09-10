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

WebApp.render({
  template:"index.html",
  options:{
    CSSFile:WebApp.getUrl({command:"renderCSS"}),
    JSFile:WebApp.getUrl({command:"renderJS"}),
    apiUrl:options&&options.apiUrl?options.apiUrl:"",
    gameApiUrl:options&&options.gameApiUrl?options.gameApiUrl:"",
    ref:options&&options.ref?options.ref:""
  }
});
