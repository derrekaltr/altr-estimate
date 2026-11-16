/* ALTR shared engine — the single source of truth for:
   - the estimate rubric (docs/04-valuation-framework.md)
   - lane routing (docs/07-buyer-outreach-drafts.md "Lane 2" table — change both together)
   - consent wording (versioned)
   - lead codes (the bridge between the public funnel page and the ops dashboard)
   - compliance gates (contract rules from docs/02-contracts/)
   Loaded by: public/index.html, tools/dashboard.html, tools/lead-intake.html,
   tools/valuation-estimator.html. Runs in the browser and in Node (for tests). */
(function (root) {
'use strict';

const ALTR = { VERSION: 'engine-1', REF_RATE: 0.10 };

/* ================= consent (versioned — bump ver on ANY wording change) ================= */
ALTR.CONSENT = {
  ver: 'cw-1',
  text: "I'm happy to be contacted about licensing my business's data, and for the details I provide to be shared with vetted data-licensing buyers for that purpose. I understand any estimate is an indication only — not an offer — and I can withdraw at any time."
};

/* ================= estimate (docs/04 rubric) =================
   x = { status:'operating'|'winding'|'closed', emp, yrs, region:'core'|'other',
         cats:(count 0-7), domain:'specialist'|'standard'|'generic',
         workflows, thirdparty, calls, pii, eu, txflow (booleans) }
   returns { lo, hi, routed, blocked, flags[], notes[] } */
ALTR.estimate = function (x) {
  const flags = [], notes = [];
  let lo = 0, hi = 0, routed = false, blocked = false;
  if (x.eu) {
    blocked = true;
    flags.push('EU/UK personal data in scope — GDPR. Do not refer without specialist privacy counsel.');
  } else if (x.emp < 10) {
    lo = 0; hi = 25000; routed = true;
    notes.push('Below most AI-training buyer floors. Realistic routes: OpenTrain, dead-company archive buyers ($15–25K comps), or recurring data-feed buyers if there is transaction flow. Re-check in 12 months.');
  } else if (x.yrs < 3) {
    lo = 0; hi = 50000; routed = true;
    notes.push('Under 3 years of records is below most buyer floors. Park and revisit, or route to marketplaces.');
  } else if (x.emp < 20) {
    lo = 10000; hi = 100000;
    notes.push('10–19 employees: OpenTrain territory — Tier-1 buyers (micro1 ~30+ FTEs, Nyne 20+ W-2) will likely decline.');
  } else if (x.emp <= 75) {
    if (x.yrs >= 5) { lo = 150000; hi = 500000; } else { lo = 100000; hi = 350000; }
  } else if (x.emp <= 250) { lo = 500000; hi = 1500000; }
  else { lo = 1000000; hi = 3000000; }

  if (!routed && !blocked) {
    if (x.region === 'other') { lo *= 0.5; hi *= 0.6; notes.push('Non-US/UK/CA or non-English records: range cut roughly in half.'); }
    if (x.cats >= 3) { lo *= 1.2; hi *= 1.5; }
    else if (x.cats <= 1) { lo *= 0.5; hi *= 0.7; notes.push('A single shallow data category limits value — linked records across comms + tickets/CRM + docs are what buyers pay up for.'); }
    if (x.domain === 'specialist') { lo *= 1.3; hi *= 2; }
    if (x.domain === 'generic') { lo *= 0.6; hi *= 0.8; }
    if (x.workflows) { lo *= 1.2; hi *= 1.5; }
    if (x.thirdparty) { lo *= 0.5; hi *= 0.5; flags.push('Heavy third-party confidential material: range halved; counsel needed before any referral.'); }
    if (x.pii) { lo *= 0.5; hi *= 0.7; flags.push('Un-de-identifiable customer PII reduces value and may narrow the buyer pool.'); }
  }
  if (x.calls) flags.push('Call recordings without AI-training consent are excluded from this estimate entirely — consent-to-record is not consent-to-train.');
  if (x.status && x.status !== 'operating') notes.push('Winding-down / closed companies qualify with several buyers — often the fastest closes.');
  return { lo: Math.round(lo || 0), hi: Math.round(hi || 0), routed, blocked, flags, notes };
};

/* ================= lanes (docs/07 routing table, encoded) ================= */
ALTR.LANES = [
  { id: 'tier1', label: 'Tier 1 · AI-training referral', pill: 'accent',
    targets: ['Intuition', 'micro1', 'Nyne'],
    fee: 'Buyer-side referral fee (default 10%)',
    nextSteps: [
      'Consent record on file before any buyer sees contact details',
      'Qualify call: contact info, data categories, exclusivity appetite (docs/09 script)',
      'Submit to 2–4 Tier-1 buyers in parallel',
      'Collect written indications — never sign exclusivity before all are in',
      'LOI → close → commission; creator split paid within 15 days of month-end' ],
    reqDocs: ['Consent record (timestamped, versioned)'] },
  { id: 'small', label: 'Small company · OpenTrain-first', pill: 'neutral',
    targets: ['OpenTrain'],
    fee: 'Buyer referral fee if offered, else success fee',
    nextSteps: [
      'Consent record on file',
      'Confirm OpenTrain referral terms in writing',
      'No referral fee? Success-fee agreement signed BEFORE the introduction',
      'Introduce only — no data custody, no listings in your name, no warranties' ],
    reqDocs: ['Consent record', 'Success-fee agreement (only if no buyer referral fee)'] },
  { id: 'dead', label: 'Closed / winding down', pill: 'neutral',
    targets: ['SimpleClosure', 'OpenTrain'],
    fee: 'Referral fee if offered, else success fee',
    nextSteps: [
      'Consent record on file (owner/officer of the entity)',
      'Confirm who holds rights to the archive (dissolved entity vs owner personally)',
      'Submit to SimpleClosure + OpenTrain in parallel — $15–25K comps, fast closes',
      'Referral fee if offered, else success-fee agreement before the intro' ],
    reqDocs: ['Consent record', 'Success-fee agreement (if no referral fee)'] },
  { id: 'altdata', label: 'Alt-data · recurring feeds', pill: 'accent',
    targets: ['Eagle Alpha', 'Neudata'],
    fee: 'Success fee on collected license revenue',
    nextSteps: [
      'Consent record on file',
      'Success-fee agreement signed BEFORE any introduction — hard rule (docs/07)',
      'Intro to Eagle Alpha / Neudata; recurring $25K–200K+/yr feed potential',
      'Success fee on collected revenue; 12-month tail + 24 months of renewals' ],
    reqDocs: ['Success-fee agreement signed before intro', 'Consent record'] },
  { id: 'content', label: 'Creator content · footage', pill: 'neutral',
    targets: ['Troveo', 'Protege'],
    fee: 'Management cut of licensing revenue',
    nextSteps: [
      'Creator-side lane for owned footage — never auto-routed from the business form',
      'Confirm footage ownership and releases',
      'Route via Troveo / Protege' ],
    reqDocs: ['Content ownership confirmation'] },
  { id: 'park', label: 'Park · recheck in 12 months', pill: 'neutral',
    targets: [],
    fee: 'Future pipeline',
    nextSteps: [
      'Log the lead and set the 12-month recheck date',
      'Send the "we\'ll re-run this in 12 months" message (docs/06 B5)',
      'Re-run the estimate at recheck — buyer floors have been dropping' ],
    reqDocs: [] },
  { id: 'blocked', label: 'Blocked · GDPR', pill: 'negative',
    targets: [],
    fee: 'None until cleared',
    nextSteps: [
      'No referral, no intro, no estimate until specialist privacy counsel clears it',
      'Keep the record; do not pass contact details to any buyer' ],
    reqDocs: ['Written privacy-counsel clearance'] },
];
ALTR.laneById = function (id) { return ALTR.LANES.find(function (l) { return l.id === id; }) || null; };

/* Routing decision. Thresholds (decided 2026-11-16, resolving the docs/07 vs code conflict):
   >=20 employees + 3+ years -> tier1; 10-19 -> small; <10 -> small (3+ yrs) ; <3 yrs -> park.
   Status closed/winding -> dead. Transaction/POS flow -> altdata when not tier1-qualified. */
ALTR.route = function (x, est) {
  est = est || ALTR.estimate(x);
  if (est.blocked || x.eu) return 'blocked';
  if (x.status && x.status !== 'operating') return 'dead';
  if (x.emp >= 20 && x.yrs >= 3) return 'tier1';
  if (x.txflow) return 'altdata';
  if (x.yrs >= 3) return 'small';
  return 'park';
};

/* ================= lead codes (the bridge) ================= */
function b64encode(s) {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
  return Buffer.from(s, 'utf8').toString('base64');
}
function b64decode(s) {
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(s)));
  return Buffer.from(s, 'base64').toString('utf8');
}
ALTR.encodeLead = function (payload) {
  const body = b64encode(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'ALTR1.' + body;
};
ALTR.decodeLead = function (code) {
  code = String(code || '').trim();
  if (!/^ALTR1\./.test(code)) throw new Error('Not an ALTR lead code (must start with "ALTR1.").');
  let body = code.slice(6).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (body.length % 4) body += '=';
  let p;
  try { p = JSON.parse(b64decode(body)); } catch (e) { throw new Error('Lead code is corrupted — ask the sender to copy it again in full.'); }
  if (p.t !== 'lead' || p.v !== 1) throw new Error('Unrecognized lead-code format.');
  return p;
};

/* ================= compliance gates ================= */
/* 12-month attribution window, creator-referral-agreement.md §2.2 */
ALTR.attribExpiry = function (lead) {
  if (!lead.date) return null;
  const d = new Date(lead.date + 'T00:00:00');
  if (isNaN(d)) return null;
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/* Outstanding compliance items for one lead. Returns [{hot, t}]. */
ALTR.gates = function (lead) {
  const rows = [];
  const hasConsent = !!(lead.consent || lead.consentRec);
  const inPlay = !['Paid', 'Below floor', 'Blocked (GDPR)', 'Dead'].includes(lead.stage);
  if (!hasConsent && inPlay)
    rows.push({ hot: true, t: 'Consent to refer not recorded — get it before any buyer sees contact details' });
  if (lead.lane === 'altdata' && !lead.sfDoc && inPlay)
    rows.push({ hot: true, t: 'Alt-data lane: success-fee agreement must be signed BEFORE the intro (docs/07)' });
  if (lead.sfDoc && +lead.recd > 0 && lead.lane === 'tier1')
    rows.push({ hot: true, t: 'Both a success-fee agreement and a buyer referral fee on this lead — §2.4 requires disclosure, no double payment' });
  const exp = ALTR.attribExpiry(lead);
  if (exp && inPlay) {
    const days = Math.round((new Date(exp) - Date.now()) / 86400000);
    if (days <= 30 && days >= 0)
      rows.push({ hot: false, t: 'Attribution window (§2.2) expires in ' + days + ' days (' + exp + ')' });
    else if (days < 0)
      rows.push({ hot: true, t: 'Attribution window expired ' + exp + ' — creator split needs a manual call' });
  }
  return rows;
};

/* Blockers before a creator's unique funnel link may be issued. */
ALTR.creatorGates = function (c) {
  const out = [];
  if (!c.signed) out.push('Referral agreement not signed — sign before any post names the platform (§3)');
  if (!c.w9) out.push('W-9 not on file — required before payout, collect it up front');
  return out;
};

/* ================= shared formatting ================= */
ALTR.fmt = function (n) {
  n = +n || 0;
  if (n >= 1e6) return '$' + (Math.round(n / 50000) * 50000 / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 100000) return '$' + Math.round(n / 5000) * 5 + 'K';
  return '$' + Math.round(n / 1000) + 'K';
};

root.ALTR = ALTR;
})(typeof window !== 'undefined' ? window : globalThis);
