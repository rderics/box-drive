// Cloudflare Pages Function: POST /api/jev — the DATA-ANALYSIS step of the driver advice, done by Jev (TypeSafe AI "System One" model).
// Jev is not a text generator: it answers typed questions about a text state and returns calibrated confidence. The API key lives ONLY in this
// Pages project's environment (any variable whose name contains JEV or TYPESAFE, e.g. TYPESAFE_API_KEY) and never reaches the browser or the repo.
// The endpoint builds the state itself from validated NUMBERS (no free text is forwarded), so it cannot be used as a general Jev proxy.
// Body: { km, trips, score, now:{overSafePct,harshPer100km,phonePerHour,nightSharePct,longDrivesWithoutBreak}, factors:["speeding","smooth","phone","nightfatigue"] }
// Reply: { start_here, start_conf, risk_score, risk_conf, model }
const WHAT = {
  speeding: 'driving above the safe speed for the conditions',
  smooth: 'harsh braking, acceleration and cornering',
  phone: 'handling the phone while the car is moving',
  nightfatigue: 'night driving and long drives without a break',
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const num = (x, lo, hi) => { const n = Number(x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : null; };

export const onRequestOptions = () => new Response(null, { headers: cors });

export async function onRequestPost({ request, env }) {
  const kn = Object.keys(env).find((n) => /jev|typesafe/i.test(n) && typeof env[n] === 'string' && env[n].length > 10 && !/model/i.test(n)), key = kn ? env[kn] : null;   // any variable named like JEV / TYPESAFE
  if (!key) return out({ error: 'jev_key_missing' }, 503);
  if (Number(request.headers.get('content-length') || 0) > 4000) return out({ error: 'too_large' }, 413);
  let b; try { b = await request.json(); } catch (e) { return out({ error: 'bad_json' }, 400); }
  const n = b && b.now, f = b && Array.isArray(b.factors) ? b.factors.filter((k) => Object.prototype.hasOwnProperty.call(WHAT, k)) : [];
  const v = n && { over: num(n.overSafePct, 0, 100), harsh: num(n.harshPer100km, 0, 1000), phone: num(n.phonePerHour, 0, 1000), night: num(n.nightSharePct, 0, 100), long: num(n.longDrivesWithoutBreak, 0, 10000) };
  const km = num(b && b.km, 0, 1e6), trips = num(b && b.trips, 0, 1e6), score = num(b && b.score, 0, 100);
  if (!v || Object.values(v).some((x) => x === null) || km === null || trips === null || score === null || !f.length) return out({ error: 'invalid_input' }, 400);

  const state = `Telematics summary of one driver over ${km} km and ${trips} trips. Overall score ${score} out of 100. ` +
    `Share of driving time over the safe speed: ${v.over} percent (average driver 6). Harsh events per 100 km: ${v.harsh} (average 1.0). ` +
    `Phone handling per hour of driving: ${v.phone} (average 0.6). Night driving share: ${v.night} percent (average 10). Long drives without a break: ${v.long}.`;
  const criteria = {}; for (const k of f) criteria[k] = `The most realistic first change for this driver is to reduce ${WHAT[k]}`;
  const body = {
    model: env.JEV_MODEL || 'jev-1.13.0', state,
    questions: {
      start_here: { type: 'choice', instructions: 'Which single habit should this driver change first to lower their insurance price most easily?', criteria },
      risk_level: { type: 'score', instructions: 'How risky does this driving pattern look overall?', criteria: ['Low risk, safe habits', 'Moderate risk, some habits to fix', 'High risk, several clearly risky habits'] },
    },
  };
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) return out({ error: 'jev_http_' + r.status }, 502);
    const j = await r.json(), a = (j && j.answers) || {};
    if (!a.start_here || a.start_here.type !== 'choice' || !(a.start_here.choice in criteria)) return out({ error: 'jev_bad_answer' }, 502);
    return out({ start_here: a.start_here.choice, start_conf: Number(a.start_here.confidence || 0), risk_score: a.risk_level ? a.risk_level.score : null, risk_conf: a.risk_level ? a.risk_level.confidence : null, model: j.model || body.model });
  } catch (e) { return out({ error: 'jev_unreachable' }, 502); } finally { clearTimeout(to); }
}
