import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const firebaseConfig = {
    databaseURL: "https://besh-81e22-default-rtdb.firebaseio.com",
};

async function dbCall(path, method, data = null) {
    try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        const options = { method: method, headers: { "Content-Type": "application/json" } };
        if (data) options.body = JSON.stringify(data);
        const response = await fetch(url, options);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) { return null; }
}

async function dbGet(path) { return await dbCall(path, 'GET'); }
async function dbUpdate(path, partialData) { return await dbCall(path, 'PATCH', partialData); }

// Ludo Payout
router.post(['/ludo/payout', '/ludo/result'], async (req, res) => {
    try {
        const { userId, wager, isWin, payout } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        const user = await dbGet(`users/${userId}`);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        let newBal = user.realBalance || 0;
        if (isWin) {
            newBal += (payout - wager); // Net profit
        } else {
            newBal -= wager;
        }
        
        await dbUpdate(`users/${userId}`, { realBalance: newBal });
        res.json({ success: true, balance: newBal });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Chicken Road Rigged Math (75 / 15 / 10)
router.post('/chicken/start', async (req, res) => {
    try {
        const { userId, wager } = req.body;
        const user = await dbGet(`users/${userId}`);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        if ((user.realBalance || 0) < wager) {
            return res.status(400).json({ error: 'Insufficient funds', balance: user.realBalance });
        }
        
        // Deduct wager immediately
        const newBal = (user.realBalance || 0) - wager;
        await dbUpdate(`users/${userId}`, { realBalance: newBal });
        
        // Calculate the rigged death lane
        // Multipliers in frontend: [1.00, 1.20, 1.50, 2.00, 3.00, 5.00, 10.0, ...]
        // Lane indices: 0(1.00x), 1(1.20x), 2(1.50x), 3(2.00x), 4(3.00x), 5(5.00x), 6(10.0x)
        let deathLane;
        let rand = Math.random();
        
        if (rand < 0.75) {
            // Dies before 2.00x (Lanes 1 or 2)
            deathLane = Math.floor(Math.random() * 2) + 1; 
        } else if (rand < 0.90) {
            // Reaches exactly 2.00x - 2.99x, dies at lane 3
            deathLane = 3;
        } else {
            // Survives past 3.00x (Dies at lane 4+)
            deathLane = Math.floor(Math.random() * 5) + 4;
        }
        
        const multipliers = [1.00, 1.20, 1.50, 2.00, 3.00, 5.00, 10.0, 25.0];
        
        // Return the death lane (Server Seed resolved)
        res.json({ success: true, deathLane, balance: newBal, multipliers, seed: Math.random().toString(36).substring(7) });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/chicken/cashout', async (req, res) => {
    try {
        const { userId, payout } = req.body;
        const user = await dbGet(`users/${userId}`);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const newBal = (user.realBalance || 0) + payout;
        await dbUpdate(`users/${userId}`, { realBalance: newBal });
        
        res.json({ success: true, balance: newBal });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

export default router;
