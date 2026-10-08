import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseCoachVoice, type VoiceOption } from './coach-voice.ts';

const voice = (identifier: string, name: string, language = 'en-US', quality = 'Default'): VoiceOption =>
  ({ identifier, name, language, quality });

test('premium beats enhanced beats compact', () => {
  const chosen = chooseCoachVoice([
    voice('com.apple.voice.compact.en-US.Samantha', 'Samantha'),
    voice('com.apple.voice.enhanced.en-US.Evan', 'Evan', 'en-US', 'Enhanced'),
    voice('com.apple.voice.premium.en-US.Zoe', 'Zoe', 'en-US', 'Enhanced'),
  ]);
  assert.deepEqual(chosen, { identifier: 'com.apple.voice.premium.en-US.Zoe', name: 'Zoe', tier: 'premium' });
});

test('robotic Eloquence and novelty voices are never chosen', () => {
  const chosen = chooseCoachVoice([
    voice('com.apple.eloquence.en-US.Eddy', 'Eddy', 'en-US', 'Enhanced'),
    voice('com.apple.speech.synthesis.voice.Bubbles', 'Bubbles', 'en-US', 'Enhanced'),
    voice('com.apple.voice.compact.en-US.Samantha', 'Samantha'),
  ]);
  assert.equal(chosen?.name, 'Samantha');
  assert.equal(chosen?.tier, 'standard');
});

test('US English and preferred names break ties; other languages are ignored', () => {
  const chosen = chooseCoachVoice([
    voice('com.apple.voice.enhanced.en-GB.Serena', 'Serena', 'en-GB', 'Enhanced'),
    voice('com.apple.voice.enhanced.en-US.Tom', 'Tom', 'en-US', 'Enhanced'),
    voice('com.apple.voice.enhanced.en-US.Ava', 'Ava', 'en-US', 'Enhanced'),
    voice('com.apple.voice.premium.es-MX.Paulina', 'Paulina', 'es-MX', 'Enhanced'),
  ]);
  assert.equal(chosen?.name, 'Ava');
  assert.equal(chooseCoachVoice([voice('x', 'Paulina', 'es-MX')]), null);
});
