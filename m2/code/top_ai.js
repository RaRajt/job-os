// Top for AI: the free Gemini tier is slow and rate-limited (503/429), so only the best jobs (by rule score) go to the Brain.
// Change AI_MAX to check more or fewer jobs per run. The rest are still saved, marked "AI skipped".
const AI_MAX = 8;
return $('Score').all().slice(0, AI_MAX).map(i => ({ json: i.json }));
