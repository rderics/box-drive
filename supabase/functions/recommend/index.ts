// recommend: the DRIVER ADVICE agent. The engine (same engine.js as the app, pinned to a commit) computes every number \u2014 score, what each
// change would add, the illustrative premium effect. Gemini only writes the human wording around those numbers and may not invent any:
// text containing digits is rejected and replaced by a template sentence. No GEMINI_API_KEY (or any error / cap) -> template advice, same shape.
// POST { subject_type: 'driver'|'car', id, lang: 'lv'|'en' }  ->  { source, model, total, band, eur_now, eur_best, summary, encouragement, actions[] }
// Access: only synthetic demo + simulator data, or the signed-in owner (Authorization: Bearer <user JWT>) for their own phone data. Cars: insurer-style aggregate.
import { createClient } from "npm:@supabase/supabase-js@2";
import "https://cdn.jsdelivr.net/gh/rderics/box-drive@4c82d8f8a6a5d8697659bba840113ce0b451ff60/engine.js";
const E = (globalThis as any).Engine;
const PARAMS_VERSION = "engine@4c82d8f";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const HOURLY_CAP = 60;
const JEV_MODEL = Deno.env.get("JEV_MODEL") ?? "jev-1.13.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
const FACTORS = ["speeding", "smooth", "phone", "nightfatigue"];

// Jev (TypeSafe AI "System One" model): NOT a text generator. It answers typed questions about a text state and returns calibrated confidence.
// Here it does the DATA ANALYSIS step: which habit should this driver change first, and how risky does the pattern look. The engine's numbers stay authoritative.
// The Jev API key lives in the Cloudflare Pages project (TYPESAFE_API_KEY); this function calls the Pages Function /api/jev, which builds the Jev request from validated numbers.
const JEV_URL = Deno.env.get("JEV_URL") ?? "https://octa-xun.pages.dev/api/jev";
async function jev(facts: any, wi: any[]): Promise<{ start_here: string; start_conf: number; risk_score: number | null; risk_conf: number | null; model: string } | null> {
  if (!wi.length) return null;
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(JEV_URL, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal, body: JSON.stringify({ km: facts.km, trips: facts.trips, score: facts.score, now: facts.now, factors: wi.map((x: any) => x.key) }) });
    if (!r.ok) throw new Error("jev endpoint " + r.status);
    const j = await r.json();
    return j && typeof j.start_here === "string" ? j : null;
  } finally { clearTimeout(to); }
}

