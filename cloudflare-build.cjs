const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.join(process.cwd(), 'api', 'index.js');
const targetPath = path.join(process.cwd(), 'api', 'index-cloudflare.js');

let source = fs.readFileSync(sourcePath, 'utf8');

// Never keep a Telegram bot token in source. Cloudflare/Vercel provide it as a secret.
source = source.replace(
  /const BOT_TOKEN = ['"][^'"]*['"];[\r\n]*/,
  "const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';\nconst BOT_TOKEN_CONFIGURED = Boolean(BOT_TOKEN);\n"
);

// The Telegram client must still initialize when the secret has not yet been attached;
// Telegram calls will fail clearly until TELEGRAM_BOT_TOKEN/BOT_TOKEN is configured.
source = source.replace(
  "const bot = new TelegramBot(BOT_TOKEN, { polling: false });",
  "const bot = new TelegramBot(BOT_TOKEN || '000000000:INVALID', { polling: false });",
  1
);

// Telegram webhook requests are JSON. Keep this in the canonical source and generated adapter.
if (!source.includes("app.use(express.json({ limit: '2mb' }));")) {
  source = source.replace(
    'const app = express();',
    "const app = express();\napp.use(express.json({ limit: '2mb' }));",
    1
  );
}

// Re-register the webhook against the current Worker origin and the current secret.
const setupPattern = /app\.get\('\/api\/setup', async \(req, res\) => \{[\s\S]*?\n\}\);\n\napp\.post\('\/api\/webhook',/m;
const setupReplacement = `app.get('/api/setup', async (req, res) => {
    try {
        if (!BOT_TOKEN_CONFIGURED) {
            return res.status(500).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured on this Worker.' });
        }
        const host = req.headers.host;
        const configuredBase = (process.env.PUBLIC_APP_URL || \`https://\${host}\`).replace(/\\/+$/, '');
        const webhookUrl = \`\${configuredBase}/api/webhook\`;
        const telegramUrl = \`https://api.telegram.org/bot\${BOT_TOKEN}/setWebhook?url=\${encodeURIComponent(webhookUrl)}\`;
        const response = await fetch(telegramUrl);
        const data = await response.json();
        if (data.ok) {
            return res.status(200).json({ success: true, message: 'Webhook successfully configured!', url: webhookUrl });
        }
        return res.status(500).json({ success: false, error: data.description || 'Telegram rejected webhook configuration' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/bot-status', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (!BOT_TOKEN_CONFIGURED) {
        return res.status(500).json({ configured: false, error: 'TELEGRAM_BOT_TOKEN is not configured on this Worker.' });
    }
    try {
        const [meResponse, webhookResponse] = await Promise.all([
            fetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/getMe\`),
            fetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/getWebhookInfo\`)
        ]);
        const me = await meResponse.json();
        const webhook = await webhookResponse.json();
        return res.json({
            configured: true,
            bot: me.ok ? { id: me.result.id, username: me.result.username, first_name: me.result.first_name } : { error: me.description || 'getMe failed' },
            webhook: webhook.ok ? {
                url: webhook.result.url,
                pending_update_count: webhook.result.pending_update_count,
                last_error_date: webhook.result.last_error_date || null,
                last_error_message: webhook.result.last_error_message || null
            } : { error: webhook.description || 'getWebhookInfo failed' }
        });
    } catch (error) {
        return res.status(500).json({ configured: true, error: error.message || 'Telegram diagnostics failed' });
    }
});

app.post('/api/webhook',`;
if (setupPattern.test(source)) {
  source = source.replace(setupPattern, setupReplacement);
}

// Keep gate membership checks fresh after a user leaves/rejoins.
source = source.replace(
  /now - Number\(u\.gateCheckedAt\) > 60000/g,
  'now - Number(u.gateCheckedAt) > 15000'
);

// Write the canonical source as well as the Cloudflare adapter so both deployments use the same bot.
fs.writeFileSync(sourcePath, source, 'utf8');

if (!/\bexport\s+default\s+app\s*;/.test(source)) {
  source += '\n\nexport default app;\n';
}
fs.writeFileSync(targetPath, source, 'utf8');
console.log(`Cloudflare API adapter generated: ${targetPath}`);
