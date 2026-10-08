export type VoiceOption = { identifier: string; name: string; quality: string; language: string };

/** Natural-sounding US voices, in preference order, when several share a quality tier. */
const PREFERRED_NAMES = ['Ava', 'Zoe', 'Evan', 'Nathan', 'Allison', 'Susan', 'Tom', 'Samantha'];

function tier(voice: VoiceOption) {
  const id = voice.identifier.toLowerCase();
  if (id.includes('.premium.')) return 3;
  if (id.includes('.enhanced.') || voice.quality === 'Enhanced') return 2;
  return 1;
}

/** Eloquence and novelty voices are deliberately robotic; never coach with them. */
function isNovelty(voice: VoiceOption) {
  const id = voice.identifier.toLowerCase();
  return id.includes('eloquence') || id.includes('speech.synthesis') || id.includes('novelty');
}

export type ChosenVoice = { identifier: string; name: string; tier: 'premium' | 'enhanced' | 'standard' };

/** Best installed English voice: premium, then enhanced, then standard; US English first. */
export function chooseCoachVoice(voices: VoiceOption[]): ChosenVoice | null {
  const candidates = voices.filter((voice) => voice.language.toLowerCase().startsWith('en') && !isNovelty(voice));
  if (candidates.length === 0) return null;
  const nameRank = (voice: VoiceOption) => {
    const index = PREFERRED_NAMES.findIndex((name) => voice.name.startsWith(name));
    return index === -1 ? PREFERRED_NAMES.length : index;
  };
  const best = [...candidates].sort((a, b) =>
    tier(b) - tier(a)
    || Number(b.language === 'en-US') - Number(a.language === 'en-US')
    || nameRank(a) - nameRank(b))[0];
  const level = tier(best);
  return { identifier: best.identifier, name: best.name, tier: level === 3 ? 'premium' : level === 2 ? 'enhanced' : 'standard' };
}