const T: Record<string, Record<string, Record<string, string>>> = {
  lv: {
    speeding: { title: "Brauc mier\u012bg\u0101k par at\u013cauto", tip: "Pieturies pie at\u013caut\u0101 \u0101truma, \u012bpa\u0161i slapj\u0101 laik\u0101, migl\u0101 un uz sniega \u2014 tur dro\u0161s \u0101trums ir zem\u0101ks par nor\u0101d\u012bto. Iesl\u0113dz kru\u012bza kontroli vai \u0101truma ierobe\u017eot\u0101ju, ja auto to \u013cauj.", why: "\u0100trums ir liel\u0101kais atsevi\u0161\u0137ais faktors smagos negad\u012bjumos Latvij\u0101, t\u0101p\u0113c tas r\u0113\u0137in\u0101s visvair\u0101k." },
    smooth: { title: "Bremz\u0113 un s\u0101c kust\u012bbu vienm\u0113r\u012bg\u0101k", tip: "Skaties t\u0101l\u0101k uz priek\u0161u un no\u0146em k\u0101ju no g\u0101zes savlaic\u012bgi, lai nevajadz\u0113tu strauji bremz\u0113t. Pagriezienos samazini \u0101trumu pirms ieejas, nevis taj\u0101.", why: "Reti strauji manevri liecina par mier\u012bgu, paredzamu brauk\u0161anu." },
    phone: { title: "Ne\u0146em telefonu rok\u0101s braucot", tip: "Pirms brauciena ieliec telefonu tur\u0113t\u0101j\u0101 un uzst\u0101di mar\u0161rutu; zvanus pie\u0146em tikai ar br\u012bvroku.", why: "Telefona tur\u0113\u0161ana rok\u0101 aiz\u0146em uzman\u012bbu tie\u0161i tad, kad vajag rea\u0123\u0113t." },
    nightfatigue: { title: "Pl\u0101no nakts un garos braucienus", tip: "P\u0113c div\u0101m stund\u0101m brauk\u0161anas ieliec piecpadsmit min\u016b\u0161u pauzi un, ja iesp\u0113jams, p\u0101rvieto garos braucienus uz dienas laiku.", why: "Nogurums un tumsa ir reti, bet smagi negad\u012bjumu c\u0113lo\u0146i." },
  },
  en: {
    speeding: { title: "Drive a little under the limit", tip: "Stay at or under the limit, and lower still in rain, fog or snow, where a safe speed is below the posted one. Use cruise control or a speed limiter if your car has one.", why: "Speed is the biggest single factor in severe crashes in Latvia, so it counts the most." },
    smooth: { title: "Brake and accelerate more smoothly", tip: "Look further ahead and lift off the throttle early so you do not need to brake hard. Slow down before a corner, not in it.", why: "Few harsh manoeuvres show calm, predictable driving." },
    phone: { title: "Keep the phone out of your hand", tip: "Put the phone in a holder and set the route before you start; take calls hands-free only.", why: "Handling the phone takes your attention exactly when you need to react." },
    nightfatigue: { title: "Plan night and very long drives", tip: "Take a fifteen-minute break after two hours at the wheel and, if you can, move long trips to daytime.", why: "Fatigue and darkness are rare but severe crash causes." },
  },
};
const SUMMARY = {
  lv: (b: string) => b === "low" ? "Tava brauk\u0161ana jau ir dro\u0161a. Ar da\u017eiem s\u012bkumiem vari v\u0113l uzlabot r\u0101d\u012bt\u0101ju." : b === "medium" ? "Brauk\u0161ana ir pie\u0146emama, bet ir vietas, kur vari viegli uzlabot r\u0101d\u012bt\u0101ju un samazin\u0101t OCTA cenu." : "Ir da\u017ei paradumi, kurus mainot r\u0101d\u012bt\u0101js un OCTA cena var uzlaboties iev\u0113rojami.",
  en: (b: string) => b === "low" ? "Your driving is already safe. A few small things could still lift your score." : b === "medium" ? "Your driving is fine, but there are easy wins that would raise your score and lower your OCTA price." : "A few habits are holding your score back; changing them could improve your score and OCTA price noticeably.",
};
const ENCOURAGE = { lv: "Mazi so\u013ci tie\u0161\u0101m str\u0101d\u0101 \u2014 katru ned\u0113\u013cu r\u0101d\u012bt\u0101js atjaunojas.", en: "Small steps really work, and your score refreshes every week." };

async function all(q: (a: number, b: number) => any) { const out: any[] = []; for (let from = 0; ; from += 1000) { const { data, error } = await q(from, from + 999); if (error) throw new Error(error.message); out.push(...data); if (data.length < 1000) return out; } }
const COLS = "id,driver_id,car_id,start_at,counted,weather,duration_s,km,dark_km,brake,accel,corner,over_lim_s,over_safe_s,severe_s,phone_ev,phone_s,parkings,lot_cycles,lot_s,lot_over_s,surge,bump,role_conf,mode,source";
const mapTrip = (t: any) => ({ id: t.id, startISO: new Date(t.start_at).toISOString(), mode: t.mode, roleConf: t.role_conf, counted: t.counted, weather: t.weather, durationS: t.duration_s, km: t.km, darkKm: t.dark_km, brake: t.brake, accel: t.accel, corner: t.corner, overLimS: t.over_lim_s, overSafeS: t.over_safe_s, severeS: t.severe_s, phoneEv: t.phone_ev, phoneS: t.phone_s, parkings: t.parkings, lotCycles: t.lot_cycles, lotS: t.lot_s, lotOverS: t.lot_over_s, surge: t.surge, bump: t.bump });

