const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g);
if (scripts) {
    scripts.forEach((scriptTag, idx) => {
        const code = scriptTag.replace(/<\/?script>/g, '');
        try {
            require('vm').createScript(code);
            console.log(`Script ${idx} OK`);
        } catch(e) {
            console.log(`Script ${idx} Error:`, e.message);
        }
    });
}
