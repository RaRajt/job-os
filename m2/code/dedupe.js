// Duplicate check: drop jobs already in the tracker (main tab or Review), by link or by company+title.
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
// Drop tracking bits (?utm_...) from links, but KEEP job-id params: many boards (Databricks, Stripe) share one page
// like ".../job?gh_jid=123", so cutting the whole "?..." made different jobs look like duplicates.
const nurl = u => {
  const s = String(u || '').trim().toLowerCase(); const [base, q = ''] = s.split('#')[0].split('?');
  const keep = q.split('&').filter(p => /^(gh_jid|jid|job_?id|id|jobid|req(uisition)?_?id)=/.test(p)).sort().join('&');
  return base.replace(/\/+$/, '') + (keep ? '?' + keep : '');
};
const seenUrl = new Set(), seenKey = new Set();
const old = [...$('Read tracker (main)').all(), ...$('Read tracker (Review)').all()].map(i => i.json);
for (const r of old) {
  const u = nurl(r['Job URL']); if (u) seenUrl.add(u);
  const t = r.Title || r['Job Title']; if (r.Company && t) seenKey.add(norm(r.Company) + '|' + norm(t));
}
const out = [];
for (const it of $('Combine scores').all()) {
  const j = it.json; const u = nurl(j['Job URL']); const k = norm(j.Company) + '|' + norm(j.Title);
  if ((u && seenUrl.has(u)) || seenKey.has(k)) continue;
  seenUrl.add(u); seenKey.add(k); out.push({ json: j });   // also stops repeats inside this run
}
return out;
