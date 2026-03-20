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

        const { text, base64Image } = req.body;

        let parts = [{
            text: `You are a medical data extraction AI. You MUST return ONLY valid RAW JSON, not even markdown backticks. Extract: { "name": string, "dosage": string, "quantity": number, "expiryDate": "YYYY-MM-DD" }. Parse this user input: ${text || "Examine image."}`
        }];

        if (base64Image) {
            parts.push({
                inline_data: { mime_type: "image/jpeg", data: base64Image }
            });
        }

        const geminiPayload = { contents: [{ parts }] };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });
        
        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({ error: `API Error: ${response.status} - ${errText}` });
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
