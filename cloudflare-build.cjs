const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.join(process.cwd(), 'api', 'index.js');
const targetPath = path.join(process.cwd(), 'api', 'index-cloudflare.js');

let source = fs.readFileSync(sourcePath, 'utf8');

if (!/\bexport\s+default\s+app\s*;/.test(source)) {
  if (source.includes('// export default app;')) source = source.replace('// export default app;', 'export default app;');
  else source += '\n\nexport default app;\n';
}

if (!source.includes('app.use(express.json())')) {
  source = source.replace('const app = express();', 'const app = express();\napp.use(express.json({ limit: \'2mb\' }));');
}

// The membership gate must re-check frequently after a user leaves/rejoins a channel.
source = source.replace(/now - Number\(u\.gateCheckedAt\) > 60000/g, 'now - Number(u.gateCheckedAt) > 15000');

fs.writeFileSync(targetPath, source, 'utf8');
console.log(`Cloudflare API adapter generated: ${targetPath}`);
