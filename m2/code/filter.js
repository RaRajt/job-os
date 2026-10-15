// ---- Location gate (settings from the "Locations" tab) ----
// location_mode: strict = keep only jobs that are remote in an allowed scope, in an allowed city, or in a relocate region.
//                flexible = keep everything; location only adds points later.
const locRows = $('Read Locations').all().map(i => i.json);
const lt = r => String(r.Type || '').toLowerCase().trim();
const lv = r => String(r.Value || '').toLowerCase().trim();
const modeRow = locRows.find(r => lt(r) === 'location_mode');
const locMode = modeRow && lv(modeRow) === 'flexible' ? 'flexible' : (locRows.length ? (modeRow ? lv(modeRow) || 'strict' : 'strict') : 'flexible');
const listOf = t => locRows.filter(r => lt(r) === t && lv(r)).map(lv);
// Spelling variants. Add more here if a city has two names.
const ALIAS = { bengaluru: ['bangalore', 'bengaluru', 'blr'], bangalore: ['bangalore', 'bengaluru', 'blr'],
  mumbai: ['mumbai', 'bombay'], bombay: ['mumbai', 'bombay'], 'navi mumbai': ['navi mumbai', 'new mumbai'],
  gurgaon: ['gurgaon', 'gurugram'], gurugram: ['gurgaon', 'gurugram'], chennai: ['chennai', 'madras'],
  kolkata: ['kolkata', 'calcutta'], 'new delhi': ['new delhi', 'delhi'], delhi: ['delhi', 'new delhi', 'ncr'],
  worldwide: ['worldwide', 'anywhere', 'global', 'globally'], anywhere: ['worldwide', 'anywhere', 'global', 'globally'],
  usa: ['usa', 'us', 'u s', 'united states', 'america'], us: ['usa', 'us', 'u s', 'united states'],
  uk: ['uk', 'united kingdom', 'england', 'britain'], uae: ['uae', 'dubai', 'abu dhabi', 'united arab emirates'] };
// Places the gate recognises (so it can tell "somewhere else" from "unclear").
const REGIONS = {
  india: ['india', 'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'navi mumbai', 'pune', 'chennai', 'delhi', 'new delhi', 'gurgaon',
    'gurugram', 'noida', 'kolkata', 'ahmedabad', 'kochi', 'jaipur', 'thane', 'coimbatore', 'indore', 'chandigarh', 'trivandrum', 'ncr'],
  usa: ['usa', 'us', 'u s', 'united states', 'america', 'americas', 'new york', 'nyc', 'san francisco', 'sf', 'seattle', 'austin',
    'boston', 'chicago', 'los angeles', 'denver', 'atlanta', 'california', 'texas', 'washington', 'd c', 'dc', 'pittsburgh', 'miami', 'honolulu', 'hawaii', 'chi', 'atl', 'colorado', 'ca', 'ny', 'wa', 'na', 'north america'],
  canada: ['canada', 'toronto', 'vancouver', 'montreal'], latam: ['latam', 'latin america', 'brazil', 'mexico', 'argentina', 'colombia'],
  europe: ['europe', 'eu', 'emea', 'uk', 'united kingdom', 'london', 'germany', 'berlin', 'france', 'paris', 'spain', 'madrid',
    'netherlands', 'amsterdam', 'ireland', 'dublin', 'poland', 'portugal', 'lisbon', 'israel', 'tel aviv', 'switzerland', 'zurich', 'sweden', 'italy', 'milan', 'rome', 'munich', 'stockholm', 'copenhagen', 'denmark', 'belgium', 'brussels', 'austria', 'vienna', 'romania', 'bucharest', 'czech', 'prague', 'hungary', 'budapest', 'greece', 'athens', 'finland', 'helsinki', 'norway', 'oslo', 'estonia', 'tallinn', 'ukraine', 'serbia', 'belgrade', 'bulgaria', 'sofia', 'croatia', 'lithuania', 'latvia', 'turkey', 'istanbul'],
  apac: ['apac', 'asia', 'asia pacific', 'singapore', 'australia', 'sydney', 'melbourne', 'japan', 'tokyo', 'philippines', 'new zealand', 'korea', 'south korea', 'seoul', 'kr', 'hong kong', 'taiwan', 'indonesia', 'jakarta', 'malaysia', 'vietnam', 'thailand', 'bangkok'],
  mena: ['uae', 'dubai', 'abu dhabi', 'saudi', 'riyadh', 'qatar', 'doha', 'middle east'] };