async function gemini(facts: any, lang: string): Promise<{ summary: string; encouragement: string; actions: { factor: string; title: string; tip: string; why: string }[] } | null> {
  const key = Deno.env.get("GEMINI_API_KEY"); if (!key) return null;
  const sys = `You are a friendly, concrete driving coach inside an insurance telematics demo (Latvian OCTA). Write in ${lang === "lv" ? "Latvian" : "English"}. ` +
    `Rules: (1) never write any digit or number \u2014 numbers are added by the system; spell small numbers as words if needed; (2) use only the factors given; (3) every tip must be a concrete behaviour the driver can change; ` +
    `(4) never mention fines, never judge the person, never promise a price; (5) keep each title under eight words, each tip and why under thirty words; (6) the summary is two short sentences.`;
  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: "user", parts: [{ text: "Facts (computed by the engine, do not repeat the numbers):\n" + JSON.stringify(facts) + "\nWrite one action per factor in the same order." }] }],
    generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: { type: "OBJECT", required: ["summary", "encouragement", "actions"], properties: { summary: { type: "STRING" }, encouragement: { type: "STRING" }, actions: { type: "ARRAY", items: { type: "OBJECT", required: ["factor", "title", "tip", "why"], properties: { factor: { type: "STRING", enum: FACTORS }, title: { type: "STRING" }, tip: { type: "STRING" }, why: { type: "STRING" } } } } } } },
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("gemini " + r.status);
  const j = await r.json(), txt = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  return txt ? JSON.parse(txt) : null;
}
const clean = (s: unknown, fb: string) => (typeof s === "string" && s.trim().length > 3 && s.length < 400 && !/\d/.test(s) ? s.trim() : fb);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const b = await req.json().catch(() => null);
  const type = b?.subject_type === "car" ? "car" : "driver", id = String(b?.id ?? "").slice(0, 80), lang = b?.lang === "en" ? "en" : "lv";
  if (!id) return json({ error: "body must be { subject_type, id, lang }" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // who may see what: public = synthetic + simulator only; the signed-in owner also gets their own phone trips
  let ownerDriver: string | null = null;
  const auth = req.headers.get("Authorization") ?? "";
  if (/^Bearer ey/i.test(auth)) { const { data: u } = await admin.auth.getUser(auth.replace(/^Bearer /i, "")); if (u?.user) { const { data: d } = await admin.from("drivers").select("id").eq("user_id", u.user.id).maybeSingle(); ownerDriver = d?.id ?? null; } }
  const allowPhone = type === "driver" && ownerDriver === id;

  try {
    let trips: any[], profile: any;
    if (type === "driver") {
      const { data: d } = await admin.from("drivers").select("id,exp_hours,exp_buckets,claims_3y").eq("id", id).maybeSingle();
      if (!d) return json({ error: "unknown driver" }, 404);
      trips = await all((a, z) => admin.from("trips").select(COLS).eq("driver_id", id).order("id").range(a, z));
      profile = { claims3y: d.claims_3y, expHours: Number(d.exp_hours ?? 0), expBuckets: d.exp_buckets ?? {} };
    } else {
      const { data: c } = await admin.from("cars").select("id,claims_3y").eq("id", id).maybeSingle();
      if (!c) return json({ error: "unknown car" }, 404);
      trips = await all((a, z) => admin.from("trips").select(COLS).eq("car_id", id).order("id").range(a, z));
      const ids = [...new Set(trips.map((t) => t.driver_id))];
      const { data: ds } = ids.length ? await admin.from("drivers").select("id,exp_hours,exp_buckets").in("id", ids) : { data: [] as any[] };
      const kmBy: Record<string, number> = {}; for (const t of trips) if (t.counted) kmBy[t.driver_id] = (kmBy[t.driver_id] ?? 0) + Number(t.km);
      const tot2 = Object.values(kmBy).reduce((x, y) => x + y, 0) || 1, wm = (f: (d: any) => number) => Object.entries(kmBy).reduce((s, [did, km]) => s + f((ds ?? []).find((x: any) => x.id === did) ?? {}) * km / tot2, 0);
      profile = { claims3y: c.claims_3y, expHours: wm((d) => Number(d.exp_hours ?? 0)), expBuckets: Object.fromEntries(E.P.expBuckets.map((k: string) => [k, wm((d) => Number((d.exp_buckets ?? {})[k] ?? 0))])) };
    }
    if (!allowPhone) trips = trips.filter((t) => t.source === "synthetic" || t.source === "simulator");
    if (!trips.length) return json({ error: "no trips available for this subject" }, 404);

    const res = E.scoreDriver(trips.map(mapTrip), profile), wi = E.whatIf(res), pr = E.premiumPreview(res.total), k = res.kpi;
    const best = wi.length ? E.premiumPreview(Math.min(100, res.total + wi.reduce((s: number, x: any) => s + x.gainPoints, 0))) : pr;
    const facts = {
      score: res.total, band: res.band, km: k.km, trips: k.trips,
      now: { overSafePct: +k.overSafePct.toFixed(1), harshPer100km: +k.harshPer100.toFixed(2), phonePerHour: +k.phonePerHour.toFixed(2), nightSharePct: +(k.nightShare * 100).toFixed(0), longDrivesWithoutBreak: k.fatigue },
      actions: wi.map((x: any) => ({ factor: x.key, gainPoints: x.gainPoints, savingEuroPerYearIllustrative: x.savingEur })),
    };
    const base = { total: res.total, band: res.band, uncertainty: res.sigma, eur_now: pr.eur, eur_best: best.eur, base_eur: pr.base, params_version: PARAMS_VERSION, illustrative: true };

    let jv: any = null;
    // template answer (also the fallback)
    const tmpl = (note: string) => ({
      ...base, source: "template", note, jev: jv, model: null, summary: SUMMARY[lang](res.band), encouragement: ENCOURAGE[lang],
      actions: wi.map((x: any) => ({ factor: x.key, ...T[lang][x.key], gainPoints: x.gainPoints, savingEur: x.savingEur, scoreNow: x.scoreNow, scoreTarget: x.scoreTarget })),
    });
    if (!wi.length) return json({ ...tmpl("nothing to improve"), summary: lang === "lv" ? "\u0160obr\u012bd nav ko uzlabot \u2014 turpini t\u0101pat." : "Nothing to improve right now \u2014 keep going." });

    const key = await sha256(JSON.stringify([facts, lang, MODEL, PARAMS_VERSION, !!Deno.env.get("GEMINI_API_KEY"), true]));
    const { data: hit } = await admin.from("ai_cache").select("response,created_at").eq("key", key).maybeSingle();
    if (hit && Date.now() - Date.parse(hit.created_at) < 864e5) return json({ ...hit.response, cached: true });

    // step 1: Jev analyses the data (which habit first, how risky); a confident pick is moved to the top, otherwise the engine's order (biggest gain) stays
    try { jv = await jev(facts, wi); if (jv) await admin.from("ai_calls").insert({ ok: true, note: "jev" }); } catch (e) { jv = null; await admin.from("ai_calls").insert({ ok: false, note: "jev: " + String((e as Error).message).slice(0, 100) }); }
    if (jv && jv.start_conf >= 0.6) { const i = wi.findIndex((x: any) => x.key === jv.start_here); if (i > 0) wi.unshift(...wi.splice(i, 1)); }
    (facts as any).actions = wi.map((x: any) => ({ factor: x.key, gainPoints: x.gainPoints, savingEuroPerYearIllustrative: x.savingEur }));
    if (jv) (facts as any).analysis = { firstHabit: jv.start_here, riskLevelZeroToTwo: jv.risk_score };
    if (!Deno.env.get("GEMINI_API_KEY")) { const o = tmpl("GEMINI_API_KEY not set"); if (jv) await admin.from("ai_cache").upsert({ key, subject_type: type, subject_id: id, lang, response: o }); return json(o); }
    const { count } = await admin.from("ai_calls").select("id", { count: "exact", head: true }).gte("at", new Date(Date.now() - 36e5).toISOString());
    if ((count ?? 0) >= HOURLY_CAP) return json(tmpl("hourly AI cap reached"));

    let out: any = null;
    try {
      const g = await gemini(facts, lang);
      await admin.from("ai_calls").insert({ ok: !!g });
      if (g) {
        const tm = tmpl("");
        const acts = wi.map((x: any) => { const m = (g.actions ?? []).find((a) => a.factor === x.key), f = T[lang][x.key]; return { factor: x.key, title: clean(m?.title, f.title), tip: clean(m?.tip, f.tip), why: clean(m?.why, f.why), gainPoints: x.gainPoints, savingEur: x.savingEur, scoreNow: x.scoreNow, scoreTarget: x.scoreTarget }; });
        out = { ...base, jev: jv, source: "gemini", model: MODEL, summary: clean(g.summary, tm.summary), encouragement: clean(g.encouragement, tm.encouragement), actions: acts };
      }
    } catch (e) { await admin.from("ai_calls").insert({ ok: false, note: String((e as Error).message).slice(0, 120) }); return json(tmpl("gemini error: " + String((e as Error).message).slice(0, 60))); }
    if (!out) return json(tmpl("empty gemini answer"));
    await admin.from("ai_cache").upsert({ key, subject_type: type, subject_id: id, lang, response: out });
    return json(out);
  } catch (e) { return json({ error: String((e as Error).message ?? e) }, 500); }
});
