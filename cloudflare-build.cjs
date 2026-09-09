const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.join(process.cwd(), 'api', 'index.js');
const targetPath = path.join(process.cwd(), 'api', 'index-cloudflare.js');

let source = fs.readFileSync(sourcePath, 'utf8');

// The production API was originally written as a Vercel-style Express app.
// Cloudflare needs the Express app exported so the Worker adapter can mount it.
if (!/\bexport\s+default\s+app\s*;/.test(source)) {
  if (source.includes('// export default app;')) {
    source = source.replace('// export default app;', 'export default app;');
  } else {
    source += '\n\nexport default app;\n';
  }
}

// The main API historically relied on Vercel to provide req.body parsing.
// Cloudflare's Express runtime needs the JSON middleware explicitly.
if (!source.includes('app.use(express.json())')) {
  source = source.replace(
    'const app = express();',
    'const app = express();\napp.use(express.json({ limit: \'2mb\' }));'
  );
}

fs.writeFileSync(targetPath, source, 'utf8');
console.log(`Cloudflare API adapter generated: ${targetPath}`);
