// Score: add points from the Points tab when its words show up in location + description,
// plus a bonus for how important the title family is. Keep jobs at/above the minimum, best first, top N.
const rules = $('Read Points').all().map(i => i.json);
const num = name => { const r = rules.find(x => String(x.Rule || '').toLowerCase().trim() === name); return r ? Number(r.Points) : NaN; };
const min = isNaN(num('minimum score to keep')) ? 40 : num('minimum score to keep');
const max = isNaN(num('max jobs per run')) ? 30 : num('max jobs per run');
const wordRules = rules.filter(r => String(r['Words the rules look for'] || '').trim() && !isNaN(Number(r.Points)))
  .map(r => ({ rule: r.Rule, pts: Number(r.Points),
    words: String(r['Words the rules look for']).toLowerCase().split(';').map(w => w.trim()).filter(Boolean) }));
const bonus = { 1: 40, 2: 35, 3: 30, 4: 25 };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (text, w) => new RegExp('(^|[^a-z0-9])' + esc(w) + '($|[^a-z0-9])').test(text); // whole word ("jd" not in "jdk")
const out = [];
for (const it of $input.all()) {
  const j = it.json;
  const text = (String(j.location || '') + ' ' + String(j.description || '')).toLowerCase().replace(/\s+/g, ' ');
  // Location points only look at the location field (not the description), so a stray "India" in the text
  // cannot push a job up. The location gate in Quick filter already decided if the place is OK.
  const locText = String(j.location || '').toLowerCase().replace(/\s+/g, ' ');
  let score = bonus[j.title_priority] || 25; const why = ['Title "' + j.title_keyword + '" (P' + j.title_priority + ') +' + score];
  // Location rules compete: only the single best location match counts (no double-counting "anywhere").
  const isLoc = r => /remote|mumbai|dubai|india|location|city|onsite|hybrid/i.test(String(r.rule));
  let bestLoc = null;
  for (const r of wordRules) {
    const w = r.words.find(w => has(isLoc(r) ? locText : text, w)); if (!w) continue;
    if (isLoc(r)) { if (!bestLoc || r.pts > bestLoc.pts) bestLoc = { ...r, w }; }
    else { score += r.pts; why.push(r.rule + ' +' + r.pts + ' ("' + w + '")'); }
  }
  // Generic remote boards (Himalayas/Remotive) mark most jobs "Anywhere"; cap that bonus at +15 so the AI checks
  // go mainly to jobs from your target companies. India-remote wording still gets its full points.
  if (bestLoc && /^(himalayas|remotive)$/i.test(String(j.source || '')) && /anywhere|worldwide|global/.test(bestLoc.w) && bestLoc.pts > 15) {
    bestLoc = { ...bestLoc, pts: 15, rule: bestLoc.rule + ' (remote board, capped)' };
  }
  if (bestLoc) { score += bestLoc.pts; why.push(bestLoc.rule + ' +' + bestLoc.pts + ' ("' + bestLoc.w + '")'); }
  const flags = [];
  if (/unclear|not stated/.test(String(j.location_status || ''))) flags.push('location unclear');
  if (/\$\s?\d|\busd\b/.test(text)) flags.push('USD');
  if (/\bvisa\b|sponsor/.test(text)) flags.push('visa');
  // "India office" only when this job itself points to India: the location names India/an Indian city,
  // or the job text says the company has an office/team/entity in India or an Indian city.
  const IN_CITY = 'india|bangalore|bengaluru|hyderabad|mumbai|pune|chennai|gurgaon|gurugram|noida|new delhi|delhi|kolkata|ahmedabad';
  const inLoc = new RegExp('\\b(' + IN_CITY + ')\\b', 'i').test(String(j.location || ''));
  const inText = new RegExp('\\b(office|offices|hub|team|teams|entity|centre|center|campus|site)s?\\b[^.]{0,40}\\b(in|at|across)\\b[^.]{0,30}\\b(' + IN_CITY + ')\\b|\\b(' + IN_CITY + ')\\b[^.]{0,15}\\b(office|offices|hub|entity|centre|center|campus)\\b', 'i').test(String(j.description || ''));
  if (inLoc || inText) flags.push('India office');
  out.push({ json: { ...j, rule_score: score, rule_why: why.join('; '), flags: flags.join(', ') } });
}
// Keep the best jobs, but let the big remote boards (Himalayas/Remotive) fill at most 1/3 of the slots,
// so jobs from your own Companies list (Canonical, Zinnia, Cursor...) are not pushed out by many generic "Anywhere" posts.
const kept = out.filter(o => o.json.rule_score >= min).sort((a, b) => b.json.rule_score - a.json.rule_score);
const boardCap = Math.ceil(max / 3); let nBoard = 0; const res = [];
for (const o of kept) {
  if (res.length >= max) break;
  const isBoard = /^(himalayas|remotive)$/i.test(String(o.json.source || ''));
  if (isBoard) { if (nBoard >= boardCap) continue; nBoard++; }
  res.push(o);
}
return res;
