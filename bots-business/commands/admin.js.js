/*CMD
  command: admin.js
  help: MYFA BIRR admin WebApp JavaScript template
  need_reply:
  auto_retry_time:
  folder: MYFA ADMIN
  answer:
  keyboard:
  aliases:
  group:
CMD*/
const API=window.MYFA_ADMIN?.apiUrl||'';const $=s=>document.querySelector(s);async function call(a,d={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a,...d})});return r.json()}function msg(x){$('#msg').textContent=typeof x==='string'?x:JSON.stringify(x);$('#state').textContent='Connected'}async function loadStats(){try{const d=await call('admin-stats');if(!d.ok)throw Error(d.error);$('#stats').innerHTML='Users: '+d.totalUsers+'<br>Pending withdrawals: '+d.pendingWithdrawals+'<br>Tasks: '+d.tasks+'<br>Campaigns: '+d.campaigns;msg('Stats loaded')}catch(e){msg(e.message)}}async function ban(v){try{const d=await call('admin-ban',{telegramId:$('#uid').value,banned:v});if(!d.ok)throw Error(d.error);msg(v?'User banned':'User unbanned')}catch(e){msg(e.message)}}async function review(){try{const d=await call('admin-withdraw',{id:$('#wid').value,status:$('#wstatus').value});if(!d.ok)throw Error(d.error);msg('Withdrawal '+d.withdrawal.status)}catch(e){msg(e.message)}}async function createTask(){try{const d=await call('create-task',{title:$('#tt').value,description:$('#td').value,reward:Number($('#tr').value),url:$('#tu').value});if(!d.ok)throw Error(d.error);msg('Task created')}catch(e){msg(e.message)}}async function promo(){try{const d=await call('admin-promo',{code:$('#pc').value,reward:Number($('#pr').value)});if(!d.ok)throw Error(d.error);msg('Promo '+d.code+' created')}catch(e){msg(e.message)}}window.loadStats=loadStats;window.ban=ban;window.review=review;window.createTask=createTask;window.promo=promo;loadStats();
