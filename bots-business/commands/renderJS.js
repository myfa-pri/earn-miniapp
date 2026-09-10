/*CMD
  command: renderJS
  help: MYFA BIRR JS renderer
  need_reply:
  auto_retry_time:
  folder: MYFA WEBAPP
  answer:
  keyboard:
  aliases:
  group:
CMD*/
WebApp.render({
  template: "script.bb.js",
  mime_type: "application/javascript"
});
