/**
 * Local Chat Testing CLI
 * Run with: npm run chat
 * 
 * Works in pure memory mode - no Redis or Database required!
 * 
 * Commands:
 * - exit: Quit the chat
 * - clear: Reset session
 * - extract: Force extract data from current session
 * - debug: Show current session info
 */

import * as readline from 'readline';

// Load environment first
import dotenv from 'dotenv';
dotenv.config();

import { responderService, sessionService, extractorService } from '../src/services';

const TEST_USER_ID = 'cli-test-user';

console.log('\n🤖 SIG Chatbot Local Testing Mode');
console.log('================================');
console.log('Running in memory-only mode (no Redis/Database)');
console.log('Type your message and press Enter.');
console.log('Commands: "exit", "clear", "extract", "debug"\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function chat(): Promise<void> {
    rl.question('You: ', async (input) => {
        const message = input.trim();

        if (!message) {
            chat();
            return;
        }

        if (message.toLowerCase() === 'exit') {
            console.log('\n👋 Goodbye!\n');
            rl.close();
            process.exit(0);
        }

        if (message.toLowerCase() === 'clear') {
            console.log('🔄 Session cleared.\n');
            // Clear session by creating new one
            chat();
            return;
        }

        // Debug command - show session info
        if (message.toLowerCase() === 'debug') {
            try {
                const session = await sessionService.getSession(TEST_USER_ID);
                console.log('\n📊 Session Debug Info:');
                console.log(`   User ID: ${session.manychatId}`);
                console.log(`   Messages: ${session.messages.length}`);
                console.log(`   Current Path: ${session.currentPath}`);
                console.log(`   Last Activity: ${session.lastActivity}`);
                console.log(`   Processed: ${session.isProcessed}`);
                if (session.messages.length > 0) {
                    console.log('   Recent messages:');
                    session.messages.slice(-4).forEach((m, i) => {
                        console.log(`     ${m.role}: ${m.content.substring(0, 50)}...`);
                    });
                }
                console.log('');
            } catch (error: any) {
                console.log('❌ Error getting session:', error.message);
            }
            chat();
            return;
        }

        // Extract command - force extraction from current session
        if (message.toLowerCase() === 'extract') {
            try {
                console.log('\n📤 Extracting data from current session...\n');
                const session = await sessionService.getSession(TEST_USER_ID);

                if (session.messages.length === 0) {
                    console.log('❌ No messages in session to extract.\n');
                    chat();
                    return;
                }

                const extractedData = await extractorService.extractData(session);

                if (extractedData) {
                    console.log('✅ Extracted Data:');
                    console.log('-------------------');
                    console.log(`   Name: ${extractedData.name || 'Not found'}`);
                    console.log(`   Location: ${extractedData.location || 'Not found'}`);
                    console.log(`   Phone: ${extractedData.phone || 'Not found'}`);
                    console.log(`   Path: ${extractedData.path || 'Not detected'}`);
                    console.log(`   Interest: ${extractedData.interest || 'Not found'}`);
                    console.log(`   Budget: ${extractedData.budget || 'Not found'}`);
                    console.log(`   Budget Tier: ${extractedData.budget_tier || 'Not found'}`);
                    console.log(`   Occupation: ${extractedData.occupation || 'Not found'}`);
                    console.log(`   Experience: ${extractedData.experience_level || 'Not found'}`);
                    console.log(`   Wants Call: ${extractedData.wants_call}`);
                    console.log(`   Ready to Pay: ${extractedData.ready_to_pay}`);
                    console.log(`   Bot Score: ${extractedData.bot_score}/100`);
                    console.log(`   AI Context: ${extractedData.ai_context || 'N/A'}`);
                    console.log('-------------------\n');
                } else {
                    console.log('❌ Failed to extract data.\n');
                }
            } catch (error: any) {
                console.log('❌ Extraction error:', error.message);
                console.log('💡 Make sure OPENAI_API_KEY is set in your .env file\n');
            }
            chat();
            return;
        }

        try {
            console.log('\n⏳ Generating response...\n');

            // Get session
            const session = await sessionService.getSession(TEST_USER_ID);

            // Generate response
            const result = await responderService.generateResponse(message, session);

            // Update session
            await sessionService.updateSession(
                TEST_USER_ID,
                message,
                result.reply,
                result.detectedPath
            );

            // Display response with path info
            console.log(`🤖 Bot: ${result.reply}\n`);

            // Show detected path for testing
            if (result.detectedPath) {
                console.log(`📍 [Detected Path: ${result.detectedPath}]\n`);
            }

            // Show message count
            const updatedSession = await sessionService.getSession(TEST_USER_ID);
            console.log(`📊 [Messages: ${updatedSession.messages.length} | Path: ${updatedSession.currentPath || 'E'}]\n`);

        } catch (error: any) {
            console.error('\n❌ Error:', error.message || error);
            if (error.message?.includes('API key')) {
                console.log('💡 Make sure OPENAI_API_KEY is set in your .env file');
            }
            console.log('');
        }

        chat();
    });
}

// Handle readline close gracefully
rl.on('close', () => {
    process.exit(0);
});

// Start the chat
chat();
