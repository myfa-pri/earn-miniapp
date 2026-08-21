const fs = require('fs');
let code = fs.readFileSync('api/index.js', 'utf8');

const profileRoutes = `
app.post('/api/profile/update', async (req, res) => {
    try {
        const { userId, updates } = req.body;
        if(!userId || !updates) return res.status(400).json({ error: 'Missing data' });
        
        await dbUpdate(\`users/\${userId}\`, updates);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/profile/burn', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        if(!userId || amount <= 0) return res.status(400).json({ error: 'Invalid data' });
        
        const user = await dbGet(\`users/\${userId}\`);
        if(!user || (user.points || 0) < amount) return res.status(400).json({ error: 'Insufficient Gems' });
        
        await dbUpdate(\`users/\${userId}\`, { points: user.points - amount });
        res.json({ success: true, newPoints: user.points - amount });
    } catch(e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/profile/panic', async (req, res) => {
    try {
        const { userId } = req.body;
        if(!userId) return res.status(400).json({ error: 'Missing data' });
        
        await dbUpdate(\`users/\${userId}\`, { sessionHash: Date.now().toString() });
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/profile/sessions', async (req, res) => {
    try {
        const { userId, action } = req.body;
        if(action === 'revoke') {
            await dbUpdate(\`users/\${userId}\`, { activeSessions: [] });
            return res.json({ success: true });
        }
        res.json({ success: true, sessions: [{ip: '192.168.1.1', date: Date.now()}] });
    } catch(e) {
        res.status(500).json({ error: 'Server error' });
    }
});

`;

code = code.replace('export default app;', profileRoutes + '\nexport default app;');
fs.writeFileSync('api/index.js', code);
console.log("Profile backend routes added!");
