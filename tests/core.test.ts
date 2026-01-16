import { CORE_PROMPT } from '../src/prompts';
import { REFUSAL_RESPONSES, BANNED_PATTERNS } from '../src/config';

describe('Constants', () => {
    test('CORE_PROMPT should contain Shariah Investments', () => {
        expect(CORE_PROMPT).toContain('Shariah Investments');
    });

    test('CORE_PROMPT should contain the Salam Rule', () => {
        expect(CORE_PROMPT).toContain('Walaikum Assalam');
    });

    test('REFUSAL_RESPONSES should exist', () => {
        expect(REFUSAL_RESPONSES.replica).toBeDefined();
        expect(REFUSAL_RESPONSES.tradingTip).toBeDefined();
    });

    test('BANNED_PATTERNS should be defined', () => {
        expect(BANNED_PATTERNS.length).toBeGreaterThan(0);
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
