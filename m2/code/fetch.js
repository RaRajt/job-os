// Fetch jobs: ask each company's public job board (ATS) + 2 free remote boards for open jobs.
// One failing source never stops the run (try/catch per source).
const companies = $('Read Companies').all().map(i => i.json)
  .filter(c => String(c['Active (Y/N)'] || '').trim().toUpperCase() === 'Y' && String(c['Board slug'] || '').trim());
const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const get = async (url) => {
  const r = await this.helpers.httpRequest({ url, method: 'GET', json: true, timeout: 25000,
    headers: { 'User-Agent': 'Mozilla/5.0 job-search-bot', Accept: 'application/json' } });
  return typeof r === 'string' ? JSON.parse(r) : r;
};
const jobs = [], log = [];
for (const c of companies) {
  const sys = String(c['Job system'] || '').toLowerCase().trim();
  const slug = encodeURIComponent(String(c['Board slug']).trim());
  const name = String(c.Company || '').trim();
  const add = (title, location, url, description, posted) =>
    jobs.push({ company: name, title: strip(title), location: strip(location), url: String(url || ''),
                source: c['Job system'], description: strip(description), posted: posted || '', why_fit: c['Why fit'] || '' });
  try {
    if (sys === 'greenhouse') {
      const d = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      for (const j of d.jobs || []) add(j.title, j.location && j.location.name, j.absolute_url, strip(j.content), j.updated_at);
    } else if (sys === 'lever') {
      const d = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      for (const j of d || []) add(j.text, (j.categories && (j.categories.allLocations || [j.categories.location]).join('; ')) + (j.workplaceType ? ' (' + j.workplaceType + ')' : ''),
        j.hostedUrl, (j.descriptionPlain || '') + ' ' + (j.additionalPlain || '') + ' ' + (j.lists || []).map(l => l.text + ' ' + strip(l.content)).join(' '), j.createdAt ? new Date(j.createdAt).toISOString() : '');
    } else if (sys === 'ashby') {
      const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
      for (const j of d.jobs || []) add(j.title, [j.location, ...(j.secondaryLocations || []).map(s => s.location)].filter(Boolean).join('; ') + (j.isRemote ? ' (Remote)' : ''),
        j.jobUrl, (j.descriptionPlain || strip(j.descriptionHtml)) + ' ' + ((j.compensation && j.compensation.compensationTierSummary) || ''), j.publishedAt);
    } else if (sys === 'smartrecruiters') {
      const d = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
      for (const j of d.content || []) { const l = j.location || {};
        add(j.name, [l.city, l.region, l.country].filter(Boolean).join(', ') + (l.remote ? ' (Remote)' : ''),
          `https://jobs.smartrecruiters.com/${slug}/${j.id}`, '', j.releasedDate); }   // list API has no description
    } else if (sys === 'workable') {
      const d = await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}`);
      for (const j of d.jobs || []) add(j.title, [j.city, j.state, j.country].filter(Boolean).join(', ') + (j.telecommuting ? ' (Remote)' : ''), j.url || j.shortlink, '', j.published_on);
    } else { log.push(name + ': job system "' + c['Job system'] + '" not supported'); continue; }
    log.push(name + ': ok');
  } catch (e) { log.push(name + ': FAILED ' + (e.message || e).toString().slice(0, 120)); }
}
// Free remote boards
try {
  const d = await get('https://remotive.com/api/remote-jobs');
  for (const j of d.jobs || []) jobs.push({ company: j.company_name, title: j.title, location: 'Remote - ' + (j.candidate_required_location || 'Worldwide'),   // remote-only board: "India" here means remote from India
    url: j.url, source: 'Remotive', description: strip(j.description) + ' ' + (j.salary || ''), posted: j.publication_date, why_fit: '' });
  log.push('Remotive: ok');
} catch (e) { log.push('Remotive: FAILED ' + e.message); }
// Himalayas "no country limit" jobs often still demand certain time zones (e.g. US hours). India is UTC+5.5:
// if a time-zone list is given and does not include India, write that into the location so the gate drops it.
const himaLoc = j => {
  const loc = (j.locationRestrictions || []).join('; ');
  if (loc) return 'Remote - ' + loc;
  const tz = (j.timezoneRestrictions || []).map(Number);
  if (tz.length && !tz.some(z => z >= 4.5 && z <= 6.5)) return 'Remote - time zones UTC' + Math.min(...tz) + '..UTC' + Math.max(...tz) + ' only';
  return 'Remote - Anywhere';
};
// Himalayas: the general feed gives only 20 newest jobs, so also search remote jobs open to India for our main title words.
const hima = ['https://himalayas.app/jobs/api?limit=100'];
for (const q of ['program manager', 'project manager', 'localization', 'AI governance', 'delivery manager'])
  hima.push('https://himalayas.app/jobs/api/search?country=India&q=' + encodeURIComponent(q));
for (const hu of hima) try {
  const d = await get(hu);
  for (const j of d.jobs || []) jobs.push({ company: j.companyName, title: j.title,
    location: himaLoc(j), url: j.applicationLink || j.guid, source: 'Himalayas',
    description: strip(j.description || j.excerpt) + (j.minSalary ? ` salary ${j.minSalary}-${j.maxSalary} ${j.currency || ''}` : ''),
    posted: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : '', why_fit: '' });
  log.push('Himalayas: ok');
} catch (e) { log.push('Himalayas: FAILED ' + e.message); }
if (!jobs.length) return [{ json: { _empty: true, fetch_log: log.join('\n') } }];
return jobs.map((j, i) => ({ json: i === 0 ? { ...j, fetch_log: log.join('\n') } : j }));
