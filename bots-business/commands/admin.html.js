/*CMD
  command: admin.html
  help: MYFA BIRR admin WebApp template
  need_reply:
  auto_retry_time:
  folder: MYFA ADMIN
  answer:
  keyboard:
  aliases:
  group:
CMD*/
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>MYFA BIRR Admin</title><script src="https://telegram.org/js/telegram-web-app.js"></script><link rel="stylesheet" href="<% options.CSSFile %>"></head><body><div class="admin"><header><h1>MYFA BIRR Admin</h1><span id="state">Connecting...</span></header><section class="card"><h2>Overview</h2><div id="stats">Loading...</div><button onclick="loadStats()">Refresh</button></section><section class="card"><h2>Ban / Unban User</h2><input id="uid" placeholder="Telegram ID"><button onclick="ban(true)">Ban</button><button onclick="ban(false)">Unban</button></section><section class="card"><h2>Withdrawal</h2><input id="wid" placeholder="Withdrawal ID"><select id="wstatus"><option>approved</option><option>rejected</option><option>paid</option></select><button onclick="review()">Update</button></section><section class="card"><h2>Create Task</h2><input id="tt" placeholder="Title"><input id="td" placeholder="Description"><input id="tr" type="number" placeholder="Reward"><input id="tu" placeholder="URL"><button onclick="createTask()">Create</button></section><section class="card"><h2>Create Promo</h2><input id="pc" placeholder="Code"><input id="pr" type="number" placeholder="Reward"><button onclick="promo()">Create</button></section><div id="msg"></div></div><script>window.MYFA_ADMIN={apiUrl:"<% options.apiUrl %>"};</script><script src="<% options.JSFile %>"></script></body></html>
