
(() => {
'use strict';
const state={userId:'',user:null,campaigns:[],view:'dashboard',mode:'advertisement'};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const num=v=>Number(v||0).toLocaleString();
const base=()=>window.API_BASE_URL||'';
const uid=()=>String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||new URLSearchParams(location.search).get('userId')||'');
async function api(path,options={}){const r=await fetch(`${base()}${path}`,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d}
function toast(m){const n=$('#aspToast');if(!n)return;n.textContent=m;n.classList.add('show');clearTimeout(n._t);n._t=setTimeout(()=>n.classList.remove('show'),3000)}
function media(c){if(c.videoUrl)return `<video src="${esc(c.videoUrl)}" muted playsinline preload="metadata"></video>`;if(c.imageUrl)return `<img src="${esc(c.imageUrl)}" alt="">`;return `<i class="fa-solid ${c.sponsoredTask?'fa-list-check':'fa-rectangle-ad'}"></i>`}
function metrics(){return{impressions:state.campaigns.reduce((n,c)=>n+Number(c.impressions||c.views||0),0),clicks:state.campaigns.reduce((n,c)=>n+Number(c.adClicks||0),0),spend:state.campaigns.reduce((n,c)=>n+Number(c.adSpend||0),0)}}
function cards(list){if(!list.length)return `<div class="asp-empty"><i class="fa-solid fa-layer-group"></i><b>No campaigns yet</b><span>Create an advertisement or sponsored task to start.</span><button class="asp-primary" data-view="create"><i class="fa-solid fa-plus"></i> Create campaign</button></div>`;return `<div class="asp-list">${list.map(c=>{const max=Number(c.maxUsers||c.impressionBudget||0),used=Number(c.claims||c.impressions||0),pct=max?Math.min(100,used/max*100):0;return `<article class="asp-card asp-campaign"><div class="asp-media">${media(c)}</div><div class="asp-body"><div class="asp-row"><b>${esc(c.name||'Untitled')}</b><span class="asp-tag">${c.sponsoredTask?'TASK':'AD'}</span></div><p>${esc(c.desc||c.description||'No description')}</p><div class="asp-metrics"><span><i class="fa-solid fa-eye"></i> ${num(c.impressions||c.views)}</span><span><i class="fa-solid fa-arrow-pointer"></i> ${num(c.adClicks)}</span><span><i class="fa-solid fa-gem"></i> ${num(c.adSpend)}</span></div><div class="asp-progress"><span style="width:${pct}%"></span></div><div class="asp-row"><small>${c.paused?'Paused':(max&&used>=max?'Completed':'Active')}</small><button class="asp-secondary" data-manage="${esc(c.id)}">Manage <i class="fa-solid fa-chevron-right"></i></button></div></div></article>`}).join('')}</div>`}
function dashboard(){const m=metrics(),active=state.campaigns.filter(c=>!c.paused).length;return `<section class="asp-hero"><div><span class="asp-eyebrow"><i class="fa-solid fa-bolt"></i> ADVERTISER CONTROL CENTER</span><h1>Make every Gem<br><em>work harder.</em></h1><p class="asp-copy">Create premium advertisements and sponsored tasks, reserve real budget, and monitor delivery from one workspace.</p></div><button class="asp-primary" data-view="create"><i class="fa-solid fa-plus"></i> Create Campaign</button></section><div class="asp-stats"><div class="asp-stat"><i class="fa-solid fa-circle-play"></i><strong>${active}</strong><span>Active</span></div><div class="asp-stat"><i class="fa-solid fa-eye"></i><strong>${num(m.impressions)}</strong><span>Impressions</span></div><div class="asp-stat"><i class="fa-solid fa-arrow-pointer"></i><strong>${num(m.clicks)}</strong><span>Clicks</span></div><div class="asp-stat"><i class="fa-solid fa-gem"></i><strong>${num(m.spend)}</strong><span>Ad spend</span></div></div><section class="asp-section"><div class="asp-section-head"><div><small>Launch faster</small><h2>Choose a campaign type</h2></div></div><div class="asp-launch"><button data-create-mode="advertisement"><i class="fa-solid fa-rectangle-ad"></i><b>Advertisement</b><small>Image or video creative with a destination link.</small></button><button data-create-mode="task"><i class="fa-solid fa-list-check"></i><b>Sponsored Task</b><small>Reward users for completing an advertiser action.</small></button><button data-create-mode="hybrid"><i class="fa-solid fa-bullseye"></i><b>Ad + Task</b><small>Combine paid reach with conversion.</small></button></div></section><section class="asp-section"><div class="asp-section-head"><div><small>Delivery</small><h2>Recent campaigns</h2></div><button class="asp-secondary" data-view="campaigns">View all</button></div>${cards(state.campaigns.slice(0,4))}</section>`}
function create(){const task=state.mode==='task',hybrid=state.mode==='hybrid';return `<section class="asp-title"><span>CAMPAIGN BUILDER</span><h1>Build your next campaign.</h1><p class="asp-copy">The server validates the destination, balance, and reservation before launch.</p></section><div class="asp-card"><div class="asp-choice"><button class="${!task&&!hybrid?'active':''}" data-mode="advertisement"><i class="fa-solid fa-rectangle-ad"></i><b>Advertisement</b><small>Image / video</small></button><button class="${task?'active':''}" data-mode="task"><i class="fa-solid fa-list-check"></i><b>Sponsored Task</b><small>Reward users</small></button><button class="${hybrid?'active':''}" data-mode="hybrid"><i class="fa-solid fa-bullseye"></i><b>Ad + Task</b><small>Reach + action</small></button></div><form id="aspCreateForm"><div class="asp-form-grid"><label class="asp-field">Campaign name<input name="name" required maxlength="80" placeholder="Example: Product launch"></label><label class="asp-field">Destination URL<input name="link" required type="url" placeholder="https://example.com"></label></div>${!task?`<label class="asp-field">Image URL<input name="imageUrl" type="url" placeholder="https://cdn.example.com/banner.jpg"></label><label class="asp-field">Video URL<input name="videoUrl" type="url" placeholder="https://cdn.example.com/ad.mp4"></label><div class="asp-form-grid"><label class="asp-field">Headline<input name="headline" maxlength="100"></label><label class="asp-field">CTA<input name="cta" maxlength="32" value="Visit Now"></label></div><label class="asp-field">Description<textarea name="description" rows="3" maxlength="240"></textarea></label><div class="asp-preview" id="aspPreview"><i class="fa-solid fa-photo-film"></i><span>Add a hosted image or video URL to preview.</span></div>`:''}${(task||hybrid)?`<div class="asp-form-grid"><label class="asp-field">Task verification<select name="taskType"><option value="auto">Automatic Telegram verification</option><option value="manual">Manual proof review</option></select></label><label class="asp-field">Task icon<select name="icon"><option value="fa-telegram">Telegram</option><option value="fa-globe">Website</option><option value="fa-youtube">YouTube</option><option value="fa-robot">Bot</option></select></label><label class="asp-field">Target users<input name="maxUsers" type="number" min="1" value="100"></label><label class="asp-field">Reward per user<input name="reward" type="number" min="1" value="50"></label></div><label class="asp-field">Task instructions<textarea name="taskDesc" rows="3" maxlength="500"></textarea></label>`:''}${!task?`<div class="asp-form-grid"><label class="asp-field">Impression budget<input name="impressionBudget" type="number" min="1" value="1000"></label><label class="asp-field">Daily cap<input name="dailyBudget" type="number" min="0" value="0"></label></div>`:''}<div class="asp-cost"><span>Estimated reservation</span><strong id="aspCost">0 Gems</strong></div><button class="asp-primary" type="submit"><i class="fa-solid fa-lock"></i> Validate & Launch</button></form></div>`}
function analytics(){const m=metrics(),ctr=m.impressions?((m.clicks/m.impressions)*100).toFixed(2):'0.00';return `<section class="asp-title"><span>PERFORMANCE CENTER</span><h1>See what users open.</h1><p class="asp-copy">Delivery metrics recorded by the MYFA BIRR backend.</p></section><div class="asp-stats"><div class="asp-stat"><i class="fa-solid fa-eye"></i><strong>${num(m.impressions)}</strong><span>Impressions</span></div><div class="asp-stat"><i class="fa-solid fa-arrow-pointer"></i><strong>${num(m.clicks)}</strong><span>Clicks</span></div><div class="asp-stat"><i class="fa-solid fa-percent"></i><strong>${ctr}%</strong><span>CTR</span></div><div class="asp-stat"><i class="fa-solid fa-layer-group"></i><strong>${state.campaigns.length}</strong><span>Campaigns</span></div></div>${cards(state.campaigns)}`}
function wallet(){const reserved=state.campaigns.reduce((n,c)=>n+Number(c.escrowReserved||0),0);const m=metrics();return `<section class="asp-title"><span>ADVERTISER WALLET</span><h1>Budget with clarity.</h1><p class="asp-copy">Main Gems stay separate from campaign reservations and delivery spend.</p></section><div class="asp-wallet-hero"><i class="fa-solid fa-wallet"></i><div><small>Available Gems</small><strong>${num(state.user?.points)}</strong></div></div><div class="asp-stats"><div class="asp-stat"><i class="fa-solid fa-lock"></i><strong>${num(reserved)}</strong><span>Reserved</span></div><div class="asp-stat"><i class="fa-solid fa-chart-line"></i><strong>${num(m.spend)}</strong><span>Ad spend</span></div><div class="asp-stat"><i class="fa-solid fa-coins"></i><strong>${num(state.user?.stuckBalance)}</strong><span>Escrow balance</span></div><div class="asp-stat"><i class="fa-solid fa-layer-group"></i><strong>${state.campaigns.length}</strong><span>Campaigns</span></div></div>`}
function render(){const c=$('#aspContent');if(state.view==='dashboard')c.innerHTML=dashboard();if(state.view==='create')c.innerHTML=create();if(state.view==='campaigns')c.innerHTML=`<section class="asp-title"><span>INVENTORY</span><h1>Your campaigns.</h1><p class="asp-copy">Advertisements and sponsored tasks managed from one place.</p></section>${cards(state.campaigns)}`;if(state.view==='analytics')c.innerHTML=analytics();if(state.view==='wallet')c.innerHTML=wallet();$$('.asp-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));bindDynamic()}
async function refresh(){state.userId=uid();if(!state.userId)throw new Error('Telegram user session not found');const d=await api(`/api/ad-studio/dashboard/${encodeURIComponent(state.userId)}`);state.user=d.user;state.campaigns=d.campaigns||[];$('#aspBalance').textContent=num(state.user?.points);render()}
function bindCreate(){const f=$('#aspCreateForm');if(!f)return;const update=()=>{const image=f.imageUrl?.value.trim(),video=f.videoUrl?.value.trim(),p=$('#aspPreview');if(p){if(video)p.innerHTML=`<video src="${esc(video)}" controls muted playsinline preload="metadata"></video>`;else if(image)p.innerHTML=`<img src="${esc(image)}" alt="Preview">`;else p.innerHTML=`<i class="fa-solid fa-photo-film"></i><span>Add a hosted image or video URL to preview.</span>`}const task=state.mode!=='advertisement',ad=state.mode!=='task';const cost=(task?Number(f.maxUsers?.value||0)*Number(f.reward?.value||0):0)+(ad?Number(f.impressionBudget?.value||0):0);$('#aspCost').textContent=`${num(cost)} Gems`};f.addEventListener('input',update);update();f.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));const body={userId:state.userId,mode:state.mode,name:d.name,link:d.link,desc:d.description||d.taskDesc||'',imageUrl:d.imageUrl||'',videoUrl:d.videoUrl||'',headline:d.headline||'',cta:d.cta||'Visit Now',icon:d.icon||'fa-globe',taskType:d.taskType||'',maxUsers:Number(d.maxUsers||0),reward:Number(d.reward||0),impressionBudget:Number(d.impressionBudget||0),dailyBudget:Number(d.dailyBudget||0)};const b=f.querySelector('[type=submit]');b.disabled=true;try{const r=await api('/api/ad-studio/campaigns',{method:'POST',body:JSON.stringify(body)});state.user=r.user;state.campaigns=r.campaigns||state.campaigns;$('#aspBalance').textContent=num(state.user?.points);toast('Campaign launched and budget reserved.');state.view='campaigns';render()}catch(err){toast(err.message)}finally{b.disabled=false}})}
function openManage(id){const c=state.campaigns.find(x=>x.id===id);if(!c)return;const m=$('#aspModal');m.innerHTML=`<div><button class="asp-modal-close" data-close><i class="fa-solid fa-xmark"></i></button><div class="asp-modal-media">${media(c)}</div><span class="asp-eyebrow">${c.sponsoredTask?'SPONSORED TASK':'ADVERTISEMENT'}</span><h2>${esc(c.name)}</h2><p class="asp-copy">${esc(c.desc||'')}</p><div class="asp-metrics"><span><i class="fa-solid fa-eye"></i> ${num(c.impressions||c.views)}</span><span><i class="fa-solid fa-arrow-pointer"></i> ${num(c.adClicks)}</span><span><i class="fa-solid fa-gem"></i> ${num(c.adSpend)}</span></div><div class="asp-actions"><button class="asp-secondary" data-caction="toggle" data-id="${esc(id)}">${c.paused?'<i class="fa-solid fa-play"></i> Resume':'<i class="fa-solid fa-pause"></i> Pause'}</button><button class="asp-danger" data-caction="liquidate" data-id="${esc(id)}"><i class="fa-solid fa-rotate-left"></i> Refund remaining</button></div></div>`;m.classList.add('open');m.setAttribute('aria-hidden','false')}
async function action(action,id){try{const r=await api('/api/ad-studio/campaign/action',{method:'POST',body:JSON.stringify({userId:state.userId,campaignId:id,action})});state.user=r.user;state.campaigns=r.campaigns||[];$('#aspBalance').textContent=num(state.user?.points);$('#aspModal').classList.remove('open');toast(action==='liquidate'?`Refunded ${num(r.refunded)} Gems.`:'Campaign updated.');render()}catch(e){toast(e.message)}}
function bindDynamic(){$$('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});$$('[data-create-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.createMode;state.view='create';render()});$$('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;render()});$$('[data-manage]').forEach(b=>b.onclick=()=>openManage(b.dataset.manage));$$('[data-close]').forEach(b=>b.onclick=()=>$('#aspModal').classList.remove('open'));$$('[data-caction]').forEach(b=>b.onclick=()=>action(b.dataset.caction,b.dataset.id));if(state.view==='create')bindCreate()}
document.addEventListener('DOMContentLoaded',()=>{$('#adStudioApp').addEventListener('click',e=>{if(e.target.closest('[data-back]'))history.back()});refresh().catch(e=>{$('#aspContent').innerHTML=`<div class="asp-empty"><i class="fa-solid fa-circle-exclamation"></i><b>Ad Studio could not load</b><span>${esc(e.message)}</span><button class="asp-primary" onclick="location.reload()"><i class="fa-solid fa-rotate"></i> Retry</button></div>`})});
})();


