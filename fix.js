import { parse } from 'acorn';
import fs from 'fs';

const content = fs.readFileSync('api/test.js', 'utf8');
try {
  parse(content, { ecmaVersion: 2022, sourceType: 'module' });
  console.log("Syntax is OK with acorn");
} catch(e) {
  console.error("Acorn error:", e);
}
