'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRestaurants } from '@/lib/useRestaurants';
import { usePeople } from '@/lib/useVisits';
import { getBrowserLocation } from '@/lib/geo';
import {
  DEFAULT_ANSWERS,
  DISTANCE_OPTIONS_KM,
  OCCASION_OPTIONS,
  applyHardConstraints,
  scoreCandidates,
  pickThree,
  pickThreeDifferent,
  pickOneForUs,
  suggestRelaxations,
  describeAnswers,
  type PickAnswers,
  type ScoredPick,
  type WhereMode,
  type NewOrRepeat,
} from '@/lib/pick';
import BottomNav from '@/components/BottomNav';
import PickResultCard from '@/components/PickResultCard';
import PickerSheet, { type PickerOption } from '@/components/PickerSheet';

type Step = 'where' | 'distance' | 'occasion' | 'cuisine' | 'new_or_repeat' | 'results';

const STEP_LABEL: Record<Exclude<Step, 'results'>, string> = {
  where: 'Where?',
  distance: 'How far?',
  occasion: "What's the vibe?",
  cuisine: 'What do you feel like?',
  new_or_repeat: "Something new, or somewhere we've been?",
};

function stepOrder(where: WhereMode, skipOccasion: boolean): Step[] {
  const base: Step[] =
    where === 'near'
      ? ['where', 'distance', 'occasion', 'cuisine', 'new_or_repeat', 'results']
      : ['where', 'occasion', 'cuisine', 'new_or_repeat', 'results'];
  return skipOccasion ? base.filter((s) => s !== 'occasion') : base;
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-xl border text-[15px] tap-highlight-none ${
        active
          ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
          : 'bg-forest-800/60 border-cream-300/15 text-cream-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function PickPage() {
  const { restaurants, loading, error, reload: reloadRestaurants } = useRestaurants();
  const { people } = usePeople();
  const [step, setStep] = useState<Step>('where');
  const [answers, setAnswers] = useState<PickAnswers>(DEFAULT_ANSWERS);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [areaSheetOpen, setAreaSheetOpen] = useState(false);
  const [cuisineSheetOpen, setCuisineSheetOpen] = useState(false);
  const [foodQueryDraft, setFoodQueryDraft] = useState('');
  const [shown, setShown] = useState<ScoredPick[]>([]);
  const [singlePick, setSinglePick] = useState<ScoredPick | null>(null);
  const [skipOccasion, setSkipOccasion] = useState(false);

  // Home's quick actions can hand off here with an occasion pre-decided
  // (see QuickActions.tsx) — read via the plain browser API rather than
  // next/navigation's useSearchParams, same reasoning as Explore: no
  // Suspense boundary needed under static export.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const occasion = params.get('occasion');
    if (occasion && OCCASION_OPTIONS.some((o) => o.key === occasion)) {
      setAnswers((a) => ({ ...a, occasion }));
      setSkipOccasion(true);
    }
  }, []);

  const facets = useMemo(() => {
    const cuisineCounts = new Map<string, number>();
    const areaCounts = new Map<string, number>();
    restaurants.forEach((r) => {
      if (r.closed) return;
      (r.cuisine || []).forEach((c) => cuisineCounts.set(c, (cuisineCounts.get(c) || 0) + 1));
      const area = r.suburb || r.city;
      if (area) areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
    });
    const cuisines = Array.from(cuisineCounts.entries()).sort((a, b) => b[1] - a[1]);
    const areas = Array.from(areaCounts.entries()).sort((a, b) => b[1] - a[1]);
    return { cuisines, areas };
  }, [restaurants]);

  const eligible = useMemo(() => applyHardConstraints(restaurants, answers), [restaurants, answers]);
  const scored = useMemo(() => scoreCandidates(eligible, answers), [eligible, answers]);
  const relaxations = useMemo(
    () => suggestRelaxations(restaurants, answers, eligible.length),
    [restaurants, answers, eligible.length]
  );

  function advanceAfter(currentStep: Step, patch: Partial<PickAnswers>) {
    const nextAnswers = { ...answers, ...patch };
    setAnswers(nextAnswers);
    const order = stepOrder(nextAnswers.where, skipOccasion);
    const idx = order.indexOf(currentStep);
    const next = order[idx + 1] || 'results';
    if (next === 'results') {
      const finalEligible = applyHardConstraints(restaurants, nextAnswers);
      const finalScored = scoreCandidates(finalEligible, nextAnswers);
      setShown(pickThree(finalScored));
      setSinglePick(null);
    }
    setStep(next);
  }

  function goBack() {
    const order = stepOrder(answers.where, skipOccasion);
    const idx = order.indexOf(step);
    if (idx <= 0) return;
    setStep(order[idx - 1]);
  }

  async function chooseNearMe() {
    setLocating(true);
    setLocationError(null);
    const coords = await getBrowserLocation();
    setLocating(false);
    if (coords) {
      setAnswers((a) => ({ ...a, where: 'near', coords, maxDistanceKm: a.maxDistanceKm ?? 5 }));
      setStep('distance');
    } else {
      setLocationError("Couldn't get your location — check permissions, or pick an area instead.");
    }
  }

  function refreshResults(nextAnswers: PickAnswers) {
    const finalEligible = applyHardConstraints(restaurants, nextAnswers);
    const finalScored = scoreCandidates(finalEligible, nextAnswers);
    setAnswers(nextAnswers);
    setShown(pickThree(finalScored));
    setSinglePick(null);
  }

  function handlePickOneForUs() {
    const one = pickOneForUs(scored);
    setSinglePick(one);
  }

  function handleGiveThreeDifferent() {
    const excludeIds = (singlePick ? [singlePick.restaurant.id] : shown.map((s) => s.restaurant.id));
    const different = pickThreeDifferent(scored, excludeIds);
    setSinglePick(null);
    setShown(different.length ? different : shown);
  }

  // Stage 6B: closes the Pick → Eat → Feedback loop. reloadRestaurants()
  // means the NEXT Pick run sees the restaurant's real new Tried status;
  // patching the currently-displayed card's status too means you don't
  // have to start over to see it reflected right away.
  function handleVisitSaved(restaurantId: number) {
    void reloadRestaurants();
    const patch = (s: ScoredPick): ScoredPick =>
      s.restaurant.id === restaurantId
        ? { ...s, restaurant: { ...s.restaurant, status: 'Tried' } }
        : s;
    setShown((prev) => prev.map(patch));
    setSinglePick((prev) => (prev ? patch(prev) : prev));
  }

  function startOver() {
    setAnswers(DEFAULT_ANSWERS);
    setFoodQueryDraft('');
    setShown([]);
    setSinglePick(null);
    setLocationError(null);
    setSkipOccasion(false);
    setStep('where');
  }

  const cuisineOptions: PickerOption[] = facets.cuisines.map(([c, n]) => ({ value: c, label: c, count: n }));
  const areaOptions: PickerOption[] = facets.areas.map(([a, n]) => ({ value: a, label: a, count: n }));
  const topCuisines = facets.cuisines.slice(0, 6);

  return (
    <main className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto min-h-screen pb-24">
      <header className="px-4 pt-safe-top pt-8 pb-2 flex items-center gap-3">
        {step !== 'where' && step !== 'results' && (
          <button onClick={goBack} className="text-cream-300/60 tap-highlight-none" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-400/80 mb-0.5">My Food List</p>
          <h1 className="font-serif text-[22px] leading-tight text-cream-50">
            {step === 'results' ? 'Pick for me' : STEP_LABEL[step]}
          </h1>
        </div>
      </header>

      {loading && <p className="text-cream-300/50 text-sm py-8 text-center">Loading your list…</p>}
      {error && <p className="text-red-300 text-sm py-8 text-center">{error}</p>}

      {!loading && !error && step === 'where' && (
        <section className="px-4 mt-2 flex flex-col gap-2.5">
          <OptionButton active={locating} onClick={chooseNearMe}>
            {locating ? 'Finding you…' : '📍 Near me'}
          </OptionButton>
          <OptionButton active={answers.where === 'area'} onClick={() => setAreaSheetOpen(true)}>
            🧭 Choose an area
          </OptionButton>
          <OptionButton
            active={answers.where === 'anywhere'}
            onClick={() => advanceAfter('where', { where: 'anywhere', coords: null, area: null })}
          >
            🗺️ Anywhere
          </OptionButton>
          {locationError && <p className="text-[12.5px] text-cream-300/60 mt-1">{locationError}</p>}
        </section>
      )}

      {!loading && !error && step === 'distance' && (
        <section className="px-4 mt-2 flex flex-col gap-2.5">
          {DISTANCE_OPTIONS_KM.map((km) => (
            <OptionButton
              key={km}
              active={answers.maxDistanceKm === km}
              onClick={() => advanceAfter('distance', { maxDistanceKm: km })}
            >
              Within {km} km
            </OptionButton>
          ))}
        </section>
      )}

      {!loading && !error && step === 'occasion' && (
        <section className="px-4 mt-2 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => advanceAfter('occasion', { occasion: null })}
            className={`col-span-2 text-center px-4 py-3.5 rounded-xl border text-[15px] tap-highlight-none ${
              answers.occasion === null
                ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                : 'bg-forest-800/60 border-cream-300/15 text-cream-50'
            }`}
          >
            Anything
          </button>
          {OCCASION_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => advanceAfter('occasion', { occasion: o.key })}
              className="text-center px-3 py-3.5 rounded-xl border bg-forest-800/60 border-cream-300/15 text-cream-50 text-[14px] tap-highlight-none"
            >
              {o.label}
            </button>
          ))}
        </section>
      )}

      {!loading && !error && step === 'cuisine' && (
        <section className="px-4 mt-2">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setAnswers((a) => ({ ...a, cuisine: null }))}
              className={`col-span-2 text-center px-4 py-3.5 rounded-xl border text-[15px] tap-highlight-none ${
                answers.cuisine === null
                  ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                  : 'bg-forest-800/60 border-cream-300/15 text-cream-50'
              }`}
            >
              Anything
            </button>
            {topCuisines.map(([c]) => (
              <button
                key={c}
                onClick={() => setAnswers((a) => ({ ...a, cuisine: c }))}
                className={`text-center px-3 py-3.5 rounded-xl border text-[14px] tap-highlight-none ${
                  answers.cuisine === c
                    ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                    : 'bg-forest-800/60 border-cream-300/15 text-cream-50'
                }`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => setCuisineSheetOpen(true)}
              className="text-center px-3 py-3.5 rounded-xl border border-dashed border-cream-300/25 text-cream-300/70 text-[14px] tap-highlight-none"
            >
              More…
            </button>
          </div>

          <div className="mt-4">
            <label className="text-xs uppercase tracking-wide text-cream-300/50 mb-2 block">
              Or a dish/tag (optional)
            </label>
            <input
              value={foodQueryDraft}
              onChange={(e) => setFoodQueryDraft(e.target.value)}
              placeholder="ramen, steak, pizza…"
              className="w-full bg-forest-800/70 border border-cream-300/15 rounded-full px-4 py-2.5 text-[14px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
            />
          </div>

          <button
            onClick={() => advanceAfter('cuisine', { foodQuery: foodQueryDraft })}
            className="w-full mt-4 py-3 rounded-xl bg-gold-500 text-forest-950 text-[14.5px] font-semibold tap-highlight-none"
          >
            Continue
          </button>
        </section>
      )}

      {!loading && !error && step === 'new_or_repeat' && (
        <section className="px-4 mt-2 flex flex-col gap-2.5">
          {(
            [
              ['new', '✨ Something new'],
              ['repeat', '🔁 Go back somewhere'],
              ['either', 'Either'],
            ] as [NewOrRepeat, string][]
          ).map(([key, label]) => (
            <OptionButton
              key={key}
              active={answers.newOrRepeat === key}
              onClick={() => advanceAfter('new_or_repeat', { newOrRepeat: key, includeVisitAgainNo: false })}
            >
              {label}
            </OptionButton>
          ))}
        </section>
      )}

      {!loading && !error && step === 'results' && (
        <section className="px-4 mt-2">
          {singlePick ? (
            <>
              <p className="text-[12.5px] text-cream-300/50 mb-3">
                From your strongest matches, we picked one:
              </p>
              <PickResultCard
                picked={singlePick}
                answers={answers}
                people={people}
                onVisitSaved={() => handleVisitSaved(singlePick.restaurant.id)}
              />
              <div className="flex gap-2.5 mt-3">
                <button
                  onClick={handlePickOneForUs}
                  className="flex-1 py-3 rounded-xl bg-forest-800/70 border border-cream-300/15 text-cream-100 text-[13.5px] tap-highlight-none"
                >
                  Pick again
                </button>
                <button
                  onClick={() => setSinglePick(null)}
                  className="flex-1 py-3 rounded-xl bg-forest-800/70 border border-cream-300/15 text-cream-100 text-[13.5px] tap-highlight-none"
                >
                  Show 3 options
                </button>
              </div>
            </>
          ) : eligible.length === 0 ? (
            <div>
              <p className="text-[14px] text-cream-100/85 leading-relaxed">
                Nothing saved matches {describeAnswers(answers)} yet.
              </p>
              {relaxations.length > 0 && (
                <div className="flex flex-col gap-2 mt-4">
                  {relaxations.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => refreshResults(opt.next)}
                      className="text-left px-4 py-3 rounded-xl bg-forest-800/60 border border-cream-300/15 text-cream-100 text-[13.5px] tap-highlight-none"
                    >
                      {opt.label} <span className="text-cream-300/40">({opt.resultingCount})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {eligible.length < 3 && (
                <div className="mb-4 p-3.5 rounded-xl bg-forest-800/50 border border-cream-300/10">
                  <p className="text-[13.5px] text-cream-100/85">
                    Only {eligible.length} saved restaurant{eligible.length === 1 ? '' : 's'} match{' '}
                    {describeAnswers(answers)}.
                  </p>
                  {relaxations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {relaxations.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => refreshResults(opt.next)}
                          className="px-3 py-1.5 rounded-full text-[12.5px] bg-forest-900/60 border border-cream-300/15 text-cream-100 tap-highlight-none"
                        >
                          {opt.label} ({opt.resultingCount})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {shown.map((s) => (
                  <PickResultCard
                    key={s.restaurant.id}
                    picked={s}
                    answers={answers}
                    people={people}
                    onVisitSaved={() => handleVisitSaved(s.restaurant.id)}
                  />
                ))}
              </div>

              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={handlePickOneForUs}
                  className="flex-1 py-3 rounded-xl bg-gold-500 text-forest-950 text-[13.5px] font-semibold tap-highlight-none"
                >
                  🎲 Pick one for us
                </button>
                {scored.length > 3 && (
                  <button
                    onClick={handleGiveThreeDifferent}
                    className="flex-1 py-3 rounded-xl bg-forest-800/70 border border-cream-300/15 text-cream-100 text-[13.5px] tap-highlight-none"
                  >
                    Give me 3 different ones
                  </button>
                )}
              </div>
            </>
          )}

          <button
            onClick={startOver}
            className="w-full mt-3 py-2.5 text-[13px] text-cream-300/50 tap-highlight-none"
          >
            Start over
          </button>
        </section>
      )}

      <PickerSheet
        open={areaSheetOpen}
        title="Choose an area"
        options={areaOptions}
        onClose={() => setAreaSheetOpen(false)}
        onSelect={(value) => {
          setAreaSheetOpen(false);
          advanceAfter('where', { where: 'area', area: value, coords: null });
        }}
      />
      <PickerSheet
        open={cuisineSheetOpen}
        title="Choose a cuisine"
        options={cuisineOptions}
        onClose={() => setCuisineSheetOpen(false)}
        onSelect={(value) => {
          setCuisineSheetOpen(false);
          setAnswers((a) => ({ ...a, cuisine: value }));
        }}
      />

      <BottomNav />
    </main>
  );
}
