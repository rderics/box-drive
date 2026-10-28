/* Sign-up / login for the prototype (Supabase Auth). Passwords are sent over HTTPS to Supabase Auth and kept there only as a bcrypt hash;
 * this page keeps just the session tokens in localStorage. Sign-up goes through the `account` Edge Function (creates the user, driver profile and consent).
 *   Auth.signup({email,password,name,consent}) / Auth.login(email,password) / Auth.logout() / Auth.token() -> Promise<string|null> / Auth.user() */
(function (root) {
  'use strict';
  const URL = 'https://qjakepgeqioqrmsufaty.supabase.co', KEY = 'sb_publishable_NzsKaKSt1Nc-cuuJADWySQ_kLekErYS', SK = 'octa_session';
  const get = () => { try { return JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { return null; } };
  const RK = 'octa_remember';   // "remember this device": every account signed in on this device (by e-mail); the e-ID simulation signs back in from it
  const rmap = () => { try { const m = JSON.parse(localStorage.getItem(RK) || 'null'); if (m && m.byEmail) return m; if (m && m.email) return { byEmail: { [m.email]: m } }; } catch (e) {} return { byEmail: {} }; };
  const put = (s) => { try { if (s) { localStorage.setItem(SK, JSON.stringify(s)); const m = rmap(); if (s.email) m.byEmail[s.email] = s; localStorage.setItem(RK, JSON.stringify(m)); } else localStorage.removeItem(SK); } catch (e) {} };
  const jf = (path, body, extra) => fetch(URL + path, { method: 'POST', headers: Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, extra || {}), body: JSON.stringify(body) })
    .then((r) => r.json().then((j) => ({ s: r.status, j })));
  const fromGrant = (j) => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 - 30000, email: j.user && j.user.email, uid: j.user && j.user.id, name: j.user && j.user.user_metadata && j.user.user_metadata.name });

  async function login(email, password) {
    const r = await jf('/auth/v1/token?grant_type=password', { email: String(email).trim().toLowerCase(), password });
    if (r.s !== 200 || !r.j.access_token) throw new Error(r.j.error_code === 'invalid_credentials' ? 'invalid_credentials' : (r.j.error_code || r.j.msg || 'login_failed'));
    const s = fromGrant(r.j); put(s); return s;
  }
  async function signup(o) {
    const r = await jf('/functions/v1/account', { email: o.email, password: o.password, name: o.name, consent: o.consent === true }, { Authorization: 'Bearer ' + KEY });
    if (r.s !== 200 || !r.j.ok) throw new Error(r.j.error || 'signup_failed');
    return login(o.email, o.password);
  }
  async function token() {
    let s = get(); if (!s) return null;
    if (Date.now() < s.expires_at) return s.access_token;
    const r = await jf('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    if (r.s !== 200 || !r.j.access_token) { put(null); return null; }
    s = fromGrant(r.j); put(s); return s.access_token;
  }
  const logout = () => put(null);
  const remembered = () => Object.values(rmap().byEmail);              // sessions of every account used on this device
  const forget = () => { try { localStorage.removeItem(SK); localStorage.removeItem(RK); } catch (e) {} };
  /* e-ID (simulated): restores the session this device already had for that account (refresh token): no password typed, nothing public */
  async function eid(email) {
    const m = rmap(), r = m.byEmail[email]; if (!r || !r.refresh_token) throw new Error('no_remembered');
    const t = await jf('/auth/v1/token?grant_type=refresh_token', { refresh_token: r.refresh_token });
    if (t.s !== 200 || !t.j.access_token) { delete m.byEmail[email]; try { localStorage.setItem(RK, JSON.stringify(m)); } catch (e) {} throw new Error('expired'); }
    const g = fromGrant(t.j); put(g); return g;
  }
  const api = { URL, KEY, signup, login, logout, token, user: get, remembered, forget, eid };
  root.Auth = api;
})(typeof self !== 'undefined' ? self : this);
