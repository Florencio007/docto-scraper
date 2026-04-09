const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 7860;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Flo0320790153Cio';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Middleware d'authentification
const auth = (req, res, next) => {
    const token = req.cookies.auth_token;
    if (token === PASSWORD) {
        next();
    } else {
        res.redirect('/login.html');
    }
};

// Routes
app.get('/', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        res.cookie('auth_token', PASSWORD, { httpOnly: true });
        res.redirect('/');
    } else {
        res.redirect('/login.html?error=1');
    }
});

// État du scraper
let scraperProcess = null;
let scraperLogs = [];

const startScraper = (phase = 'phase2') => {
    if (scraperProcess) return;

    console.log(`[SERVER] Lancement du scraper (${phase})...`);
    const args = [path.join(__dirname, 'scraper_ophtalmologues_zone3.js'), `--${phase}`, '--headless'];
    
    scraperProcess = spawn('node', args, {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    scraperProcess.stdout.on('data', (data) => {
        const msg = data.toString();
        scraperLogs.push(msg);
        if (scraperLogs.length > 500) scraperLogs.shift();
    });

    scraperProcess.stderr.on('data', (data) => {
        const msg = `[ERROR] ${data.toString()}`;
        scraperLogs.push(msg);
        if (scraperLogs.length > 500) scraperLogs.shift();
    });

    scraperProcess.on('close', (code) => {
        console.log(`[SERVER] Scraper arrêté (code ${code})`);
        scraperProcess = null;
        scraperLogs.push(`\n[SYSTEM] Scraper arrêté (code ${code})\n`);
    });
};

// API pour le dashboard
app.get('/api/status', auth, (req, res) => {
    let progress = { pct: 0, processed: 0, total: 0 };
    try {
        if (fs.existsSync('progress.json')) {
            const data = JSON.parse(fs.readFileSync('progress.json', 'utf8'));
            const processedCount = (data.processed || []).length;
            
            let totalCount = 0;
            if (data.links) {
                totalCount = Object.values(data.links).reduce((acc, dep) => acc + (dep.urls ? dep.urls.length : 0), 0);
            }
            
            progress = {
                processed: processedCount,
                total: totalCount,
                pct: totalCount > 0 ? ((processedCount / totalCount) * 100).toFixed(1) : 0
            };
        }
    } catch (e) {}

    res.json({
        running: !!scraperProcess,
        progress: progress
    });
});

app.get('/api/logs', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (data) => {
        res.write(`data: ${JSON.stringify({ log: data })}\n\n`);
    };

    // Envoyer les logs existants
    scraperLogs.forEach(l => sendLog(l));

    // Écouter les nouveaux logs
    const onData = (data) => sendLog(data.toString());
    const onClose = () => {
        res.end();
        if (scraperProcess) {
            scraperProcess.stdout.removeListener('data', onData);
            scraperProcess.stderr.removeListener('data', onData);
        }
    };

    if (scraperProcess) {
        scraperProcess.stdout.on('data', onData);
        scraperProcess.stderr.on('data', onData);
        scraperProcess.on('close', onClose);
    } else {
        res.end();
    }
});

app.post('/api/start', auth, (req, res) => {
    const { phase } = req.body;
    startScraper(phase || 'phase2');
    res.json({ success: true });
});

app.post('/api/stop', auth, (req, res) => {
    if (scraperProcess) {
        scraperProcess.kill('SIGINT');
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Pas de processus en cours' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Interface web démarrée sur le port ${PORT}`);
    
    // Auto-start Phase 2 au démarrage
    setTimeout(() => {
        console.log("[SERVER] Lancement automatique de la Phase 2...");
        startScraper('phase2');
    }, 5000);
});
