const express = require('express');
const path = require('path');

const app = express();

// Security Middleware
app.use(express.json({ limit: '50mb' }));

// Serve frontend assets cleanly from /public
app.use(express.static(path.join(__dirname, 'public')));

// Secure Proxy for Gemini AI
app.post('/api/gemini', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server Configuration Error: Missing API Key" });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        if (!response.ok) {
            return res.status(response.status).json({ error: response.statusText });
        }
        
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("Internal Proxy Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Explicit IPv4 binding for Cloud Run healthchecks
const PORT = parseInt(process.env.PORT) || 8080;
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Secure Server active on port ${PORT}`);
    });
}

module.exports = app; // Exported precisely for Jest Integration Testing
