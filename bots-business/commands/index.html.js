/*CMD
  command: index.html
  help: MYFA BIRR main WebApp template
  need_reply:
  auto_retry_time:
  folder: MYFA WEBAPP
  answer:
  keyboard:
  aliases:
  group:
CMD*/
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0a0a1f">
<title>MYFA BIRR</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script src="https://sad.adsgram.ai/js/sad.min.js" defer></script>
<link rel="stylesheet" href="<% options.CSSFile %>">
</head>
<body class="dark-mode">
<div id="app">
  <header class="topbar glass">
    <div class="profile-mini">
      <img id="avatar" src="https://ui-avatars.com/api/?name=MYFA&background=00A8FF&color=fff" alt="profile">
      <div><strong id="name">User</strong><small id="status">Member</small></div>
    </div>
    <div class="balance-box"><div>💎 <span id="points">0</span></div><div>💵 <span id="cash">0.00</span></div></div>
  </header>
  <main id="content" class="content"></main>
  <nav class="bottom-nav glass">
    <button data-nav="home">🏠<span>Home</span></button>
    <button data-nav="tasks">✅<span>Tasks</span></button>
    <button data-nav="games">🎮<span>Games</span></button>
    <button data-nav="withdraw">💸<span>Withdraw</span></button>
    <button data-nav="more">☰<span>More</span></button>
  </nav>
</div>
<div id="toast" class="toast"></div>
<div id="modal" class="modal hidden"><div class="modal-card glass"><button class="modal-x" onclick="closeModal()">×</button><div id="modalBody"></div></div></div>
<script>window.MYFA_CONFIG={apiUrl:"<% options.apiUrl %>",ref:"<% options.ref %>"};</script>
<script src="<% options.JSFile %>"></script>
</body>
</html>
