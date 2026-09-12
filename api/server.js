import express from 'express';
import app from './index.js';
import gamesRouter from './games.js';
import path from 'path';

// Import games router
app.use('/api', gamesRouter);

// Serve static files
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = 3000;
app.listen(PORT, '0.0.0.0');
