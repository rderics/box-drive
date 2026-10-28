// Cloudflare Pages Function: POST /api/gemini — writes the driver's advice TEXT with Gemini. The key lives only in this Pages project's environment
// (any variable whose name contains GEMINI, e.g. GEMINI_API_KEY); model: GEMINI_MODEL or gemini-2.5-flash.
// The endpoint builds the prompt itself from validated NUMBERS and factor keys (no free text is forwarded), so it is not a general Gemini proxy.
// Jev decides and ranks (see jev.js and the engine); Gemini only words it. Numbers are attached by the caller, and the caller rejects any text with digits.
// Body: { lang:'lv'|'en', facts:{ score, band, km, trips, now:{...}, actions:[{factor,gainPoints,savingEuroPerYearIllustrative}], analysis?:{firstHabit,riskLevelZeroToTwo} } }
// Reply: { summary, encouragement, actions:[{factor,title,tip,why}], model }
const FACTORS = ['speeding', 'smooth', 'phone', 'nightfatigue'];
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const num = (x, lo, hi) => { const n = Number(x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : null; };
const findKey = (env) => { const k = Object.keys(env).find((n) => /gemini/i.test(n) && /key/i.test(n) && typeof env[n] === 'string' && env[n].length > 10) || Object.keys(env).find((n) => /gemini/i.test(n) && typeof env[n] === 'string' && env[n].length > 20 && !/model/i.test(n)); return k ? env[k] : null; };

export const onRequestOptions = () => new Response(null, { headers: cors });

export async function onRequestPost({ request, env }) {
  const key = findKey(env);
  if (!key) return out({ error: 'gemini_key_missing' }, 503);
  if (Number(request.headers.get('content-length') || 0) > 6000) return out({ error: 'too_large' }, 413);
  let b; try { b = await request.json(); } catch (e) { return out({ error: 'bad_json' }, 400); }
  const lang = b && b.lang === 'en' ? 'en' : 'lv', f = b && b.facts, n = f && f.now;
  const v = n && { over: num(n.overSafePct, 0, 100), harsh: num(n.harshPer100km, 0, 1000), phone: num(n.phonePerHour, 0, 1000), night: num(n.nightSharePct, 0, 100), long: num(n.longDrivesWithoutBreak, 0, 10000) };
  const acts = f && Array.isArray(f.actions) ? f.actions.filter((a) => a && FACTORS.includes(a.factor)).slice(0, 4).map((a) => ({ factor: a.factor, gainPoints: num(a.gainPoints, 0, 100), savingEuroPerYearIllustrative: num(a.savingEuroPerYearIllustrative, 0, 1000) })) : [];
  const score = num(f && f.score, 0, 100), km = num(f && f.km, 0, 1e6), trips = num(f && f.trips, 0, 1e6);
  if (!v || Object.values(v).some((x) => x === null) || score === null || km === null || trips === null || !acts.length) return out({ error: 'invalid_input' }, 400);
  const band = ['low', 'medium', 'high'].includes(f.band) ? f.band : 'medium';
  const first = f.analysis && FACTORS.includes(f.analysis.firstHabit) ? f.analysis.firstHabit : null;

  const sys = `You are a friendly, concrete driving coach inside an insurance telematics demo (Latvian OCTA). Write in ${lang === 'lv' ? 'Latvian' : 'English'}. ` +
    'Rules: (1) never write any digit or number - numbers are added by the system; spell small numbers as words if needed; (2) use only the factors given; (3) every tip must be a concrete behaviour the driver can change; ' +
    '(4) never mention fines, never judge the person, never promise a price; (5) keep each title under eight words, each tip and why under thirty words; (6) the summary is two short sentences; ' +
    '(7) the data analysis model already ranked the habits - keep the given order and, if a first habit is named, present it as the best place to start.';
  const facts = { score, band, km, trips, now: { overSafePct: v.over, harshPer100km: v.harsh, phonePerHour: v.phone, nightSharePct: v.night, longDrivesWithoutBreak: v.long }, actions: acts, firstHabit: first };
  let model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const payload = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: 'Facts (computed by the engine, do not repeat the numbers):\n' + JSON.stringify(facts) + '\nWrite one action per factor in the same order.' }] }],
    generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', required: ['summary', 'encouragement', 'actions'], properties: { summary: { type: 'STRING' }, encouragement: { type: 'STRING' }, actions: { type: 'ARRAY', items: { type: 'OBJECT', required: ['factor', 'title', 'tip', 'why'], properties: { factor: { type: 'STRING', enum: FACTORS }, title: { type: 'STRING' }, tip: { type: 'STRING' }, why: { type: 'STRING' } } } } } } },
  };
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
  const call = (m) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload), signal: ctl.signal });
  // models get renamed/retired or overloaded: ask the API which "flash" models (not lite/image/tts/live) this key can use, newest first,
  // and try up to three of them on 404 / 429 / 5xx
  const list = async () => {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key }, signal: ctl.signal }); if (!r.ok) return [];
    const j = await r.json(), ok = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /^models\/gemini-[\d.]+-flash(-\d+)?$/.test(m.name));
    const ver = (n) => Number((n.match(/gemini-([\d.]+)-flash/) || [0, 0])[1]);
    ok.sort((a, b) => ver(b.name) - ver(a.name)); return ok.map((m) => m.name.replace('models/', ''));
  };
  try {
    let r = await call(model), tried = [model];
    if (r.status === 404 || r.status === 429 || r.status >= 500) {
      for (const alt of await list()) { if (tried.includes(alt) || tried.length >= 3) continue; tried.push(alt); const r2 = await call(alt); if (r2.ok || r2.status === 402 || r2.status === 400 || r2.status === 403) { r = r2; model = alt; break; } r = r2; model = alt; }
    }
    if (!r.ok) { let d = ''; try { const e = await r.json(); d = String((e.error && e.error.message) || '').slice(0, 220); } catch (x) {} return out({ error: 'gemini_http_' + r.status, model, detail: d }, 502); }
    const j = await r.json(), txt = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text;
    if (!txt) return out({ error: 'gemini_empty' }, 502);
    const g = JSON.parse(txt);
    return out({ summary: g.summary, encouragement: g.encouragement, actions: Array.isArray(g.actions) ? g.actions : [], model });
  } catch (e) { return out({ error: 'gemini_unreachable' }, 502); } finally { clearTimeout(to); }
}
