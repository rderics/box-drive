/* In-app mock-up: the Driver Score add-on inside an app that looks like the LTAB OCTA app. Uses window.App (exported by app.js). */
(function () {
  'use strict';
  const L = {
    lv: {
      time: 'Mani auto', tab_cars: 'Mani auto', tab_drive: 'Braukšana', tab_sp: 'CSNg', tab_more: 'Vairāk', plus_car: 'Pievienot auto',
      reg: 'Reģistrācijas numurs', regcert: 'Reģistrācijas apliecības numurs', octa: 'OCTA derīguma termiņš', hist: 'Negadījumu vēsture', drv_score: 'Braucēja rādītājs', new: 'JAUNS',
      d_title: 'Braukšana', d_lead: 'Tavs braucēja rādītājs pēdējās 4 nedēļās. Dati netiek sūtīti apdrošinātājam bez tavas piekrišanas.',
      d_trend: 'Nedēļu tendence', d_components: 'No kā sastāv rādītājs', d_exp: 'Pieredze pie stūres', d_trips: 'Braucieni', all_ok: 'Viss kārtībā',
      hours_wheel: 'stundas pie stūres', lic: 'tiesības', exp_txt: 'Stundas pie stūres saka vairāk nekā gadi ar tiesībām.', mix: 'Kur esi braucis',
      counted: 'Skaitīts', not_counted: 'Neskaitīts', confirm_me: 'Tas biju es', why_train: 'Vilciens — nav tavs brauciens', why_pass: 'Visticamāk pasažieris',
      reliab: 'Datu ticamība', rel_high: 'augsta', rel_mid: 'vidēja', rel_low: 'zema (maz datu)', km: 'km',
      sp_lead: 'Veiksim secīgi šos vienkāršos soļus, lai aizpildītu saskaņoto paziņojumu (SP)', sp_start: 'Sākt SP aizpildīšanu', sp_try: 'SP izmēģinājums',
      crash_t: 'Automātiska aizpilde', crash_s: 'Ja telefons konstatē triecienu, SP datus aizpildām priekšā. Tu tikai apstiprini.', crash_btn: 'Simulēt triecienu',
      crash_h: 'Iespējams negadījums', crash_q: 'Vai tev viss kārtībā? Mēs jau sagatavojām SP datus.', c_when: 'Laiks', c_where: 'Vieta (aptuveni)', c_speed: 'Ātrums pirms trieciena', c_g: 'Trieciena spēks', c_weather: 'Laikapstākļi',
      c_ok: 'Apstiprināt un turpināt SP', c_no: 'Nebija negadījums', c_note: 'Dati tiek izmantoti tikai pēc tava apstiprinājuma.',
      svc: 'Pakalpojumi', s_car: 'Auto vēsture', s_ins: 'Apdrošināšanas vēsture', s_buy: 'Pirkt apdrošināšanu', drive_set: 'Braukšanas dati', set: 'Iestatījumi',
      auto_detect: 'Automātiska braucienu noteikšana', share_ins: 'Dalīties rādītājā ar apdrošinātāju', on_device: 'Apstrāde telefonā, augšupielādē tikai kopsavilkumus (ES)', del_data: 'Dzēst braukšanas datus',
      notif: 'Paziņojumi', lang: 'Lietotnes valoda', about: 'Par mums', news: 'Industrijas ziņas', contact: 'Sazināties ar mums', ver: 'Lietotnes versija 3.3.0 (prototips)',
      what_t: 'Ko redz žūrija', what: ['Šī ir **papildinājuma cilne “Braukšana”** esošajā OCTA lietotnē — tāda pati vizuālā valoda, tāda pati navigācija.', 'Pārslēdz demo braucēju: mainās rādītājs, ieteikums un pieredze.', 'Atver komponenti vai braucienu — redzi bāzi, kontekstu un datus.', 'Atzīmē braucienu kā “Tas biju es” — rādītājs pārrēķinās.', 'CSNg cilnē: trieciena simulācija aizpilda SP datus.'],
      persona: 'Demo braucējs', views_t: 'Citi skati (prezentācijai)', disc: 'Koncepta papildinājums LTAB OCTA lietotnei — hakatona prototips ar sintētiskiem datiem. Nav oficiāls LTAB produkts; LTAB logotips un materiāli netiek izmantoti.',
      octa_minus: 'OCTA', closer: 'tuvāk atlaidei', save: 'ietaupījums', no_disc_yet: 'Atlaides vēl nav', weekly: 'Nedēļas kopsavilkums', weekly_txt: 'Rādītājs un OCTA cena atjaunota. Nekas nav jādara — atver tikai, ja gribi redzēt, kāpēc.',
      octa_cost: 'Tava OCTA cena (ilustratīvi)', no_score: 'Bez rādītāja', with_score: 'Ar tavu rādītāju', per_year: 'gadā', to_first: 'Vēl {n} punkti līdz pirmajai atlaidei.',
      bg_on: 'Fonā ieslēgts — nekas nav jāspiež', bg_txt: 'Braucienus nosaka automātiski.', bg_last: 'Pēdējais:', why_t: 'Kāpēc šāds rādītājs un ko darīt', save_more: 'Kā ietaupīt vēl', up_to: 'līdz', trips_auto: 'Braucieni tiek noteikti paši. Atzīmē tikai tad, ja kāds brauciens nav tavs.',
      ill_note: 'Cenas un atlaides ir ilustratīvas — nav Balcia vai cita apdrošinātāja cenu modelis.',
      tip_speeding: 'Brauc pie limita vai zem tā; sliktos laikapstākļos vēl lēnāk', tip_phone: 'Nelieto telefonu braucot — ieslēdz braukšanas režīmu', tip_smooth: 'Skaties tālāk uz priekšu, bremzē mīkstāk', tip_night: 'Pēc 2 h dari pauzi; vēlos braucienus pārcel uz dienu',
      ob0_t: 'Samazini OCTA izmaksas, vienkārši braucot', ob0_s: 'Lietotne fonā pati pamana tavus braucienus. Tev nekas nav jāspiež.', ob0_a: 'Automātiski', ob0_as: 'Braucieni tiek noteikti paši', ob0_b: 'Saprotami', ob0_bs: 'Redzi, kāpēc rādītājs ir tāds un kā to uzlabot', ob0_c: 'Ietaupi', ob0_cs: 'Labāka braukšana = zemāka OCTA cena',
      ob1_t: 'Ko mēs mērām', ob1_s: 'Tikai to, kas patiešām ietekmē risku.', ob1_y: 'Mērām', ob1_1: 'Ātrumu pret limitu un laikapstākļiem', ob1_2: 'Strauju bremzēšanu un pagriezienus', ob1_3: 'Telefona lietošanu braucot', ob1_4: 'Nakts braukšanu un garus braucienus bez pauzes', ob1_n: 'Nekad neglabājam', ob1_5: 'Precīzu maršrutu vēsturi', ob1_6: 'Mājas adresi un kontaktus', ob1_7: 'Ziņu vai lietotņu saturu', ob1_note: 'Apstrāde notiek telefonā. Uz serveri (ES) aiziet tikai kopsavilkumi, un tikai ar tavu piekrišanu.',
      ob2_t: 'Pēdējais solis', ob2_s: 'Lai viss strādātu fonā, vajadzīgas šīs atļaujas.', ob2_a: 'Atrašanās vieta', ob2_as: 'Lai noteiktu braucienus (fonā)', ob2_b: 'Kustības sensori', ob2_bs: 'Bremzēšanai un pagriezieniem', ob2_c: 'Paziņojumi', ob2_cs: 'Nedēļas kopsavilkums', ob2_d: 'Dalīties rādītājā ar apdrošinātāju', ob2_ds: 'Lai saņemtu atlaidi. Vari izslēgt jebkurā laikā.', allow: 'Atļaut', ob_next: 'Turpināt', ob_start: 'Sākt',
      onboard_btn: '▶ Pirmā palaišana',
      car_score: 'Auto rādītājs', you_driver: 'Tu kā braucējs', you_lead: 'Šis rādītājs seko tev — neatkarīgi no tā, ar kuru auto brauc. Tas ietekmē auto rādītājus tad, kad tu brauc.', my_cars: 'Tavi auto', cars_n: 'auto', drives: 'Brauc:', you: 'Tu',
      per_car_note: 'OCTA cenu aprēķina pa auto, nevis pa braucēju — tāpēc ir divi rādītāji.', car_lead: 'Auto rādītājs ņem vērā visus, kas ar to brauc, un auto negadījumu vēsturi. Tieši šis rādītājs nosaka OCTA cenu.',
      who_drives: 'Kas brauc ar šo auto', share: 'braucienu', own_score: 'braucēja rādītājs', impact: 'ietekme uz auto', only_you: 'Ar šo auto brauc tikai tu.', other_consent: 'Citu braucēju dati ir apkopoti un redzami tikai ar viņu piekrišanu.', car_trips: 'Auto braucieni',
      tl_start: 'Sākums', tl_end: 'Beigas', map_t: 'Maršruta karte', map_note: 'Shematisks maršruts, rekonstruēts no ātruma un sānu pārslodzes — GPS vēsturi neglabājam. Skaitļi atbilst notikumiem zemāk.',
      r_ok: 'Ātrums kārtībā', r_near: 'Virs limita', r_bad: 'Virs droša ātruma apstākļiem', ev_t: 'Kas notika braucienā', ev_speed: 'Ātruma pārsniegšana', no_events: 'Šajā braucienā nekas īpašs nenotika.', speed_t: 'Ātrums laikā',
      thr: 'slieksnis', lat: 'sānu', phone_hand: 'telefons rokās', limit: 'limits',
      week: 'nedēļa', base: 'Bāze', weight: 'svars', mode_train: 'Vilciens', mode_car: 'Auto',
    },
    en: {
      tab_cars: 'My cars', tab_drive: 'Driving', tab_sp: 'Accident', tab_more: 'More', plus_car: 'Add car',
      reg: 'Registration number', regcert: 'Registration certificate no.', octa: 'OCTA valid until', hist: 'Accident history', drv_score: 'Driver score', new: 'NEW',
      d_title: 'Driving', d_lead: 'Your driver score for the last 4 weeks. Nothing is sent to an insurer without your consent.',
      d_trend: 'Weekly trend', d_components: 'What the score is made of', d_exp: 'Experience behind the wheel', d_trips: 'Trips', all_ok: 'All good',
      hours_wheel: 'hours behind the wheel', lic: 'licensed', exp_txt: 'Hours behind the wheel say more than years on a licence.', mix: 'Where you have driven',
      counted: 'Counted', not_counted: 'Not counted', confirm_me: 'That was me', why_train: 'Train — not your drive', why_pass: 'Likely a passenger',
      reliab: 'Data reliability', rel_high: 'high', rel_mid: 'medium', rel_low: 'low (little data)', km: 'km',
      sp_lead: 'We will take these simple steps in order to fill in the agreed statement (SP)', sp_start: 'Start filling in the SP', sp_try: 'Try the SP flow',
      crash_t: 'Automatic pre-fill', crash_s: 'If the phone detects an impact, we pre-fill the SP data. You only confirm.', crash_btn: 'Simulate impact',
      crash_h: 'Possible accident', crash_q: 'Are you OK? We have already prepared the SP data.', c_when: 'Time', c_where: 'Place (approx.)', c_speed: 'Speed before impact', c_g: 'Impact force', c_weather: 'Weather',
      c_ok: 'Confirm and continue SP', c_no: 'No accident', c_note: 'Data is used only after you confirm.',
      svc: 'Services', s_car: 'Car history', s_ins: 'Insurance history', s_buy: 'Buy insurance', drive_set: 'Driving data', set: 'Settings',
      auto_detect: 'Automatic trip detection', share_ins: 'Share my score with the insurer', on_device: 'Processed on the phone, only summaries uploaded (EU)', del_data: 'Delete driving data',
      notif: 'Notifications', lang: 'App language', about: 'About us', news: 'Industry news', contact: 'Contact us', ver: 'App version 3.3.0 (prototype)',
      what_t: 'What the jury sees', what: ['This is a **“Driving” tab added to the existing OCTA app** — same visual language, same navigation.', 'Switch the demo driver: score, advice and experience change.', 'Open a component or a trip — see the base, the context and the data.', 'Mark a trip “That was me” — the score recalculates.', 'On the Accident tab: the impact simulation pre-fills the SP data.'],
      persona: 'Demo driver', views_t: 'Other views (for the presentation)', disc: 'Concept add-on for the LTAB OCTA app — hackathon prototype with synthetic data. Not an official LTAB product; no LTAB logo or assets are used.',
      octa_minus: 'OCTA', closer: 'closer to a discount', save: 'you save', no_disc_yet: 'No discount yet', weekly: 'Weekly summary', weekly_txt: 'Score and OCTA price updated. Nothing to do — open only if you want to see why.',
      octa_cost: 'Your OCTA price (illustrative)', no_score: 'Without a score', with_score: 'With your score', per_year: 'per year', to_first: '{n} more points to the first discount.',
      bg_on: 'Running in the background — nothing to tap', bg_txt: 'Trips are detected automatically.', bg_last: 'Latest:', why_t: 'Why this score and what to do', save_more: 'How to save more', up_to: 'up to', trips_auto: 'Trips are detected on their own. Mark one only if it was not yours.',
      ill_note: 'Prices and discounts are illustrative — not the pricing model of Balcia or any other insurer.',
      tip_speeding: 'Drive at or under the limit; slower still in bad weather', tip_phone: 'Do not use the phone while driving — turn on driving mode', tip_smooth: 'Look further ahead and brake more gently', tip_night: 'Take a break after 2 h; move late trips to daytime',
      ob0_t: 'Cut your OCTA cost just by driving', ob0_s: 'The app notices your trips in the background. You never have to tap anything.', ob0_a: 'Automatic', ob0_as: 'Trips are detected by themselves', ob0_b: 'Understandable', ob0_bs: 'See why the score is what it is and how to improve it', ob0_c: 'Save', ob0_cs: 'Better driving = lower OCTA price',
      ob1_t: 'What we measure', ob1_s: 'Only what really affects risk.', ob1_y: 'We measure', ob1_1: 'Speed vs limit and weather', ob1_2: 'Hard braking and cornering', ob1_3: 'Phone use while driving', ob1_4: 'Night driving and long drives without a break', ob1_n: 'We never store', ob1_5: 'Your exact route history', ob1_6: 'Your home address or contacts', ob1_7: 'Content of messages or apps', ob1_note: 'Processing happens on the phone. Only summaries go to a server (EU), and only with your consent.',
      ob2_t: 'Last step', ob2_s: 'To work in the background, these permissions are needed.', ob2_a: 'Location', ob2_as: 'To detect trips (background)', ob2_b: 'Motion sensors', ob2_bs: 'For braking and cornering', ob2_c: 'Notifications', ob2_cs: 'Weekly summary', ob2_d: 'Share my score with the insurer', ob2_ds: 'To receive the discount. You can switch it off any time.', allow: 'Allow', ob_next: 'Continue', ob_start: 'Start',
      onboard_btn: '▶ First launch',
      car_score: 'Car score', you_driver: 'You as a driver', you_lead: 'This score follows you — whichever car you drive. It affects the car scores when you drive them.', my_cars: 'Your cars', cars_n: 'cars', drives: 'Drivers:', you: 'You',
      per_car_note: 'OCTA is priced per car, not per driver — that is why there are two scores.', car_lead: 'The car score takes into account everyone who drives it and the car’s accident history. This is the score that sets the OCTA price.',
      who_drives: 'Who drives this car', share: 'of trips', own_score: 'driver score', impact: 'effect on car', only_you: 'Only you drive this car.', other_consent: 'Other drivers’ data is aggregated and shown only with their consent.', car_trips: 'Car trips',
      tl_start: 'Start', tl_end: 'End', map_t: 'Route map', map_note: 'Schematic route reconstructed from speed and lateral g — we do not store GPS history. Numbers match the events below.',
      r_ok: 'Speed OK', r_near: 'Over the limit', r_bad: 'Over the safe speed for conditions', ev_t: 'What happened on the trip', ev_speed: 'Speeding', no_events: 'Nothing notable happened on this trip.', speed_t: 'Speed over time',
      thr: 'threshold', lat: 'lateral', phone_hand: 'phone in hand', limit: 'limit',
      week: 'week', base: 'Base', weight: 'weight', mode_train: 'Train', mode_car: 'Car',
    },
  };
  const CARS = { elina: ['VW GOLF', 'EB 4821'], martins: ['TOYOTA COROLLA', 'MK 2093'], davis: ['BMW 320D', 'DR 7710'], aivars: ['VOLVO V90', 'AS 1450'] };
  const PATH = {
    car: '<path d="M5 16v-5l2-5h10l2 5v5M3 16h18M7 16v2M17 16v2"/><circle cx="8" cy="13" r=".9"/><circle cx="16" cy="13" r=".9"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><path d="M4 17h2M18 17h2"/>',
    bell: '<path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
    zap: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    train: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l2-4M15 21l-2-4"/><circle cx="9.5" cy="14" r=".7"/><circle cx="14.5" cy="14" r=".7"/>',
    hist: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/><path d="M12 8v4l3 2"/>',
    cart: '<circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M3 4h2l2.4 11h10l2-8H6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    news: '<rect x="3" y="4" width="16" height="16" rx="2"/><path d="M7 9h8M7 13h8M7 17h4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    cloud: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18z"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  };
  const I = (n, s) => `<svg class="ico" viewBox="0 0 24 24" ${s ? `style="width:${s}px;height:${s}px"` : ''} aria-hidden="true">${PATH[n]}</svg>`;
  const A = () => window.App, lang = () => A().lang(), P = (k) => L[lang()][k] != null ? L[lang()][k] : L.lv[k];
  const st = { ev: null, car: null, onboard: null, tab: 'cars', trip: null, kpi: null, crash: false, auto: true, share: true };
  let root = null;

  const dt = (iso) => { const d = new Date(Date.parse(iso) + 3 * 3600e3); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}. ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
  const mini = (s, c) => { const R = 20, C = 2 * Math.PI * R, o = C * (1 - s / 100); return `<div class="mini"><svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="${R}" fill="none" stroke="#e6e4ec" stroke-width="5"/><circle cx="25" cy="25" r="${R}" fill="none" stroke="var(--${c})" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${o}" transform="rotate(-90 25 25)"/></svg><b>${Math.round(s)}</b></div>`; };
  const mbar = (v, c) => `<div class="mbar"><i style="width:${Math.max(3, Math.min(100, v))}%;background:var(--${c})"></i></div>`;
  const md = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  function data() { const a = A(), ds = a.allDrivers(), d = ds.find((x) => x.id === a.state().driver) || ds[0]; return { d, r: a.resOf(d) }; }
  function kpis(r) {
    const a = A(), k = r.kpi, AVG = a.P.AVG, f = a.fmt, ratio = (v, b) => (b > 0 ? `×${f(v / b)} ${a.t('avg')}` : '');
    return [
      { key: 'speeding', icon: 'gauge', value: f(k.overSafePct) + '%', base: `${a.t('avg')}: ${AVG.overSafePct}% · ${ratio(k.overSafePct, AVG.overSafePct)}`, s: r.scores.speeding },
      { key: 'phone', icon: 'phone', value: f(k.phonePerHour) + ' ' + a.t('perh'), base: `${a.t('avg')}: ${AVG.phonePerHour} · ${ratio(k.phonePerHour, AVG.phonePerHour)}`, s: r.scores.phone },
      { key: 'smooth', icon: 'zap', value: f(k.harshPer100) + ' ' + a.t('per100'), base: `${a.t('avg')}: ${AVG.harshPer100} · ${ratio(k.harshPer100, AVG.harshPer100)}`, s: r.scores.smooth },
      { key: 'nightfatigue', icon: 'moon', value: f(k.nightShare * 100, 0) + '% · ' + k.fatigue + '×', base: `${a.t('avg')}: ${AVG.nightShare * 100}%`, s: r.scores.nightfatigue },
      { key: 'claims', icon: 'shield', value: r.claims + ' / 3 ' + a.t('yr'), base: 'LTAB', s: r.scores.claims },
    ];
  }

  /* ---- screens ---- */
  function money(total) { return A().E.premiumPreview(total); }
  const mycars = (d) => A().carsOf(d);
  function carCard(car, ctx) {
    const a = A(), x = a.carRes(car), c = a.col(x.res.total), m = money(x.res.total), others = x.drivers.filter((k) => k.d.id !== ctx.d.id).map((k) => k.d.name.split(' ')[0]);
    return `<div class="pcard"><div class="top">${car.name}</div><div class="dash"></div>
      <div class="body"><div class="carrow"><div class="thumb">${I('car')}</div><div class="facts">
        <div><b>${car.plate}</b><small>${P('reg')}</small></div><div><b>23.10.2027 <span style="color:#7c7c84">23:59</span></b><small>${P('octa')}</small></div><div><b>${car.claims3y}</b><small>${P('hist')}</small></div></div></div></div>
      <div class="dash"></div>
      <button class="chipscore" data-p="car:${car.id}">${mini(x.res.total, c)}<span style="flex:1"><b>${P('car_score')}</b><span class="new">${P('new')}</span><br><small style="color:#7c7c84">${m.discountPct > 0 ? P('octa_minus') + ' −' + m.discountPct + '% · ' + P('save') + ' ' + m.savings + ' €' : P('no_disc_yet')}${others.length ? ' · +' + others.join(', ') : ''}</small></span><span class="red">${I('chev')}</span></button></div>`;
  }
  function cars() {
    const { d } = data();
    return `<h1>${P('tab_cars')}<span style="color:#7c7c84">${I('bell', 26)}</span></h1>${mycars(d).map((c) => carCard(c, { d })).join('')}
    <div class="pcard"><div class="body" style="display:flex;gap:12px;align-items:center"><span class="red">${I('bell', 24)}</span><div style="font-size:14.5px;line-height:1.4"><b>${P('weekly')}</b><br><span style="color:#7c7c84">${P('weekly_txt')}</span></div></div></div>
    <div style="height:70px"></div><div class="fab"><button class="pbtn">+ ${P('plus_car')}</button></div>`;
  }
  function planEur(d, pts) { // driver improvement -> effect on each of the driver's cars, in proportion to the driver's share of that car
    const a = A(); let eur = 0;
    for (const car of mycars(d)) { const x = a.carRes(car), sh = (x.drivers.find((k) => k.d.id === d.id) || { share: 0 }).share; eur += money(x.res.total).eur - money(Math.min(100, x.res.total + pts * sh)).eur; }
    return eur;
  }
  function plan(r, d) {
    const a = A(), W = r.weights || a.P.weights, tip = { speeding: 'tip_speeding', phone: 'tip_phone', smooth: 'tip_smooth', nightfatigue: 'tip_night' }, ic = { speeding: 'gauge', phone: 'phone', smooth: 'zap', nightfatigue: 'moon' };
    return ['speeding', 'phone', 'smooth', 'nightfatigue'].map((k) => {
      const pts = W[k] * (100 - r.scores[k]) / 100;
      return { k, pts, eur: d ? planEur(d, pts) : money(r.total).eur - money(Math.min(100, r.total + pts)).eur, tip: P(tip[k]), icon: ic[k] };
    }).filter((x) => x.pts >= 1).sort((x, y) => y.eur - x.eur || y.pts - x.pts).slice(0, 3);
  }
  const planHtml = (pl) => (pl.length ? `<div class="pcard"><div class="body" style="padding:6px 14px">${pl.map((x) => `<div class="lrow" style="cursor:default"><span class="red">${I(x.icon)}</span><span class="t"><b style="font-weight:600">${x.tip}</b><small>${P('up_to')} +${A().fmt(x.pts, 0)} ${A().t('pts')}</small></span><span class="v" style="color:var(--good)">${x.eur > 0 ? '−' + x.eur + ' €' : P('closer')}<small>${x.eur > 0 ? P('per_year') : ''}</small></span></div>`).join('')}</div></div>` : '');
  const kpiRows = (kp) => kp.map((x) => `<button class="lrow" data-p="kpi:${x.key}"><span class="red">${I(x.icon)}</span><span class="t"><b>${A().t('k_' + x.key)}</b><small>${x.base}</small>${mbar(x.s, A().col(x.s))}</span><span class="v">${x.value}</span><span style="color:#b9b8c2">${I('chev', 20)}</span></button>`).join('');
  const tripRows = (trips, d) => trips.map((t) => `<button class="lrow" data-p="trip:${t.id}"><span class="red">${I(t.mode === 'train' ? 'train' : 'car')}</span><span class="t"><b>${dt(t.startISO)} · ${A().fmt(t.km)} ${P('km')}</b><small>${t.counted ? A().t(t.weather) : t.mode !== 'car' ? P('why_train') : P('why_pass') + ' (' + A().fmt(t.roleConf * 100, 0) + '%)'}${t.carId ? ' · ' + (A().D.cars.find((c) => c.id === t.carId) || { name: '' }).name : ''}</small></span>
      ${t.counted ? `<span class="pill good">${P('counted')}</span>` : (t.mode === 'car' ? `<span class="pill mute" data-p="confirm:${t.id}" style="cursor:pointer;background:var(--brand-soft);color:var(--brand)">${P('confirm_me')}</span>` : `<span class="pill mute">${P('not_counted')}</span>`)}</button>`).join('');
  function priceHero(total, cap) {
    const m = money(total), mark = Math.max(0, Math.min(100, total));
    return m.discountPct > 0
      ? `<div class="costrow"><div><small>${P('no_score')}</small><b>${m.base} €</b></div><span class="red" style="font-size:22px">→</span><div><small>${P('with_score')}</small><b class="big green">${m.eur} €</b></div></div><div style="margin:10px 0 2px"><span class="pill good">−${m.savings} € · −${m.discountPct}%</span> <small style="color:#7c7c84">${P('per_year')}</small></div>${cap ? `<div class="tier"><i style="left:${mark}%"></i></div><div class="tierl"><span>0 · 0%</span><span>50 · 0%</span><span>100 · −25%</span></div>` : ''}`
      : `<div class="costrow"><div><small>${P('no_score')}</small><b class="big">${m.base} €</b></div></div><div style="margin:10px 0 2px"><span class="pill mid">${P('no_disc_yet')}</span> <small style="color:#7c7c84">${P('to_first').replace('{n}', Math.max(1, Math.ceil(50 - total)))}</small></div>${cap ? `<div class="tier"><i style="left:${mark}%"></i></div><div class="tierl"><span>0 · 0%</span><span>50 · 0%</span><span>100 · −25%</span></div>` : ''}`;
  }
  const scoreCard = (r, c, tw) => { const a = A(), conf = r.sigma <= 7 ? 'rel_high' : r.sigma <= 12 ? 'rel_mid' : 'rel_low';
    return `<div class="pcard"><div class="body"><div class="scorecard"><div class="ring">${a.ring(r.total, c)}<div class="n"><div><b>${a.fmt(r.total, 0)}</b><small>± ${a.fmt(r.sigma, 0)} · ${a.t('of100')}</small></div></div></div>
      <div><span class="pill ${c}">${a.t('band_' + r.band)}</span><p style="margin:10px 0 2px;font-size:14px"><b>${P('reliab')}:</b> ${P(conf)}</p><small style="color:#7c7c84">${a.fmt(r.kpi.km, 0)} ${P('km')} · ${r.kpi.trips} ${a.t('trips_scored')}</small></div></div></div>
      ${tw ? `<div class="dash"></div><div class="body" style="padding-top:8px"><b style="font-size:15px">${P('d_trend')}</b>${a.trendSvg(tw)}</div>` : ''}</div>`; };
  function drive() {
    const { d, r } = data(), a = A(), c = a.col(r.total), adv = a.adviceText(r, d), tw = a.weekly(d), kp = kpis(r), cs = mycars(d).map((car) => ({ car, x: a.carRes(car) }));
    const last = d.trips.filter((x) => x.counted).sort((x, y) => Date.parse(y.startISO) - Date.parse(x.startISO))[0];
    const base = cs.length * 300, eur = cs.reduce((s, y) => s + money(y.x.res.total).eur, 0), sav = base - eur, pct = base ? Math.round((sav / base) * 100) : 0;
    const b = d.expBuckets || {}, tot = a.P.expBuckets.reduce((s, k) => s + (b[k] || 0), 0) || 1, colr = ['#b3282d', '#2b6cdf', '#232227', '#d98a00'];
    const mixbar = `<div style="display:flex;height:10px;border-radius:99px;overflow:hidden;margin:10px 0 6px">${a.P.expBuckets.map((k, i) => `<i style="width:${((b[k] || 0) / tot) * 100}%;background:${colr[i]}"></i>`).join('')}</div><div class="legend">${a.P.expBuckets.map((k, i) => `<span><i style="background:${colr[i]}"></i>${a.t('b_' + k)}</span>`).join('')}</div>`;
    const trips = d.trips.slice().sort((x, y) => Date.parse(y.startISO) - Date.parse(x.startISO)).slice(0, 8);
    const hero = sav > 0
      ? `<div class="costrow"><div><small>${P('no_score')}</small><b>${base} €</b></div><span class="red" style="font-size:22px">→</span><div><small>${P('with_score')}</small><b class="big green">${eur} €</b></div></div><div style="margin:10px 0 2px"><span class="pill good">−${sav} € · −${pct}%</span> <small style="color:#7c7c84">${P('per_year')} · ${cs.length} ${P('cars_n')}</small></div>`
      : `<div class="costrow"><div><small>${P('no_score')}</small><b class="big">${base} €</b></div></div><div style="margin:10px 0 2px"><span class="pill mid">${P('no_disc_yet')}</span> <small style="color:#7c7c84">${cs.length} ${P('cars_n')}</small></div>`;
    const carRows = cs.map(({ car, x }) => { const m = money(x.res.total), cc = a.col(x.res.total); return `<button class="lrow" data-p="car:${car.id}">${mini(x.res.total, cc)}<span class="t"><b>${car.name}</b><small>${car.plate} · ${P('drives')} ${x.drivers.map((k) => (k.d.id === d.id ? P('you') : k.d.name.split(' ')[0])).join(', ')}</small></span><span class="v">${m.eur} €<small>${m.discountPct > 0 ? '−' + m.discountPct + '%' : P('no_disc_yet')}</small></span><span style="color:#b9b8c2">${I('chev', 20)}</span></button>`; }).join('');
    return `<h1>${P('d_title')}</h1>
    <div class="pcard"><div class="body"><small style="color:#7c7c84">${P('octa_cost')}</small>${hero}<p style="font-size:12.5px;color:#7c7c84;margin:8px 0 0">${P('per_car_note')}</p></div>
      <div class="dash"></div><div class="body bgrow"><span class="live"></span><div style="font-size:14px;line-height:1.4"><b>${P('bg_on')}</b><br><span style="color:#7c7c84">${P('bg_txt')}${last ? ' ' + P('bg_last') + ' ' + dt(last.startISO) : ''}</span></div></div></div>
    <h2>${P('my_cars')} · ${P('car_score')}</h2><div class="pcard"><div class="body" style="padding:6px 14px">${carRows}</div></div>
    <h2>${P('you_driver')}</h2><p class="lead" style="font-size:14.5px;margin-bottom:10px">${P('you_lead')}</p>${scoreCard(r, c, tw)}
    <h2>${P('why_t')}</h2><div class="advbox"><b>${a.t('advice_t')}</b><p>${adv.txt.replace(/</g, '&lt;')}</p></div>
    ${plan(r, d).length ? `<h2>${P('save_more')}</h2>${planHtml(plan(r, d))}` : ''}
    <h2>${P('d_components')}</h2><div class="pcard"><div class="body" style="padding:6px 14px">${kpiRows(kp)}</div></div>
    <h2>${P('d_exp')}</h2><div class="pcard"><div class="body"><div style="display:flex;align-items:baseline;gap:8px"><b style="font-size:26px">${a.fmt(d.expHours, 0)}</b><span>${P('hours_wheel')}</span></div>
      <small style="color:#7c7c84">${d.licYears != null ? a.fmt(d.licYears, d.licYears < 1 ? 1 : 0) + ' ' + a.t('years_lic') : ''} · ${P('exp_txt')}</small>${mbar(r.scores.experience, 'brand')}<div style="margin-top:12px;font-size:14px"><b>${P('mix')}</b></div>${mixbar}</div></div>
    <h2>${P('d_trips')}</h2><p class="lead" style="font-size:14px;margin-bottom:8px">${P('trips_auto')}</p><div class="pcard"><div class="body" style="padding:6px 14px">${tripRows(trips, d)}</div></div>
    <p class="disc" style="margin:10px 0 0">${P('ill_note')}</p>`;
  }
  function carScreen() {
    const a = A(), { d } = data(), car = a.D.cars.find((x) => x.id === st.car); if (!car) { st.car = null; return drive(); }
    const x = a.carRes(car), r = x.res, c = a.col(r.total), kp = kpis(r), adv = a.adviceText(r, { trips: x.trips });
    kp[4].base = 'LTAB · ' + car.name;
    const drows = x.drivers.map((k) => `<div class="lrow" style="cursor:default"><span class="t"><b>${k.d.id === d.id ? P('you') : esc(k.d.name)}</b><small>${a.fmt(k.share * 100, 0)}% ${P('share')} · ${P('own_score')} ${a.fmt(k.res.total, 0)}</small>${mbar(k.share * 100, 'brand')}</span><span class="v" style="color:var(--${k.impact >= 0 ? 'good' : 'bad'})">${k.impact >= 0 ? '+' : ''}${a.fmt(k.impact, 0)}<small>${P('impact')}</small></span></div>`).join('');
    const trips = x.trips.slice().sort((p, q) => Date.parse(q.startISO) - Date.parse(p.startISO)).slice(0, 6);
    return `<button class="backrow" data-p="backcar">${I('back', 22)} ${P('tab_drive')}</button><h1 class="sm">${car.name}</h1><div style="color:#7c7c84;margin:-4px 0 12px">${car.plate}</div>
    <p class="lead" style="font-size:14.5px">${P('car_lead')}</p>
    <div class="pcard"><div class="body"><small style="color:#7c7c84">${P('octa_cost')}</small>${priceHero(r.total, true)}</div></div>
    ${scoreCard(r, c, null)}
    <h2>${P('who_drives')}</h2><div class="pcard"><div class="body" style="padding:6px 14px">${x.drivers.length > 1 ? drows : `<div class="lrow" style="cursor:default"><span class="t"><b>${P('only_you')}</b></span></div>`}</div></div><p class="disc" style="text-align:left;margin:6px 0 0">${P('other_consent')}</p>
    <h2>${P('why_t')}</h2><div class="advbox"><b>${a.t('advice_t')}</b><p>${adv.txt.replace(/</g, '&lt;')}</p></div>${planHtml(plan(r))}
    <h2>${P('d_components')}</h2><div class="pcard"><div class="body" style="padding:6px 14px">${kpiRows(kp.slice(0, 5))}</div></div>
    <h2>${P('car_trips')}</h2><div class="pcard"><div class="body" style="padding:6px 14px">${tripRows(trips, d)}</div></div>`;
  }
  const esc = (v) => String(v).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function onboarding() {
    const n = st.onboard, ok = (t) => `<li style="margin:9px 0;display:flex;gap:10px"><span style="color:var(--good)">✓</span><span>${t}</span></li>`, no = (t) => `<li style="margin:9px 0;display:flex;gap:10px"><span class="red">✕</span><span>${t}</span></li>`;
    const dots = [0, 1, 2].map((i) => `<i style="width:${i === n ? 22 : 8}px;height:8px;border-radius:9px;background:${i === n ? 'var(--brand)' : '#dcdbe3'};display:inline-block;margin:0 3px"></i>`).join('');
    let body;
    if (n === 0) body = `<div style="text-align:center;margin-top:24px"><div class="thumb" style="width:96px;height:96px;margin:0 auto 22px;border-radius:26px;background:var(--brand)">${I('gauge')}</div><h1 style="display:block;text-align:center;font-size:25px;margin:0 0 10px">${P('ob0_t')}</h1><p class="lead">${P('ob0_s')}</p></div>
      <ul style="list-style:none;padding:0;margin:18px 0 0">${[['car', 'ob0_a', 'ob0_as'], ['gauge', 'ob0_b', 'ob0_bs'], ['cart', 'ob0_c', 'ob0_cs']].map(([ic, t, s2]) => `<li style="display:flex;gap:14px;margin:16px 0"><span class="red">${I(ic, 28)}</span><span><b>${P(t)}</b><br><small style="color:#7c7c84;font-size:14px">${P(s2)}</small></span></li>`).join('')}</ul>`;
    else if (n === 1) body = `<h1 style="display:block;font-size:25px;margin:22px 0 8px">${P('ob1_t')}</h1><p class="lead">${P('ob1_s')}</p><b>${P('ob1_y')}</b><ul style="list-style:none;padding:0;margin:6px 0 14px">${ok(P('ob1_1'))}${ok(P('ob1_2'))}${ok(P('ob1_3'))}${ok(P('ob1_4'))}</ul><b>${P('ob1_n')}</b><ul style="list-style:none;padding:0;margin:6px 0">${no(P('ob1_5'))}${no(P('ob1_6'))}${no(P('ob1_7'))}</ul><div class="advbox"><p>${P('ob1_note')}</p></div>`;
    else body = `<h1 style="display:block;font-size:25px;margin:22px 0 8px">${P('ob2_t')}</h1><p class="lead">${P('ob2_s')}</p>
      ${[['globe', 'ob2_a', 'ob2_as'], ['zap', 'ob2_b', 'ob2_bs'], ['bell', 'ob2_c', 'ob2_cs']].map(([ic, t, s2]) => `<div class="lrow" style="cursor:default"><span class="red">${I(ic)}</span><span class="t"><b style="font-weight:600">${P(t)}</b><small>${P(s2)}</small></span><span class="pill good">${P('allow')}</span></div>`).join('')}
      <div class="lrow" style="cursor:default;margin-top:6px"><span class="red">${I('shield')}</span><span class="t"><b style="font-weight:600">${P('ob2_d')}</b><small>${P('ob2_ds')}</small></span><button class="sw ${st.share ? 'on' : ''}" data-p="sw:share"></button></div>`;
    return `<div class="scr" style="padding-bottom:20px">${body}</div><div style="padding:0 18px 22px;flex:none"><div style="text-align:center;margin-bottom:12px">${dots}</div><button class="pbtn" data-p="ob-next">${n === 2 ? P('ob_start') : P('ob_next')}</button></div>`;
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  const clock = (iso, sec) => { const d = new Date(Date.parse(iso) + 3 * 3600e3 + sec * 1000); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`; };
  const mmss = (s) => `${Math.floor(s / 60)}:${pad2(Math.round(s % 60))}`;
  const EVC = { brake: '#b3282d', accel: '#d98a00', corner: '#2b6cdf', phone: '#232227', speed: '#7a3fb0' };
  /* key points of a trip, in time order: the harsh events from the summary + speeding episodes found in the trace */
  function keyPoints(t, tr, step) {
    const a = A(), safe = a.P.safeFactor[t.weather] || 1, thr = a.P.brakeG[t.weather] || 0.3, out = [], last = tr.v.length - 1;
    const k = (i) => Math.max(0, Math.min(last, Math.round(i / step))), g2 = (x) => a.fmt(x, 2);
    for (const e of t.events || []) {
      const j = k(e.i), v1 = tr.v[j], v0 = tr.v[Math.max(0, j - Math.max(1, Math.round(1 / step)))];
      if (e.type === 'brake') out.push({ sec: e.i, j, type: 'brake', sub: `${v0} → ${v1} km/h · −${g2(e.g)} g · ${P('thr')} ${g2(thr)} g (${a.t(t.weather).toLowerCase()})` });
      else if (e.type === 'accel') out.push({ sec: e.i, j, type: 'accel', sub: `${v0} → ${v1} km/h · +${g2(e.g)} g` });
      else if (e.type === 'corner') out.push({ sec: e.i, j, type: 'corner', sub: `${P('lat')} ${g2(e.g)} g · ${v1} km/h` });
      else if (e.type === 'phone') { let n = 0; while (j + n < last && tr.phone && tr.phone[j + n] && tr.v[j + n] > 5) n++; out.push({ sec: e.i, j, type: 'phone', sub: `${P('phone_hand')} ${Math.max(1, Math.round(n * step))} s · ${v1} km/h` }); }
    }
    let s0 = -1, vm = 0;
    for (let i = 0; i <= last + 1; i++) {
      const over = i <= last && tr.v[i] > tr.lim[i] * safe + a.P.speedMarginKmh;
      if (over) { if (s0 < 0) { s0 = i; vm = 0; } vm = Math.max(vm, tr.v[i]); }
      else if (s0 >= 0) { const dur = (i - s0) * step; if (dur >= 8) out.push({ sec: s0 * step, j: s0, type: 'speed', sub: `${Math.round(dur)} s · ${P('up_to')} ${vm} km/h (${P('limit')} ${tr.lim[s0]}${safe < 1 ? ', ' + a.t(t.weather).toLowerCase() : ''})` }); s0 = -1; }
    }
    return out.sort((x, y) => x.sec - y.sec);
  }
  function routePath(tr) {
    const dt = 1 / tr.hz; let x = 0, y = 0, th = 0; const pts = [[0, 0]];
    for (let i = 1; i < tr.v.length; i++) { const v = Math.max(tr.v[i] / 3.6, 2.5); th += (tr.ay[i] || 0) * 9.81 / v * dt; x += tr.v[i] / 3.6 * dt * Math.cos(th); y += tr.v[i] / 3.6 * dt * Math.sin(th); pts.push([x, y]); }
    return pts;
  }
  function routeMap(t, tr, kp, sel) {
    const a = A(), pts = routePath(tr), W = 330, H = 260, pd = 26, safe = a.P.safeFactor[t.weather] || 1;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const sc = Math.min((W - 2 * pd) / Math.max(x1 - x0, 60), (H - 2 * pd) / Math.max(y1 - y0, 60)), ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
    const X = (p) => (p[0] * sc + ox).toFixed(1), Y = (p) => (p[1] * sc + oy).toFixed(1);
    const cls = (i) => (tr.v[i] > tr.lim[i] * safe + a.P.speedMarginKmh ? 'bad' : tr.v[i] > tr.lim[i] + a.P.speedMarginKmh ? 'mid' : 'good'), CC = { good: '#1f9d63', mid: '#d98a00', bad: '#c0392b' };
    let runs = '', cur = cls(0), seg = [pts[0]];
    for (let i = 1; i < pts.length; i++) { const c = cls(i); seg.push(pts[i]); if (c !== cur || i === pts.length - 1) { runs += `<polyline points="${seg.map((p) => X(p) + ',' + Y(p)).join(' ')}" fill="none" stroke="${CC[cur]}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`; seg = [pts[i]]; cur = c; } }
    const pins = kp.map((e, n) => { const p = pts[e.j] || pts[0], on = sel === n; return `<g data-p="ev:${n}" style="cursor:pointer"><circle cx="${X(p)}" cy="${Y(p)}" r="${on ? 13 : 10}" fill="${EVC[e.type]}" stroke="#fff" stroke-width="${on ? 3 : 2}"/><text x="${X(p)}" y="${(+Y(p) + 3.8).toFixed(1)}" text-anchor="middle" style="fill:#fff;font-size:10.5px;font-weight:700">${n + 1}</text></g>`; }).join('');
    const mk = (p, lab, col) => `<circle cx="${X(p)}" cy="${Y(p)}" r="11" fill="${col}" stroke="#fff" stroke-width="2.5"/><text x="${X(p)}" y="${(+Y(p) + 4).toFixed(1)}" text-anchor="middle" style="fill:#fff;font-size:11px;font-weight:700">${lab}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${P('map_t')}" style="background:#f6f5f9;border-radius:14px"><defs><pattern id="gr" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#ebeaf0" stroke-width="1"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#gr)" rx="14"/>${runs}${mk(pts[0], 'A', '#1f9d63')}${mk(pts[pts.length - 1], 'B', '#232227')}${pins}</svg>
      <div class="legend" style="margin-top:8px"><span><i style="background:#1f9d63"></i>${P('r_ok')}</span><span><i style="background:#d98a00"></i>${P('r_near')}</span><span><i style="background:#c0392b"></i>${P('r_bad')}</span></div>`;
  }
  function tripScreen() {
    const { d } = data(), a = A(), t = d.trips.find((x) => x.id === st.trip);
    if (!t) { st.trip = null; return drive(); }
    const raw = d.raws && d.raws[t.id], car = (a.D.cars || []).find((c) => c.id === t.carId);
    let body = `<p class="lead" style="font-size:14px">${a.t('no_trace')}</p>`;
    if (raw) {
      const tr = a.rawToTrip(raw, { id: t.id }), step = raw.step || 1, kp = t.counted ? keyPoints(t, tr, step) : [], dur = t.durationS;
      const sel = st.ev != null && st.ev < kp.length ? st.ev : null;
      const tl = `<div class="tl"><div class="ti"><i class="d" style="background:#1f9d63">A</i><div class="tt"><div><b>${clock(t.startISO, 0)}</b> <small>${P('tl_start')}</small></div></div></div>
        ${kp.map((e, n) => `<button class="ti ev ${sel === n ? 'sel' : ''}" data-p="ev:${n}"><i class="d" style="background:${EVC[e.type]}">${n + 1}</i><div class="tt"><div><b>${clock(t.startISO, e.sec)}</b> <small>+${mmss(e.sec)}</small></div><div class="h">${e.type === 'speed' ? P('ev_speed') : a.t('ev_' + e.type)}</div><div class="sb">${e.sub}</div></div></button>`).join('') || `<div class="ti"><i class="d" style="background:#cfcdd8"></i><div class="tt"><div class="sb">${P('no_events')}</div></div></div>`}
        <div class="ti"><i class="d" style="background:#232227">B</i><div class="tt"><div><b>${clock(t.startISO, dur)}</b> <small>${P('tl_end')} · ${a.fmt(t.km)} km · ${a.fmt(dur / 60, 0)} min</small></div></div></div></div>`;
      body = `<h2 style="margin-top:6px">${P('map_t')}</h2>${routeMap(t, tr, kp, sel)}<p class="disc" style="text-align:left;margin:6px 0 0">${P('map_note')}</p>
        <h2>${P('ev_t')} · ${kp.length}</h2><div class="pcard"><div class="body" style="padding:12px 14px">${tl}</div></div>
        <h2>${P('speed_t')}</h2><div class="pcard"><div class="body">${a.speedChart(tr, kp.filter((e) => e.type !== 'speed').map((e) => ({ i: e.j, type: e.type })))}</div></div>`;
    }
    return `<button class="backrow" data-p="back">${I('back', 22)} ${st.car ? (car ? car.name : P('tab_drive')) : P('tab_drive')}</button><h1 class="sm">${dt(t.startISO)}</h1>
    <div class="pcard"><div class="body"><div style="display:flex;gap:16px;flex-wrap:wrap"><div><b style="font-size:20px">${a.fmt(t.km)}</b><br><small style="color:#7c7c84">${P('km')}</small></div><div><b style="font-size:20px">${a.fmt(t.durationS / 60, 0)}</b><br><small style="color:#7c7c84">min</small></div><div><b style="font-size:20px">${a.t(t.weather)}</b><br><small style="color:#7c7c84">${a.t('weather')}</small></div>${car ? `<div><b style="font-size:20px">${car.name.split(' ').slice(-1)[0]}</b><br><small style="color:#7c7c84">${P('car_score')}</small></div>` : ''}</div></div></div>
    ${!t.counted ? `<div class="advbox"><b>${t.mode !== 'car' ? P('why_train') : P('why_pass')}</b></div>` : ''}${body}`;
  }
  function sp() {
    return `<h1>CSNg</h1><p class="lead">${P('sp_lead')}</p><button class="pbtn">${P('sp_start')}</button><div style="height:12px"></div><button class="pbtn out">${P('sp_try')}</button>
    <div class="dash" style="border-top:1.5px dashed #e3e2ea;margin:22px 0"></div>
    <div class="pcard"><div class="body"><div style="display:flex;gap:12px;align-items:center"><span class="red">${I('warn', 28)}</span><div><b>${P('crash_t')}</b><br><small style="color:#7c7c84;line-height:1.4">${P('crash_s')}</small></div></div><div style="margin-top:14px"><button class="pbtn sm" data-p="crash">${P('crash_btn')}</button></div></div></div>`;
  }
  function more() {
    const a = A(), li = (ic, tx, extra) => `<div class="lrow" style="cursor:default"><span class="red">${I(ic)}</span><span class="t"><b style="font-weight:500">${tx}</b></span>${extra || ''}</div>`;
    const sw = (k) => `<button class="sw ${st[k] ? 'on' : ''}" data-p="sw:${k}" aria-label="toggle"></button>`;
    return `<h1 style="margin-bottom:2px">${a.lang() === 'lv' ? 'Demo lietotājs' : 'Demo user'}</h1><div class="red" style="font-size:16px">${a.lang() === 'lv' ? 'Apskatīt personīgo informāciju' : 'View personal information'}</div>
    <div class="sec">${P('svc')}</div>${li('hist', P('s_car'))}${li('hist', P('s_ins'))}${li('cart', P('s_buy'))}
    <div class="sec">${P('drive_set')} <span class="badge2">${P('new')}</span></div>${li('car', P('auto_detect'), sw('auto'))}${li('shield', P('share_ins'), sw('share'))}${li('lock', P('on_device'))}${li('trash', P('del_data'))}
    <div class="sec">${P('set')}</div>${li('bell', P('notif'), '<button class="sw"></button>')}${li('globe', P('lang') + ': ' + (a.lang() === 'lv' ? 'LV' : 'EN'), `<button class="pbtn sm out" data-p="lang">${a.lang() === 'lv' ? 'EN' : 'LV'}</button>`)}
    <div class="sec">${P('about')}</div>${li('news', P('news'))}${li('mail', P('contact'))}<div class="sec" style="margin-top:26px">${P('ver')}</div><p class="disc" style="text-align:left;margin:6px 0 0">${P('disc')}</p>`;
  }
  function sheet() {
    const a = A();
    if (st.kpi) {
      const r = st.car ? a.carRes(a.D.cars.find((x) => x.id === st.car)).res : data().r, k = kpis(r).find((x) => x.key === st.kpi), w = Math.round(r.weights[st.kpi]);
      return `<div class="sheetbg" data-p="close"><div class="sheet" data-p="stop"><div class="grab"></div><h3>${a.t('k_' + st.kpi)}</h3><div style="font-size:30px;font-weight:700;color:var(--${a.col(k.s)})">${k.value}</div><div style="color:#7c7c84;margin:2px 0 8px">${k.base}</div>${mbar(k.s, a.col(k.s))}
        <p style="margin:14px 0 6px;line-height:1.45">${a.t('c_' + st.kpi)}</p><table><tr><td>${P('weight')}</td><td>${w}%</td></tr><tr><td>${a.t('k_' + st.kpi)}</td><td>${a.fmt(k.s, 0)} / 100</td></tr></table>
        <div style="margin-top:14px"><button class="pbtn" data-p="close">OK</button></div></div></div>`;
    }
    if (st.crash) {
      const now = new Date(), p = (n) => String(n).padStart(2, '0');
      return `<div class="sheetbg"><div class="sheet" data-p="stop"><div class="grab"></div><h3 class="red">${I('warn', 22)} ${P('crash_h')}</h3><p style="margin:4px 0 8px;line-height:1.45">${P('crash_q')}</p>
        <table><tr><td>${P('c_when')}</td><td>${p(now.getDate())}.${p(now.getMonth() + 1)}.${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}</td></tr><tr><td>${P('c_where')}</td><td>Rīga, Brīvības iela</td></tr><tr><td>${P('c_speed')}</td><td>42 km/h</td></tr><tr><td>${P('c_g')}</td><td>3,8 g</td></tr><tr><td>${P('c_weather')}</td><td>${a.t('wet')}</td></tr></table>
        <p style="color:#7c7c84;font-size:13px">${P('c_note')}</p><button class="pbtn" data-p="crash-ok">${P('c_ok')}</button><div style="height:10px"></div><button class="pbtn out" data-p="close">${P('c_no')}</button></div></div>`;
    }
    return '';
  }

  const SB = '<span>9:41</span><span style="display:flex;gap:6px;align-items:center"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="15" width="3" height="5" rx="1"/><rect x="7" y="11" width="3" height="9" rx="1"/><rect x="12" y="7" width="3" height="13" rx="1"/><rect x="17" y="3" width="3" height="17" rx="1" opacity=".3"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="18" height="10" rx="3"/><path d="M22 10v4"/><rect x="4" y="9" width="9" height="6" rx="1.5" fill="currentColor"/></svg></span>';
  function html() {
    if (st.onboard != null) return `<div class="device"><div class="sb">${SB}</div>${onboarding()}</div><p class="disc">${P('disc')}</p>`;
    const screen = st.trip ? tripScreen() : st.car ? carScreen() : { cars, drive, sp, more }[st.tab]();
    const tabs = [['cars', 'car'], ['drive', 'gauge'], ['sp', 'doc'], ['more', 'dots']].map(([k, ic]) => `<button class="${st.tab === k && !st.trip ? 'on' : ''}" data-p="tab:${k}">${I(ic)}<span>${P('tab_' + k)}</span>${k === 'drive' ? '<i class="dot"></i>' : ''}</button>`).join('');
    return `<div class="device"><div class="sb">${SB}</div><div class="scr">${screen}</div><nav class="tabbar">${tabs}</nav>${sheet()}</div><p class="disc">${P('disc')}</p>`;
  }
  function render() {
    if (!root) return; const sc = root.querySelector('.scr'), y = sc ? sc.scrollTop : 0;
    root.innerHTML = html(); const n = root.querySelector('.scr'); if (n && st._keep) n.scrollTop = y; st._keep = false;
  }
  function onClick(e) {
    const el = e.target.closest('[data-p]'); if (!el) return; const [act, arg] = el.dataset.p.split(':'), a = A();
    if (act === 'stop') return; e.stopPropagation();
    if (act === 'tab') { st.tab = arg; st.trip = null; st.kpi = null; st.car = null; }
    else if (act === 'kpi') { st.kpi = arg; st._keep = true; }
    else if (act === 'trip') { st.trip = arg; st.ev = null; }
    else if (act === 'ev') { st.ev = +arg; st._keep = true; }
    else if (act === 'back') st.trip = null;
    else if (act === 'car') { st.car = arg; st.trip = null; }
    else if (act === 'backcar') { st.car = null; }
    else if (act === 'ob-next') { if (st.onboard >= 2) { st.onboard = null; st.tab = 'cars'; } else st.onboard++; }
    else if (act === 'close') { st.kpi = null; st.crash = false; st._keep = true; }
    else if (act === 'crash') st.crash = true;
    else if (act === 'crash-ok') { st.crash = false; }
    else if (act === 'sw') { st[arg] = !st[arg]; st._keep = true; }
    else if (act === 'lang') { a.setLang(a.lang() === 'lv' ? 'en' : 'lv'); return; }
    else if (act === 'confirm') { const { d } = data(), t = d.trips.find((x) => x.id === arg); if (t) { t.counted = true; t.confirmed = true; t.roleConf = 1; t.reason = ''; a.invalidate(); } st._keep = true; }
    render();
  }
  function mount(el) { root = el; root.onclick = onClick; render(); }
  window.Phone = { mount, L, onboard() { st.onboard = 0; render(); }, reset() { st.car = null; st.onboard = null; st.tab = 'cars'; st.trip = null; st.kpi = null; st.crash = false; }, P };
})();
