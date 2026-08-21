const fs = require('fs');
let code = fs.readFileSync('api/index.js', 'utf8');

const regex = /async function ensureUserExists\(userId, username, refParam\) \{([\s\S]*?)return existingUser;\s*\}/m;
const match = code.match(regex);

if (match) {
    let block = match[1];
    
    const newLogic = `
        const now = Date.now();
        let streakCount = existingUser.streakCount || 1;
        const lastLogin = existingUser.lastLoginTimestamp;
        
        if (lastLogin) {
            const hoursSince = (now - lastLogin) / (1000 * 60 * 60);
            if (hoursSince > 24 && hoursSince <= 48) {
                streakCount++;
            } else if (hoursSince > 48) {
                streakCount = 1;
            }
        }
        
        if (!existingUser.accountName || existingUser.accountName === 'Unknown User') {
            existingUser.accountName = username;
            existingUser.username = username;
        }
        
        existingUser.streakCount = streakCount;
        existingUser.lastLoginTimestamp = now;
        
        await dbUpdate(\`users/\${userId}\`, { 
            accountName: existingUser.accountName, 
            username: existingUser.username,
            streakCount: streakCount,
            lastLoginTimestamp: now
        });
        
        return existingUser;
    `;
    
    code = code.replace(regex, "async function ensureUserExists(userId, username, refParam) {\n    const existingUser = await dbGet(`users/${userId}`);\n    if (existingUser) {" + newLogic + "\n    }");
    fs.writeFileSync('api/index.js', code);
    console.log("ensureUserExists streak logic updated!");
} else {
    console.log("Could not find ensureUserExists.");
}
