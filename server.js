import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';
import apiApp from './api/index.js';
import gamesRouter from './api/games.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Disable caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// API Routes
app.use(apiApp);
app.use('/api', gamesRouter); // mount games routes at /api/

// Static Files
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));
app.get('/myfa', (req, res) => res.sendFile(path.join(__dirname, 'public', 'myfa.html')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
});