const lnorm = s => ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
const hasW = (n, w) => n.includes(' ' + w + ' ');
const variants = v => ALIAS[v] || [v];
const regionWords = v => REGIONS[v === 'us' || v === 'united states' ? 'usa' : v] || variants(v);
const okCities = listOf('city'), okScopes = listOf('remote_scope'), okReloc = listOf('relocate_region');
const REMOTE_RX = /\b(remote|work from home|wfh|anywhere|worldwide|distributed|telecommute|home[\s-]based|remote[\s-]first)\b/;
function checkLocation(raw) {
  const n = lnorm(raw), low = String(raw || '').toLowerCase();
  if (!n.trim()) return { pass: true, status: 'location unclear (blank)' };
  // 1) allowed city named anywhere (multi-city posts pass if any city is allowed)
  for (const c of okCities) { const w = variants(c).find(w => hasW(n, w)); if (w) return { pass: true, status: 'city: ' + c }; }
  // 2) relocate regions (e.g. "india" = any Indian city, "usa")
  for (const r of okReloc) { const w = regionWords(r).find(w => hasW(n, w)); if (w) return { pass: true, status: 'relocate: ' + r + ' ("' + w + '")' }; }
  const regions = Object.keys(REGIONS).filter(k => REGIONS[k].some(w => hasW(n, w)));
  const remote = REMOTE_RX.test(low);
  if (remote) {
    const onlyOther = /\bonly\b/.test(low) && !regions.includes('india');
    const scopeOk = s => {
      if (['worldwide', 'anywhere', 'global'].includes(s)) {
        if (/\bonly\b/.test(low)) return false;
        if (variants('worldwide').some(w => hasW(n, w))) return true;
        // plain "Remote" with nothing else: keep (flagged). "Remote - Nigeria" (an unknown place) is not worldwide: drop.
        const rest = n.replace(/\b(remote|home|based|work|from|wfh|first|distributed|telecommute|fully|100|friendly|ok|position|job|role)\b/g, ' ').trim();
        return !regions.length && !rest;
      }
      if (s === 'india') return regions.includes('india');
      // APAC scope: pass India, or a general APAC/Asia remote post; "Australia (Remote)" or "Korea-Remote" is remote inside another country, so it fails.
      if (s === 'apac' || s === 'asia') return regions.includes('india') || (/\b(apac|asia|asia pacific)\b/.test(low) && !onlyOther);
      return regionWords(s).some(w => hasW(n, w));
    };
    const hit = okScopes.find(scopeOk);
    if (hit) return { pass: true, status: 'remote: ' + hit + (regions.length || variants('worldwide').some(w => hasW(n, w)) ? '' : ' (scope not stated - check)') };
    return { pass: false, status: 'remote but limited to ' + (regions.join('/') || 'unknown') };
  }
  // US-style "City, ST" (e.g. "Pittsburgh, PA") = onsite in the USA
  if (!regions.length && /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/.test(String(raw || ''))) regions.push('usa');
  if (regions.length) return { pass: false, status: 'onsite/hybrid outside allowed cities (' + regions.join('/') + ')' };
  // Strict mode: a place we cannot match to an allowed city/scope ("Hybrid", "Onsite", "Office", "Bucharest") is dropped.
  // Only a truly blank location (handled above) or plain "Remote" (handled in the remote branch) stays, flagged for the AI.
  return { pass: false, status: 'no allowed city or remote scope ("' + String(raw).slice(0, 60) + '")' };
}
// Quick filter: keep a job only if (1) it passes the location gate, (2) its title has an "include" word,
// no "exclude" word, and (3) the company is not on the active Blocklist. All matching ignores upper/lower case.
const titles = $('Read Titles').all().map(i => i.json);
const kw = t => String(t.Keyword || '').toLowerCase().trim();
const includes = titles.filter(t => String(t['Type (include/exclude)']).toLowerCase().trim() === 'include' && kw(t))
  .map(t => ({ k: kw(t), p: Number(t.Priority) || 4, family: t.Family }));
const excludes = titles.filter(t => String(t['Type (include/exclude)']).toLowerCase().trim() === 'exclude' && kw(t)).map(kw);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const blocked = $('Read Blocklist').all().map(i => i.json)
  .filter(b => String(b['Active (Y/N)'] || '').trim().toUpperCase() === 'Y').map(b => norm(b.Company)).filter(Boolean);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (text, k) => new RegExp('(^|[^a-z0-9])' + esc(k) + '($|[^a-z0-9])', 'i').test(text);
const out = [];
for (const it of $input.all()) {
  const j = it.json; if (j._empty) continue;
  const loc = checkLocation(j.location);
  if (locMode === 'strict' && !loc.pass) continue;
  const t = String(j.title || '');
  const hits = includes.filter(x => has(t, x.k));
  if (!hits.length) continue;
  if (excludes.some(k => has(t, k))) continue;
  const c = norm(j.company);
  if (blocked.some(b => c === b || c.startsWith(b + ' '))) continue;
  const best = hits.reduce((a, b) => (b.p < a.p ? b : a));
  out.push({ json: { ...j, title_keyword: best.k, title_priority: best.p, title_family: best.family,
    location_status: loc.status, location_mode: locMode } });
}
return out;
