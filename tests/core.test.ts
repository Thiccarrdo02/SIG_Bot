import { SYSTEM_PROMPT, SAFETY_REFUSAL_RESPONSE, CAMPAIGN_RULES } from '../src/config/constants';

describe('Constants', () => {
    test('SYSTEM_PROMPT should contain Shariah Investments', () => {
        expect(SYSTEM_PROMPT).toContain('Shariah Investments');
    });

    test('SYSTEM_PROMPT should contain the Salam Rule', () => {
        expect(SYSTEM_PROMPT).toContain('Walaikum Assalam');
    });

    test('SAFETY_REFUSAL_RESPONSE should exist', () => {
        expect(SAFETY_REFUSAL_RESPONSE.length).toBeGreaterThan(0);
    });

    test('CAMPAIGN_RULES should have 5 rules', () => {
        expect(CAMPAIGN_RULES).toHaveLength(5);
    });
});

describe('Safety Check', () => {
    const bannedKeywords = ["kill", "suicide", "murder"];

    test('should detect banned keywords', () => {
        const testMessage = "I want to kill time";
        const hasBanned = bannedKeywords.some(k => testMessage.toLowerCase().includes(k));
        expect(hasBanned).toBe(true);
    });

    test('should pass safe messages', () => {
        const testMessage = "I want to get fit";
        const hasBanned = bannedKeywords.some(k => testMessage.toLowerCase().includes(k));
        expect(hasBanned).toBe(false);
    });
});
