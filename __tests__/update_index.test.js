import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

test('update_index.js modifies HTML strings properly', async (t) => {
    const originalReadFileSync = fs.readFileSync;
    const originalWriteFileSync = fs.writeFileSync;

    let writtenPath = '';
    let writtenContent = '';

    fs.readFileSync = (p, encoding) => {
        return `
            <div id="loading-overlay">Old Loading...</div><style>@keyframes loadingBar {}</style>
            <div id="themeToggle">Theme</div><div style="width:1px; background:rgba(255,255,255,0.2);"></div>
            <div id="pageHeader" class="page-header glass">Old Header</div></div></div>
            <div class="bottom-nav glass" id="bottomNav">Old Nav</div>
            <div class="glass floating-pill"></div>
            <button class="btn-primary"></button>
        `;
    };

    fs.writeFileSync = (p, data, encoding) => {
        writtenPath = p;
        writtenContent = data;
    };

    const codePath = path.resolve(process.cwd(), 'api/update_index.js');
    const code = originalReadFileSync(codePath, 'utf8');

    // Stub console.log to avoid test output spam
    const context = { require, console: { log: () => {} } };
    vm.createContext(context);

    try {
        vm.runInContext(code, context);

        assert.ok(writtenContent.includes('class="holographic-loader"'));
        assert.ok(!writtenContent.includes('Old Loading...'));
        assert.ok(!writtenContent.includes('<div id="themeToggle">'));
        assert.ok(writtenContent.includes('id="pageHeader" class="quantum-header"'));
        assert.ok(writtenContent.includes('class="quantum-nav" id="bottomNav"'));
        assert.ok(writtenContent.includes('class="cyber-card floating-pill"'));
        assert.ok(writtenContent.includes('class="quantum-btn"'));
    } finally {
        fs.readFileSync = originalReadFileSync;
        fs.writeFileSync = originalWriteFileSync;
    }
});
