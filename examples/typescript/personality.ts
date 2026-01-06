/**
 * Personality Example - TypeScript
 *
 * This example shows how to customize Nexi's personality.
 * Run with: npx tsx examples/typescript/personality.ts
 */

import { NexiAPI } from '../../src/api/index.js';

async function main() {
  console.log('🤖 Nexi AI - Personality Example\n');

  // List available presets
  const presets = NexiAPI.getPresets();
  console.log('Available personality presets:', presets.join(', '));
  console.log();

  // Create with a preset
  console.log('--- Using "friendly" preset ---');
  const friendly = await NexiAPI.create({
    personality: 'friendly',
    dataDir: './example-data-friendly',
    logLevel: 'none',
  });

  if (await friendly.isAvailable()) {
    const r1 = await friendly.chat('Hi there!');
    console.log(`Friendly Nexi: ${r1.message}\n`);
  }
  friendly.shutdown();

  // Create with custom personality
  console.log('--- Using custom personality ---');
  const custom = await NexiAPI.create({
    personality: {
      name: 'sarcastic-buddy',
      traits: {
        verbosity: 0.3,      // Brief
        expressiveness: 0.9,  // Very expressive
        playfulness: 0.8,     // Playful
        curiosity: 0.4,       // Not too curious
        warmth: 0.5,          // Neutral warmth
        assertiveness: 0.8,   // Assertive
      },
    },
    dataDir: './example-data-custom',
    logLevel: 'none',
  });

  if (await custom.isAvailable()) {
    const r2 = await custom.chat('What do you think about Mondays?');
    console.log(`Custom Nexi: ${r2.message}\n`);
  }
  custom.shutdown();

  // Change personality mid-conversation
  console.log('--- Changing personality mid-conversation ---');
  const nexi = await NexiAPI.create({
    dataDir: './example-data-switch',
    logLevel: 'none',
  });

  if (await nexi.isAvailable()) {
    console.log('Default personality:');
    const r3 = await nexi.chat('Tell me a joke');
    console.log(`Nexi: ${r3.message}\n`);

    // Switch to analytical
    nexi.setPersonality('analytical');
    console.log('After switching to "analytical":');
    const r4 = await nexi.chat('Explain why that joke is funny');
    console.log(`Nexi: ${r4.message}\n`);
  }
  nexi.shutdown();

  console.log('✨ Done!');
}

main().catch(console.error);
