// Stage 7C — Pick for Me geography tests.   Run:  node tests/pick-geography.test.cjs
//
// Runs the REAL engine (src/lib/pick.ts) against live catalogue data (read-only, publishable key) and checks
// results against an INDEPENDENT haversine + set computation written here, so the tests don't just echo the
// code under test. Synthetic cases cover "no hard-coded suburbs" and "scoring can never rescue an outsider".
// Offline? Live-data sections are skipped automatically; synthetic sections still run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pick } = require('./_load-pick.cjs');
const P = pick();

const URL_ = process.env.SUPABASE_URL || 'https://vcsbitkftcnyywfodrue.supabase.co';
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_x2rTn8wapImzr707MT7wxw_qOs9U40s';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n        ' + String(e.message).split('\n').join('\n        ')); }
}
const ids = (list) => list.map((r) => (r.restaurant ? r.restaurant.id : r.id)).sort((a, b) => a - b);

// independent ground truth ---------------------------------------------------------------
const rad = (d) => (d * Math.PI) / 180;
function km(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const open = (rs) => rs.filter((r) => !r.closed);
const key = (r) => (r.suburb || r.city || '').trim().toLowerCase();
const verified = (r) => r.latitude != null && r.longitude != null && r.location_precision === 'address';
function centroid(rs, area) {
  const pts = open(rs).filter((r) => key(r) === area.toLowerCase() && verified(r));
  return { lat: pts.reduce((s, r) => s + r.latitude, 0) / pts.length, lon: pts.reduce((s, r) => s + r.longitude, 0) / pts.length };
}
const A = (over) => ({ ...P.DEFAULT_ANSWERS, ...over });
const R = (id, over) => ({
  id, name: 'R' + id, suburb: 'X', city: 'Sydney', region: null, cuisine: ['Thai'], venue_type: [], occasions: [], tags: [], priority: 'NORMAL',
  status: 'Want to try', summary: null, user_notes: null, source_notes: null, rating: null, closed: false, latitude: null, longitude: null,
  location_precision: null, visit_again: null, last_visited_at: null, is_favourite: false, really_want_to_try: false, dishes: [], ...over,
});

(async () => {
  // =================== source-level guarantees ===================
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pick.ts'), 'utf8');
  test('engine source names no suburb (expansion is coordinate-based, not a hard-coded list)', () => {
    for (const s of ['Leonards', 'Wollstonecraft', 'Cammeray', 'Naremburn', 'North Sydney', 'Fairfield', 'Burwood', 'Parramatta', 'Crows Nest', 'Chatswood'])
      assert.ok(!src.includes(s), `pick.ts mentions "${s}"`);
  });
  test('geography is its own first stage and cuisine/status filters come after it', () => {
    const body = src.slice(src.indexOf('export function applyHardConstraints'));
    assert.ok(body.indexOf('applyGeography(') < body.indexOf('answers.cuisine'), 'geography must precede cuisine');
    assert.ok(body.indexOf('answers.cuisine') < body.indexOf('answers.newOrRepeat'), 'cuisine before status');
  });

  // =================== synthetic: strictness, no rescue, no hard-coded names ===================
  // A made-up geography far from Sydney, to prove expansion uses coordinates only.
  const MEL = [
    R(1, { suburb: 'Zedtown', latitude: -37.8000, longitude: 144.9600, location_precision: 'address' }),
    R(2, { suburb: 'Zedtown', latitude: -37.8010, longitude: 144.9620, location_precision: 'address' }),
    R(3, { suburb: 'Nexton', latitude: -37.8200, longitude: 144.9700, location_precision: 'address' }),   // ~2.4 km
    R(4, { suburb: 'Farvale', latitude: -37.8600, longitude: 144.9900, location_precision: 'address' }),  // ~7 km
    R(5, { suburb: 'Remoteburg', latitude: -38.2000, longitude: 145.2000, location_precision: 'address' }), // ~50 km
    R(6, { suburb: 'Nexton', latitude: -37.8190, longitude: 144.9690, location_precision: 'suburb' }),      // not a verified point
  ];
  test('synthetic: exact area = only that suburb (2 qualify -> 2 shown, not padded to 3)', () => {
    const e = P.applyHardConstraints(MEL, A({ where: 'area', area: 'Zedtown' }));
    assert.deepEqual(ids(e), [1, 2]);
    assert.equal(P.pickThree(P.scoreCandidates(e, A({ where: 'area', area: 'Zedtown' }))).length, 2);
  });
  test('synthetic: expand nearby uses coordinates (names are invented) and only verified points', () => {
    const e = P.applyHardConstraints(MEL, A({ where: 'area', area: 'Zedtown', areaRadiusKm: 3 }));
    assert.deepEqual(ids(e), [1, 2, 3]);                    // 3 yes (~2.4km); 4 (~7km), 5 (~50km), 6 (unverified point) no
    const e2 = P.applyHardConstraints(MEL, A({ where: 'area', area: 'Zedtown', areaRadiusKm: 6 }));
    assert.deepEqual(ids(e2), [1, 2, 3]);
    assert.ok(!ids(e2).includes(5), '50 km away never appears');
  });
  test('synthetic: an outsider with every strong signal can NEVER be rescued (area, near)', () => {
    const star = R(99, { suburb: 'Remoteburg', latitude: -38.2, longitude: 145.2, location_precision: 'address', is_favourite: true,
      really_want_to_try: true, priority: 'VERY HIGH', rating: 10, status: 'Tried', visit_again: 'yes', occasions: ['Date night'], tags: ['ramen'],
      dishes: [{ id: 1, restaurant_id: 99, name: 'ramen', description: null, must_order: true, dish_status: 'known_for', liked: true }] });
    const pool = [...MEL.slice(0, 2), star];
    for (const ans of [
      A({ where: 'area', area: 'Zedtown', occasion: 'date_night', foodQuery: 'ramen', cuisine: 'Thai' }),
      A({ where: 'area', area: 'Zedtown', areaRadiusKm: 6, occasion: 'date_night', foodQuery: 'ramen' }),
      A({ where: 'near', coords: { lat: -37.8, lon: 144.96 }, maxDistanceKm: 5, occasion: 'date_night', foodQuery: 'ramen' }),
    ]) {
      const e = P.applyHardConstraints(pool, ans);
      assert.ok(!ids(e).includes(99), 'outsider survived the geographic filter');
      const scored = P.scoreCandidates(e, ans);
      assert.ok(!ids(scored).includes(99) && !ids(P.pickThree(scored)).includes(99));
    }
  });
  test('synthetic: missing area / coords / radius means NOBODY qualifies (never "everyone")', () => {
    assert.deepEqual(P.applyHardConstraints(MEL, A({ where: 'area', area: null })), []);
    assert.deepEqual(P.applyHardConstraints(MEL, A({ where: 'area', area: '   ' })), []);
    assert.deepEqual(P.applyHardConstraints(MEL, A({ where: 'near', coords: null, maxDistanceKm: 5 })), []);
    assert.deepEqual(P.applyHardConstraints(MEL, A({ where: 'near', coords: { lat: -37.8, lon: 144.96 }, maxDistanceKm: null })), []);
  });
  test('synthetic: an area with no verified coordinates offers Anywhere only (no ring to expand)', () => {
    const NOPT = [R(1, { suburb: 'Ghost' }), R(2, { suburb: 'Elsewhere', latitude: -37.8, longitude: 144.96, location_precision: 'address' })];
    const ans = A({ where: 'area', area: 'Ghost' });
    const e = P.applyHardConstraints(NOPT, ans);
    assert.deepEqual(ids(e), [1]);
    const opts = P.suggestRelaxations(NOPT, ans, e.length).map((o) => o.key);
    assert.deepEqual(opts, ['anywhere']);
  });
  test('synthetic: engine never mutates the answers it is given (no silent widening)', () => {
    const ans = Object.freeze(A({ where: 'area', area: 'Zedtown' }));
    const e = P.applyHardConstraints(MEL, ans); P.scoreCandidates(e, ans); P.suggestRelaxations(MEL, ans, e.length); P.describeAnswers(ans);
    assert.equal(ans.areaRadiusKm, null);
  });

  // =================== live catalogue ===================
  let all;
  try {
    const hdr = { apikey: KEY };
    const rs = await (await fetch(URL_ + '/rest/v1/restaurants?select=*&order=name.asc', { headers: hdr })).json();
    const ds = await (await fetch(URL_ + '/rest/v1/dishes?select=*', { headers: hdr })).json();
    if (!Array.isArray(rs) || !rs.length) throw new Error('no data');
    const by = {}; ds.forEach((d) => (by[d.restaurant_id] ||= []).push(d));
    all = rs.map((r) => ({ ...r, dishes: by[r.id] || [] }));
  } catch (e) { console.log('\n(live data unavailable — skipping live sections: ' + e.message + ')'); }

  if (all) {
    console.log(`\nLIVE catalogue: ${all.length} restaurants (${open(all).length} open)`);
    const CN = 'Crows Nest';
    const exactCN = open(all).filter((r) => key(r) === 'crows nest');

    test('Crows Nest initial search returns Crows Nest ONLY (no Fairfield, nothing from anywhere else)', () => {
      const e = P.applyHardConstraints(all, A({ where: 'area', area: CN }));
      assert.deepEqual(ids(e), ids(exactCN));
      assert.ok(e.length > 0 && e.every((r) => r.suburb === CN));
      assert.ok(!e.some((r) => /fairfield|burwood|parramatta/i.test(r.suburb)));
    });
    test('fewer than 3 exact matches are NOT padded (shown = qualified, 1 or 2 stay 1 or 2, 0 stays 0)', () => {
      const ans = A({ where: 'area', area: CN });
      const e = P.applyHardConstraints(all, ans);
      assert.ok(e.length < 3);
      assert.equal(P.pickThree(P.scoreCandidates(e, ans)).length, e.length);
      const one = A({ where: 'area', area: CN, cuisine: 'Japanese' });
      const e1 = P.applyHardConstraints(all, one);
      assert.equal(P.pickThree(P.scoreCandidates(e1, one)).length, e1.length);
      const none = A({ where: 'area', area: CN, cuisine: 'Greek-nonexistent' });
      assert.equal(P.pickThree(P.scoreCandidates(P.applyHardConstraints(all, none), none)).length, 0);
    });
    test('selecting "Sydney" no longer matches every restaurant whose city is Sydney (city-name leak closed)', () => {
      const e = P.applyHardConstraints(all, A({ where: 'area', area: 'Sydney' }));
      assert.deepEqual(ids(e), ids(open(all).filter((r) => key(r) === 'sydney')));
      assert.ok(e.length < 10, `got ${e.length}`);
      assert.ok(!e.some((r) => /fairfield/i.test(r.suburb)));
    });

    const centre = centroid(all, CN);
    for (const radius of P.AREA_EXPANSION_KM) {
      test(`Expand (${radius} km): exactly the suburb + verified points within ${radius} km of its centre — verified against independent haversine`, () => {
        const e = P.applyHardConstraints(all, A({ where: 'area', area: CN, areaRadiusKm: radius }));
        const want = new Set(open(all).filter((r) => key(r) === 'crows nest' || (verified(r) && km(centre, { lat: r.latitude, lon: r.longitude }) <= radius)).map((r) => r.id));
        assert.deepEqual(ids(e), [...want].sort((a, b) => a - b));
        assert.ok(ids(exactCN).every((i) => ids(e).includes(i)), 'expansion is a superset of exact');
        for (const r of e) if (key(r) !== 'crows nest') assert.ok(km(centre, { lat: r.latitude, lon: r.longitude }) <= radius + 1e-9, `${r.suburb} beyond radius`);
        assert.ok(!e.some((r) => /fairfield|burwood|parramatta|bankstown/i.test(r.suburb)), 'distant suburbs never appear');
      });
    }
    test('Expand nearby only brings in genuinely nearby places (list for the record)', () => {
      const e = P.applyHardConstraints(all, A({ where: 'area', area: CN, areaRadiusKm: P.AREA_EXPANSION_KM[0] }));
      const bySub = {}; e.forEach((r) => (bySub[r.suburb] ||= []).push(+r.areaDistanceKm.toFixed(1)));
      console.log('        ' + P.AREA_EXPANSION_KM[0] + ' km ring around Crows Nest ->', JSON.stringify(bySub));
      assert.ok(e.every((r) => r.areaDistanceKm != null && r.areaDistanceKm <= P.AREA_EXPANSION_KM[0]));
    });

    test('Near Me 2/5/10/20 km: nothing beyond the radius ever appears; matches independent distance set', () => {
      for (const origin of [{ lat: centre.lat, lon: centre.lon }, { lat: -33.8688, lon: 151.2093 }, { lat: -33.8726, lon: 150.9559 }]) {
        for (const maxKm of P.DISTANCE_OPTIONS_KM) {
          const e = P.applyHardConstraints(all, A({ where: 'near', coords: origin, maxDistanceKm: maxKm }));
          const want = open(all).filter((r) => verified(r) && km(origin, { lat: r.latitude, lon: r.longitude }) <= maxKm).map((r) => r.id).sort((a, b) => a - b);
          assert.deepEqual(ids(e), want, `radius ${maxKm} from ${JSON.stringify(origin)}`);
          assert.ok(e.every((r) => km(origin, { lat: r.latitude, lon: r.longitude }) <= maxKm + 1e-9));
        }
      }
    });
    test('Near Me 5 km never returns anything > 5 km (explicit)', () => {
      const e = P.applyHardConstraints(all, A({ where: 'near', coords: centre, maxDistanceKm: 5 }));
      assert.ok(e.length > 0 && Math.max(...e.map((r) => km(centre, { lat: r.latitude, lon: r.longitude }))) <= 5);
    });
    test('Near Me with too few results shows fewer than 3 and OFFERS (not applies) a wider radius', () => {
      const ans = Object.freeze(A({ where: 'near', coords: centre, maxDistanceKm: 2, cuisine: 'Japanese' }));
      const e = P.applyHardConstraints(all, ans);
      assert.ok(e.length < 3, `expected <3, got ${e.length}`);
      assert.equal(P.pickThree(P.scoreCandidates(e, ans)).length, e.length, 'not padded');
      const opts = P.suggestRelaxations(all, ans, e.length);
      const ring = opts.find((o) => o.key === 'expand_distance');
      assert.ok(ring && ring.next.maxDistanceKm > 2 && ring.resultingCount > e.length, 'a wider radius is offered');
      assert.ok(!opts.some((o) => o.key === 'anywhere'), 'Anywhere not offered while a wider radius still helps');
      assert.equal(ans.maxDistanceKm, 2, 'the active radius is untouched until the user taps');
      console.log('        2 km Japanese from Crows Nest:', e.length, 'result(s); offers', opts.map((o) => `${o.label} (${o.resultingCount})`));
    });
    test('Near Me in an isolated spot (nothing more to find) offers nothing misleading and still never pads', () => {
      const ans = A({ where: 'near', coords: { lat: -33.8726, lon: 150.9559 }, maxDistanceKm: 2, cuisine: 'Iraqi' });
      const e = P.applyHardConstraints(all, ans);
      assert.equal(P.pickThree(P.scoreCandidates(e, ans)).length, e.length);
      assert.ok(P.suggestRelaxations(all, ans, e.length).every((o) => o.resultingCount > e.length));
    });

    test('Expand further is offered ONLY after the first explicit expansion; Anywhere is held back until then', () => {
      // a state where exact < 3 and the first ring helps
      const base = A({ where: 'area', area: CN, cuisine: 'Japanese' });
      const e0 = P.applyHardConstraints(all, base);
      const o0 = P.suggestRelaxations(all, base, e0.length).map((o) => o.key);
      assert.ok(!o0.includes('expand_further'), 'no "Expand further" at exact-suburb stage: ' + o0);
      const nearby = P.suggestRelaxations(all, base, e0.length).find((o) => o.key === 'expand_nearby');
      if (nearby) {
        assert.ok(!o0.includes('anywhere'), 'Anywhere not offered alongside the first expansion: ' + o0);
        const afterTap = nearby.next;                       // simulate the explicit tap
        const e1 = P.applyHardConstraints(all, afterTap);
        const o1 = P.suggestRelaxations(all, afterTap, e1.length).map((o) => o.key);
        assert.ok(!o1.includes('expand_nearby'));
        console.log('        exact -> offers', o0, '| after tap ->', e1.length, 'results, offers', o1);
      }
    });
    test('every geographic option is an unapplied proposal; nothing changes until the user taps', () => {
      const ans = Object.freeze(A({ where: 'area', area: CN, cuisine: 'Japanese' }));
      const before = JSON.stringify(P.applyHardConstraints(all, ans).map((r) => r.id));
      P.suggestRelaxations(all, ans, 1);
      assert.equal(JSON.stringify(P.applyHardConstraints(all, ans).map((r) => r.id)), before);
    });

    test('Anywhere still uses the full open catalogue (and ignores a stale area)', () => {
      const e = P.applyHardConstraints(all, A({ where: 'anywhere', area: CN, areaRadiusKm: 3 }));
      assert.deepEqual(ids(e), ids(open(all)));
      assert.ok(e.some((r) => /fairfield/i.test(r.suburb)));
    });

    // Pick one / Give me 3 different ones — always inside the CURRENT geography
    const pools = [
      ['exact Crows Nest', A({ where: 'area', area: CN })],
      ['expanded Crows Nest (3 km)', A({ where: 'area', area: CN, areaRadiusKm: 3 })],
      ['expanded Crows Nest (6 km)', A({ where: 'area', area: CN, areaRadiusKm: 6 })],
      ['near 5 km', A({ where: 'near', coords: centre, maxDistanceKm: 5 })],
    ];
    for (const [label, ans] of pools) {
      test(`Pick one + Give me 3 different ones stay inside geography — ${label}`, () => {
        const e = P.applyHardConstraints(all, ans); const inPool = new Set(ids(e));
        const scored = P.scoreCandidates(e, ans);
        const shown = P.pickThree(scored);
        assert.ok(ids(shown).every((i) => inPool.has(i)));
        for (let i = 0; i < 300; i++) {                      // many random draws
          const one = P.pickOneForUs(scored, () => (i % 97) / 97);
          if (one) assert.ok(inPool.has(one.restaurant.id), 'pick-one escaped');
        }
        const diff = P.pickThreeDifferent(scored, ids(shown));
        assert.ok(ids(diff).every((i) => inPool.has(i) && !ids(shown).includes(i)));
        const diff2 = P.pickThreeDifferent(scored, [...ids(shown), ...ids(diff)]);
        assert.ok(ids(diff2).every((i) => inPool.has(i)));
        // and with the geography wall, every card is in the permitted place
        if (ans.where === 'area') for (const s of [...shown, ...diff]) {
          if (ans.areaRadiusKm == null) assert.equal(key(s.restaurant), 'crows nest');
          else assert.ok(key(s.restaurant) === 'crows nest' || km(centre, { lat: s.restaurant.latitude, lon: s.restaurant.longitude }) <= ans.areaRadiusKm);
        }
      });
    }

    test('expanded results explain themselves: nearby-suburb picks say how far from Crows Nest; in-suburb picks do not', () => {
      const ans = A({ where: 'area', area: CN, areaRadiusKm: 3 });
      const scored = P.scoreCandidates(P.applyHardConstraints(all, ans), ans);
      const outside = scored.find((s) => key(s.restaurant) !== 'crows nest');
      const inside = scored.find((s) => key(s.restaurant) === 'crows nest');
      assert.ok(outside && /from Crows Nest/.test(P.explainPick(outside, ans)), P.explainPick(outside, ans));
      assert.ok(inside && !/from Crows Nest/.test(P.explainPick(inside, ans)));
      assert.ok(P.describeAnswers(ans).includes('within about 3 km of Crows Nest'));
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
