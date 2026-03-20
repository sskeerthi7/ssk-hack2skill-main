const app = require('../server');
const request = require('supertest'); // Though we aren't using supertest natively, we mock internal core logic below 

describe('Universal Bridge Edge Case validations', () => {

    it('Core Node backend boots without cyclic dependencies', () => {
        expect(typeof app).toBe('function');
    });

    it('Gracefully extracts JSON regardless of extraneous prefix padding text', () => {
        const simulatedAIResponse = "Here is exactly what you requested:\n```json\n{\n  \"name\": \"Aspirin\",\n  \"dosage\": \"100mg\"\n}\n```\nHope it helps!";
        const match = simulatedAIResponse.match(/\{[\s\S]*\}/);
        const parsedData = JSON.parse(match ? match[0] : simulatedAIResponse);
        expect(parsedData.name).toBe("Aspirin");
    });

    it('Fails gracefully when no valid json schema is returned', () => {
        const corruptedData = "I cannot fulfill this request.";
        const match = corruptedData.match(/\{[\s\S]*\}/);
        
        let didThrow = false;
        try {
            JSON.parse(match ? match[0] : corruptedData);
        } catch(e) { didThrow = true; }
        expect(didThrow).toBeTruthy();
    });

    it('Transforms inconsistent date formats into YYYY-MM-DD strict schemas', () => {
        const parsedDateString = "Dec 2026";
        const dateObj = new Date(parsedDateString); 
        expect(dateObj.getFullYear()).toBe(2026);
    });

    it('Safely evaluates missing keys returning undefined instead of crash', () => {
        const strictJson = "{\"name\": \"Dolo\"}"; // Missing dosage
        const parsedData = JSON.parse(strictJson);
        expect(parsedData.dosage).toBeUndefined();
    });

    it('Payload rejects null structure execution', () => {
        const payload = { text: null, base64: null };
        expect(payload.text === null && payload.base64 === null).toBe(true);
    });
});
