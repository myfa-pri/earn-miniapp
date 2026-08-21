const fs = require('fs');
let code = fs.readFileSync('api/index.js', 'utf8');

const regex = /app\.post\('\/api\/ensure-user', async \(req, res\) => \{([\s\S]*?)res\.json\(\{ success: true, user: userData \}\);/m;
const match = code.match(regex);

if (match) {
    let block = match[1];
    
    const streakLogic = `
        const now = Date.now();
        const lastLogin = userData.lastLoginTimestamp;
        let streakCount = userData.streakCount || 1;
        
        if (lastLogin) {
            const hoursSince = (now - lastLogin) / (1000 * 60 * 60);
            if (hoursSince > 24 && hoursSince <= 48) {
                streakCount++;
            } else if (hoursSince > 48) {
                streakCount = 1;
            }
        } else {
            streakCount = 1;
        }
        userData.streakCount = streakCount;
        userData.lastLoginTimestamp = now;
        
        await dbUpdate(\`users/\${userId}\`, { 
            streakCount: streakCount, 
            lastLoginTimestamp: now 
        });
    `;
    
    block = block + streakLogic;
    
    code = code.replace(regex, "app.post('/api/ensure-user', async (req, res) => {" + block + "res.json({ success: true, user: userData });");
    fs.writeFileSync('api/index.js', code);
    console.log("api/index.js login logic updated!");
} else {
    console.log("Could not find ensure-user endpoint.");
}
