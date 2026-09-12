import assert from 'node:assert';
import { addLog } from '../api/admin-gateway.js';

function runTests() {
  console.log("Running tests for addLog...");

  // Test 1: Basic functionality (adding to empty user)
  const emptyUser = {};
  const logs1 = addLog(emptyUser, "First log");
  assert.strictEqual(logs1.length, 1);
  assert.ok(logs1[0].includes("First log"));

  // Test 2: Edge case - missing/null user logs
  const nullLogsUser = { logs: null };
  const logs2 = addLog(nullLogsUser, "Log for null logs");
  assert.strictEqual(logs2.length, 1);
  assert.ok(logs2[0].includes("Log for null logs"));

  // Test 3: Existing logs
  const existingUser = { logs: ["[2023-01-01] Old log"] };
  const logs3 = addLog(existingUser, "New log");
  assert.strictEqual(logs3.length, 2);
  assert.ok(logs3[1].includes("New log"));

  // Test 4: Limit to 30 items
  const arrayWith30 = Array.from({length: 30}, (_, i) => `[time] Log ${i}`);
  const maxLogsUser = { logs: arrayWith30 };
  const logs4 = addLog(maxLogsUser, "Log 31");

  assert.strictEqual(logs4.length, 30);
  assert.strictEqual(logs4[0], "[time] Log 1"); // Oldest log (Log 0) should be removed
  assert.ok(logs4[29].includes("Log 31")); // Newest log should be at the end

  console.log("All tests passed!");
}

runTests();
