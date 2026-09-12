import assert from 'assert';
import { logAction } from '../api/index.js';

try {
    let user1 = {};
    logAction(user1, "test action");
    assert.strictEqual(user1.logs.length, 1);
    assert.ok(user1.logs[0].includes("test action"));

    let user2 = { logs: ["[2023-01-01] old log"] };
    logAction(user2, "new action");
    assert.strictEqual(user2.logs.length, 2);
    assert.ok(user2.logs[1].includes("new action"));

    let user3 = { logs: [] };
    for (let i = 0; i < 35; i++) {
        logAction(user3, `action ${i}`);
    }
    assert.strictEqual(user3.logs.length, 30);
    assert.ok(user3.logs[0].includes("action 5"), "Should drop oldest");
    assert.ok(user3.logs[29].includes("action 34"), "Should keep newest");

    console.log("logAction tests passed!");
} catch (e) {
    console.error("Test failed:", e);
    process.exit(1);
}
