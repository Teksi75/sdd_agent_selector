// Quick probe for OpenAI page structure
const url = 'https://platform.openai.com/docs/pricing';
const r = await fetch(url);
const t = await r.text();
const idx = t.indexOf('gpt-5.5');
console.log('First gpt-5.5 idx:', idx);
if (idx > 0) {
  console.log(t.slice(Math.max(0, idx - 100), idx + 200));
}
// Look for the Astro pricing structure
const astroIdx = t.indexOf('[1,[[0,"gpt-5.5');
console.log('Astro idx:', astroIdx);
if (astroIdx > 0) {
  console.log(t.slice(astroIdx, astroIdx + 500));
}