/* AD STUDIO PRO DEEP CLIENT V3 */
(() => {
    'use strict';

    const root = window.AdStudioPRODeep = window.AdStudioPRODeep || {};

    root.constants = {
        version: '3.0.0',
        placements: ['home', 'tasks', 'games', 'profile'],
        formats: ['image', 'video', 'task', 'link'],
        statuses: ['active', 'paused', 'completed'],
        modes: ['advertisement', 'task', 'hybrid'],
        maximums: {
            campaignName: 80,
            headline: 100,
            description: 500,
            url: 2048,
            users: 1000000,
            reward: 100000000,
            budget: 100000000
        }
    };

    root.normalizeUrl = function normalizeUrl(value) {
        try {
            const url = new URL(String(value || '').trim());
            if (!['http:', 'https:'].includes(url.protocol)) return '';
            return url.toString();
        } catch (_) {
            return '';
        }
    };

    root.isHttps = function isHttps(value) {
        try {
            return new URL(String(value || '')).protocol === 'https:';
        } catch (_) {
            return false;
        }
    };

    root.clamp = function clamp(value, minimum, maximum) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return minimum;
        return Math.min(maximum, Math.max(minimum, numberValue));
    };

    root.safeInteger = function safeInteger(value, fallback = 0) {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? Math.floor(numberValue) : fallback;
    };

    root.moneyMath = {
        add(a, b) {
            return root.safeInteger(a) + root.safeInteger(b);
        },
        subtract(a, b) {
            return Math.max(0, root.safeInteger(a) - root.safeInteger(b));
        },
        multiply(a, b) {
            return root.safeInteger(a) * root.safeInteger(b);
        },
        percentage(part, total) {
            const denominator = root.safeInteger(total);
            if (!denominator) return 0;
            return root.clamp((root.safeInteger(part) / denominator) * 100, 0, 100);
        }
    };

    root.validateCreative = function validateCreative(input) {
        const errors = [];
        const image = String(input.imageUrl || '').trim();
        const video = String(input.videoUrl || '').trim();

        if (!image && !video) {
            errors.push('Add an image URL or video URL.');
        }

        if (image && !root.isHttps(image)) {
            errors.push('Image URL must use HTTPS.');
        }

        if (video && !root.isHttps(video)) {
            errors.push('Video URL must use HTTPS.');
        }

        return errors;
    };

    root.validateDestination = function validateDestination(value) {
        if (!root.isHttps(value)) {
            return 'Destination URL must use HTTPS.';
        }
        return '';
    };

    root.validateBudget = function validateBudget(input) {
        const errors = [];
        const impressionBudget = root.safeInteger(input.impressionBudget);
        const dailyBudget = root.safeInteger(input.dailyBudget);

        if (impressionBudget < 1 && input.mode !== 'task') {
            errors.push('Impression budget must be greater than zero.');
        }

        if (impressionBudget > root.constants.maximums.budget) {
            errors.push('Impression budget is too high.');
        }

        if (dailyBudget < 0) {
            errors.push('Daily budget cannot be negative.');
        }

        return errors;
    };

    root.validateTask = function validateTask(input) {
        if (input.mode === 'advertisement') return [];

        const errors = [];
        const users = root.safeInteger(input.maxUsers);
        const reward = root.safeInteger(input.reward);

        if (users < 1) errors.push('Target users must be greater than zero.');
        if (users > root.constants.maximums.users) errors.push('Target users are too high.');
        if (reward < 1) errors.push('Reward must be greater than zero.');
        if (reward > root.constants.maximums.reward) errors.push('Reward is too high.');

        return errors;
    };

    root.validateCampaign = function validateCampaign(input) {
        const errors = [];
        const name = String(input.name || '').trim();

        if (!name) errors.push('Campaign name is required.');
        if (name.length > root.constants.maximums.campaignName) {
            errors.push('Campaign name is too long.');
        }

        const destinationError = root.validateDestination(input.link);
        if (destinationError) errors.push(destinationError);

        if (input.mode !== 'task') {
            errors.push(...root.validateCreative(input));
        }

        errors.push(...root.validateTask(input));
        errors.push(...root.validateBudget(input));

        return [...new Set(errors)];
    };

    root.estimateReservation = function estimateReservation(input, costPerImpression = 1) {
        const adReservation = input.mode !== 'task'
            ? root.safeInteger(input.impressionBudget) * Math.max(1, root.safeInteger(costPerImpression, 1))
            : 0;

        const taskReservation = input.mode !== 'advertisement'
            ? root.safeInteger(input.maxUsers) * root.safeInteger(input.reward)
            : 0;

        return {
            advertisement: adReservation,
            task: taskReservation,
            total: adReservation + taskReservation
        };
    };

    root.campaignProgress = function campaignProgress(campaign) {
        const c = campaign || {};

        if (c.isAdvertisement) {
            return root.moneyMath.percentage(
                c.impressions || c.views,
                c.impressionBudget
            );
        }

        if (c.sponsoredTask) {
            return root.moneyMath.percentage(c.claims, c.maxUsers);
        }

        return 0;
    };

    root.campaignCtr = function campaignCtr(campaign) {
        const c = campaign || {};
        return c.impressions
            ? (Number(c.adClicks || 0) / Number(c.impressions)) * 100
            : 0;
    };

    root.campaignHealth = function campaignHealth(campaign) {
        const c = campaign || {};
        const progress = root.campaignProgress(c);
        const ctr = root.campaignCtr(c);

        if (c.paused) return { level: 'paused', score: 0 };
        if (progress >= 100) return { level: 'complete', score: 100 };
        if (ctr >= 8) return { level: 'excellent', score: 90 };
        if (ctr >= 4) return { level: 'good', score: 70 };
        if (ctr >= 1) return { level: 'watch', score: 45 };

        return { level: 'new', score: 25 };
    };

    root.sortCampaigns = function sortCampaigns(campaigns, sort = 'newest') {
        const list = [...(campaigns || [])];

        const compare = {
            newest: (a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0),
            spend: (a, b) => Number(b.adSpend || 0) - Number(a.adSpend || 0),
            impressions: (a, b) => Number(b.impressions || b.views || 0) - Number(a.impressions || a.views || 0),
            clicks: (a, b) => Number(b.adClicks || 0) - Number(a.adClicks || 0),
            name: (a, b) => String(a.name || '').localeCompare(String(b.name || ''))
        };

        return list.sort(compare[sort] || compare.newest);
    };

    root.filterCampaigns = function filterCampaigns(campaigns, filters = {}) {
        const query = String(filters.query || '').trim().toLowerCase();
        const status = String(filters.status || 'all');
        const format = String(filters.format || 'all');

        return (campaigns || []).filter(campaign => {
            if (status !== 'all') {
                const current = campaign.paused
                    ? 'paused'
                    : campaign.impressionBudget && campaign.impressions >= campaign.impressionBudget
                        ? 'completed'
                        : 'active';

                if (current !== status) return false;
            }

            if (format !== 'all') {
                const currentFormat = campaign.videoUrl
                    ? 'video'
                    : campaign.imageUrl
                        ? 'image'
                        : campaign.sponsoredTask
                            ? 'task'
                            : 'link';

                if (currentFormat !== format) return false;
            }

            if (query) {
                const haystack = [
                    campaign.name,
                    campaign.desc,
                    campaign.headline,
                    campaign.link
                ].join(' ').toLowerCase();

                if (!haystack.includes(query)) return false;
            }

            return true;
        });
    };

    root.aggregate = function aggregate(campaigns) {
        return (campaigns || []).reduce((result, campaign) => {
            result.campaigns += 1;
            result.impressions += root.safeInteger(campaign.impressions || campaign.views);
            result.clicks += root.safeInteger(campaign.adClicks);
            result.spend += root.safeInteger(campaign.adSpend);
            result.reserved += root.safeInteger(campaign.escrowReserved);

            if (campaign.isAdvertisement) result.advertisements += 1;
            if (campaign.sponsoredTask) result.tasks += 1;

            return result;
        }, {
            campaigns: 0,
            impressions: 0,
            clicks: 0,
            spend: 0,
            reserved: 0,
            advertisements: 0,
            tasks: 0
        });
    };

    root.makeReportRows = function makeReportRows(campaigns) {
        return (campaigns || []).map(campaign => ({
            id: campaign.id || '',
            name: campaign.name || '',
            status: campaign.paused ? 'paused' : 'active',
            format: campaign.videoUrl
                ? 'video'
                : campaign.imageUrl
                    ? 'image'
                    : campaign.sponsoredTask
                        ? 'task'
                        : 'link',
            impressions: root.safeInteger(campaign.impressions || campaign.views),
            clicks: root.safeInteger(campaign.adClicks),
            ctr: root.campaignCtr(campaign).toFixed(2),
            spend: root.safeInteger(campaign.adSpend),
            reserved: root.safeInteger(campaign.escrowReserved),
            createdAt: campaign.createdAt || 0,
            updatedAt: campaign.updatedAt || 0
        }));
    };

    root.buildCsv = function buildCsv(rows) {
        const headers = [
            'id',
            'name',
            'status',
            'format',
            'impressions',
            'clicks',
            'ctr',
            'spend',
            'reserved',
            'createdAt',
            'updatedAt'
        ];

        const escapeCell = value =>
            `"${String(value ?? '').replace(/"/g, '""')}"`;

        return [
            headers,
            ...(rows || []).map(row => headers.map(header => escapeCell(row[header])))
        ].map(row => row.join(',')).join('\n');
    };

    root.downloadCsv = function downloadCsv(filename, csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setTimeout(() => URL.revokeObjectURL(url), 500);
    };

    root.readForm = function readForm(form) {
        if (!form) return {};

        return Object.fromEntries(new FormData(form));
    };

    root.debounce = function debounce(callback, delay = 250) {
        let timer;

        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback(...args), delay);
        };
    };

    root.throttle = function throttle(callback, delay = 500) {
        let last = 0;

        return (...args) => {
            const now = Date.now();

            if (now - last < delay) return;

            last = now;
            callback(...args);
        };
    };

    root.storage = {
        get(key) {
            try {
                return localStorage.getItem(key);
            } catch (_) {
                return null;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (_) {
                return false;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (_) {
                return false;
            }
        }
    };

    root.draft = {
        key: 'myfa_ad_studio_pro_deep_draft',

        save(value) {
            return root.storage.set(this.key, JSON.stringify({
                ...value,
                savedAt: Date.now()
            }));
        },

        load() {
            const raw = root.storage.get(this.key);

            if (!raw) return null;

            try {
                return JSON.parse(raw);
            } catch (_) {
                this.clear();
                return null;
            }
        },

        clear() {
            root.storage.remove(this.key);
        }
    };

    root.media = {
        type(campaign) {
            if (campaign?.videoUrl) return 'video';
            if (campaign?.imageUrl) return 'image';
            if (campaign?.sponsoredTask) return 'task';
            return 'link';
        },

        hasCreative(campaign) {
            return Boolean(campaign?.videoUrl || campaign?.imageUrl);
        },

        canPreview(campaign) {
            return this.hasCreative(campaign) || Boolean(campaign?.sponsoredTask);
        }
    };

    root.delivery = {
        isEligible(campaign) {
            if (!campaign || !campaign.isAdvertisement) return false;
            if (campaign.paused) return false;

            const budget = root.safeInteger(campaign.impressionBudget);
            const impressions = root.safeInteger(campaign.impressions || campaign.views);

            return budget > impressions;
        },

        remaining(campaign) {
            const budget = root.safeInteger(campaign.impressionBudget);
            const impressions = root.safeInteger(campaign.impressions || campaign.views);

            return Math.max(0, budget - impressions);
        },

        select(campaigns, placement = 'home') {
            const eligible = (campaigns || []).filter(campaign => {
                if (!this.isEligible(campaign)) return false;

                if (!Array.isArray(campaign.placements)) return true;

                return campaign.placements.includes(placement);
            });

            return eligible.sort((a, b) => {
                const priority = Number(b.priority || 0) - Number(a.priority || 0);

                if (priority) return priority;

                return this.remaining(b) - this.remaining(a);
            })[0] || null;
        }
    };

    root.audience = {
        normalize(input) {
            const value = input || {};

            return {
                placement: String(value.placement || 'home'),
                countries: Array.isArray(value.countries) ? value.countries : [],
                languages: Array.isArray(value.languages) ? value.languages : [],
                minimumLevel: root.safeInteger(value.minimumLevel),
                maximumLevel: root.safeInteger(value.maximumLevel)
            };
        },

        matches(user, audience) {
            const target = this.normalize(audience);

            if (!user) return false;

            if (
                target.minimumLevel &&
                root.safeInteger(user.level) < target.minimumLevel
            ) {
                return false;
            }

            if (
                target.maximumLevel &&
                root.safeInteger(user.level) > target.maximumLevel
            ) {
                return false;
            }

            if (
                target.countries.length &&
                user.country &&
                !target.countries.includes(user.country)
            ) {
                return false;
            }

            if (
                target.languages.length &&
                user.language &&
                !target.languages.includes(user.language)
            ) {
                return false;
            }

            return true;
        }
    };

    root.lifecycle = {
        allowedActions(campaign) {
            if (!campaign) return [];

            if (campaign.paused) {
                return ['toggle', 'liquidate'];
            }

            if (campaign.status === 'completed') {
                return ['liquidate'];
            }

            return ['toggle', 'liquidate'];
        },

        isTerminal(campaign) {
            return campaign?.status === 'completed';
        }
    };

    root.accessibility = {
        focusFirst(container) {
            const target = container?.querySelector(
                'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            target?.focus();
        },

        announce(message) {
            let live = document.getElementById('aspDeepLiveRegion');

            if (!live) {
                live = document.createElement('div');
                live.id = 'aspDeepLiveRegion';
                live.setAttribute('aria-live', 'polite');
                live.setAttribute('aria-atomic', 'true');
                live.style.position = 'fixed';
                live.style.width = '1px';
                live.style.height = '1px';
                live.style.overflow = 'hidden';
                live.style.clip = 'rect(0 0 0 0)';
                document.body.appendChild(live);
            }

            live.textContent = String(message || '');
        }
    };

    root.performance = {
        marks: new Map(),

        start(label) {
            this.marks.set(label, performance.now());
        },

        end(label) {
            const started = this.marks.get(label);

            if (started === undefined) return 0;

            const elapsed = performance.now() - started;
            this.marks.delete(label);

            return elapsed;
        }
    };

    root.events = {
        listeners: new Map(),

        on(name, callback) {
            if (!this.listeners.has(name)) {
                this.listeners.set(name, new Set());
            }

            this.listeners.get(name).add(callback);

            return () => this.off(name, callback);
        },

        off(name, callback) {
            this.listeners.get(name)?.delete(callback);
        },

        emit(name, payload) {
            this.listeners.get(name)?.forEach(callback => {
                try {
                    callback(payload);
                } catch (_) {
                    // One listener must not break the remaining UI listeners.
                }
            });
        }
    };

    root.queue = {
        tasks: [],
        running: false,

        add(task) {
            if (typeof task !== 'function') return;

            this.tasks.push(task);
            this.run();
        },

        async run() {
            if (this.running) return;

            this.running = true;

            while (this.tasks.length) {
                const task = this.tasks.shift();

                try {
                    await task();
                } catch (_) {
                    // Background analytics should not stop the queue.
                }
            }

            this.running = false;
        }
    };

    root.version = function version() {
        return root.constants.version;
    };
})();
