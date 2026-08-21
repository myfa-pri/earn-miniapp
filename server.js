import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiApp from './api/index.js';
import gamesRouter from './api/games.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// API Routes
app.use(apiApp);
app.use('/api', gamesRouter); // mount games routes at /api/

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/myfa', (req, res) => res.sendFile(path.join(__dirname, 'public', 'myfa.html')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
