#!/usr/bin/env node
/**
 * Generate bcrypt hashes for passwords
 * Run: node scripts/generate-hashes.js
 */

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const credentials = {
    VIEWER_ACCESS_CODE: '1913',
    EDITOR_AX_PASSWORD: 'Kj#9mPx$vL2nQw8R',
    EDITOR_SPW_PASSWORD: 'Ht@4bNc&yF7sZd3W',
    EDITOR_VIETH_PASSWORD: 'Xm!6pRv*eJ9qKf5G'
};

async function generateHashes() {
    console.log('Generating bcrypt hashes...\n');

    for (const [key, value] of Object.entries(credentials)) {
        const hash = await bcrypt.hash(value, SALT_ROUNDS);
        console.log(`${key}_HASH=${hash}`);
    }

    console.log('\nCopy these values to your .env file');
}

generateHashes().catch(console.error);
