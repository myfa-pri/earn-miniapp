import fs from 'fs';
const content = fs.readFileSync('api/test.js', 'utf8');

// I see at line 817:
// res.json({ success: false, error: "Server error." });
//
// app.post('/api/ensure-user', async (req, res) => {
// It's missing `} });` for `catch (e) { ... }` closing and the `app.post` closing!

const fixedContent = content.replace(
    /res\.json\(\{ success: false, error: "Server error\." \}\);\n\napp\.post\('\/api\/ensure-user'/g,
    'res.json({ success: false, error: "Server error." });\n        }\n});\n\napp.post(\'/api/ensure-user\''
);

fs.writeFileSync('api/test.js', fixedContent, 'utf8');
