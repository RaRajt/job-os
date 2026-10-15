// Combine scores: read the Brain's answer "FIT: 72 | reason | RED FLAGS: ..." and add it to the rule score.
const jobs = $('Score').all();
const ai = $input.all();
const nAI = $('Top for AI').all().length;   // only the first nAI Score items were sent to the Brain
const today = DateTime.now().setZone('Asia/Kolkata').toFormat('dd-MMM-yyyy');
return jobs.map((s, i) => {
  const j = s.json; const a = (ai[i] && ai[i].json) || {};
  const ans = String(a.output || '');
  const m = ans.match(/FIT:\s*(\d{1,3})/i);
  let fit = '', final = j.rule_score, why;
  if (m && !a.error) {
    fit = Math.min(100, Number(m[1])); final = j.rule_score + fit;
    why = ans.replace(/^[\s\S]*?FIT:\s*\d{1,3}\s*\|?\s*/i, '').trim();
    // Fallback: if the AI left the reason empty ("FIT: 10 | | RED FLAGS: ..."), write a plain one from the score.
    if (/^\|/.test(why) || !why.replace(/\|?\s*RED FLAGS:[\s\S]*$/i, '').trim()) {
      const rf = (why.match(/RED FLAGS:\s*([\s\S]*)$/i) || [])[1] || 'none';
      why = (fit >= 60 ? 'Good fit' : fit >= 35 ? 'Partial fit' : 'Weak fit') + ' (AI gave no reason) | RED FLAGS: ' + rf.trim();
    }
  } else why = i >= nAI ? 'AI skipped (only top ' + nAI + ' are AI-checked)' : 'AI did not answer' + (a.error ? ' (' + String(a.error).slice(0, 80) + ')' : '');
  return { json: { 'Date found': today, Company: j.company, Title: j.title, Location: j.location, 'Job URL': j.url,
    Source: j.source, 'Rule score': j.rule_score, 'AI fit': fit, 'Final score': final,
    'Flags': j.flags, 'Why / red flags': (why + ' || Rules: ' + j.rule_why).slice(0, 4000), Approve: '' } };
}).sort((a, b) => b.json['Final score'] - a.json['Final score']);
