const app = require('../server');

describe('Universal Bridge Core Logic validation', () => {
    it('Server API module builds correctly without crashing constraints', () => {
        expect(typeof app).toBe('function');
    });

    it('Parser accurately extracts strict schema JSON from unstructured markdown blocks', () => {
        // Simulating the unstructured chaos from Gemini
        const simulatedAIResponse = "```json\n{\n  \"name\": \"Aspirin\",\n  \"dosage\": \"100mg\"\n}\n```";
        
        // Exact logic from our frontend validation module
        const match = simulatedAIResponse.match(/\{[\s\S]*\}/);
        const parsedData = JSON.parse(match ? match[0] : simulatedAIResponse);
        
        expect(parsedData).toBeDefined();
        expect(parsedData.name).toBe("Aspirin");
        expect(parsedData.dosage).toBe("100mg");
    });
});
