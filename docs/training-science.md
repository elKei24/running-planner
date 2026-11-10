# Training principles encoded in the planner

This is the rationale for the numbers in `src/planner/`. Where a number is a judgement call rather
than a finding, it says so. Sources are listed at the end.

## Volume progression

- **No more than ~10 % increase per week** (`MAX_WEEKLY_RAMP = 1.1`). The "10 % rule" has weak
  direct evidence but is the consensus guard rail for overuse injury, and the planner never exceeds
  it. Within that limit the ramp is spread evenly over the available weeks, so a long build ramps at
  3–5 %/week rather than 10 %.
- **Step-back weeks every fourth week** at 80 % of the surrounding weeks (`STEP_BACK_FACTOR`).
  Periodic unloading is standard practice in every mainstream marathon programme (Pfitzinger,
  Daniels, Hudson). The last two peak weeks are never step-backs so the biggest week comes right
  before the taper.
- **Acute load relative to chronic load.** Rather than a rolling average ACWR (which has well-known
  artefacts, see Impellizzeri et al. 2020), the planner keeps a single "sustainable level" that
  responds to each completed week: unchanged within ±15 %, +10 % at most, and down to −30 % for a
  week with no running. One week off → about 75 % of the previous level; two weeks → about 50 %.
  These are the usual return-to-running numbers after a short layoff.

## Returning after a layoff

- A completed week with less than half the expected load counts as a layoff week. After one, the
  next week has no quality sessions; after two or more, the next two weeks are easy only
  (`layoffWeeks`, ADR 0010). Volume is handled separately by the level response.

## Intensity distribution

- **Roughly 80/20.** At most two quality sessions per week and only when the athlete runs five or
  more days (`qualityKinds`). Quality sessions include warm-up and cool-down, so the hard portion is
  about 10–15 % of weekly volume plus marathon-pace segments in long runs. Seiler's work on
  polarised / pyramidal distributions in endurance athletes is the basis.
- **Session types by phase.** Base: one controlled tempo. Build: threshold tempo and 1 km VO2max
  intervals alternating week to week. Peak: marathon-pace runs and threshold, with the long run
  finishing at marathon pace every other week. Taper: a short interval session (≤ 5 × 1 km) in the
  first taper week, then a short tempo, so intensity is kept while volume drops.
- **Paces from Daniels' VDOT** (Daniels & Gilbert 1979). Easy 62–74 % VO2max, threshold 83–88 %,
  intervals 95–100 %, marathon pace from the predicted marathon time. These are the textbook zones;
  the marathon zone is ±2 % around the equal-effort prediction.
- **Strides** on the easy day before a quality session from the build phase on (neuromuscular
  stimulus, negligible fatigue).
- **Hard days apart, runs spread out.** The run days of a week are the most evenly spread set
  of available days. A single quality session goes where it is three days clear of the long runs
  on both sides (Wednesday for a Sunday long run, Thursday when Wednesday is taken); two quality
  sessions keep two days from the long run and from each other. The days next to the long run
  stay free while they can, and ties go to the earlier day so that a missed session can still be
  made up that week (`chooseRunDays`, ADR 0020).

## Long runs

- **Share of weekly volume depends on the volume** (`longRunFraction`): 45 % at 40 km/week down to
  33 % at 100 km/week in the peak phase, scaled down in base/build/taper. Capped at 35 km and at
  about 3.5 hours at easy pace. Longer than that adds damage faster than fitness for most
  amateurs. See ADR 0011 for the reasoning and the published plans it was checked against.
- **Never below what you already run** (ADR 0014): the recent longest run (declared, then from
  the log) is a floor for every week's long run, up to 60 % of that week. The plan starts from
  your habit and grows from there; reduced weeks still shrink it.
- **Marathon floor in the peak phase** (ADR 0013): for goals over 40 km, peak long runs are at
  least min(32 km, 50 % of the week), progressing 28 → 30 → 32 km. Moderate-volume marathoners
  need the distance more than the share rule allows; 50 % of the week is the accepted ceiling.
- **Marathon-pace finishes progress** through the peak phase: every other long run (and the last
  one) ends with 30 % → 40 % → 50 % of its distance at goal pace (`marathonPaceShare`, ADR 0012).
- **Growth capped relative to what was recently done**: the first long run is at most 3 km longer
  than the longest run of the last four weeks, then +2.5 km per ramp week. This is the adaptive
  counterpart of the volume rule and is what prevents a 30 km long run appearing after a month off.
- The long run is always the longest run of the week; easy runs are capped by it.

## Taper

- **Two to three weeks, volume reduced progressively to 35 % of peak in race week, intensity and
  frequency maintained** (`taperFractions`). Bosquet et al. 2007 (meta-analysis): a 41–60 % reduction
  in volume over about two weeks without reducing intensity or frequency gives the best performance
  gain (~2–3 %). Three weeks is used for plans of 16+ weeks because the peak weeks are bigger.
- **Race week pattern** (`RACE_WEEK_PATTERN`): short marathon-pace tune-up four days out, rest two
  days out, a 15–20 minute shakeout the day before. Fixed pattern, pro-rated to the race-week budget.

## Tune-up races

- **Tune-up ("B") races** replace the long run of their week, get three easier days before and
  about 0.4 days of no hard running per km raced afterwards (5 km → 2 days, half marathon → 9 days,
  capped at 14). The weekly volume is reduced to 85 % that week. This follows the common "one easy
  day per mile raced" heuristic, scaled down slightly because recovery days are easy, not off.
- **Low-key ("C") races** are treated as the week's hard workout: the day before and after lose any
  quality session, nothing else changes.
- A warning is raised when a tune-up race falls inside the taper.

## Heart-rate guidance

- **Bands as a share of maximum heart rate** (`domain/heartRate.ts`): easy and long runs 65–79 %,
  marathon pace 80–90 %, threshold 88–92 %, intervals 95–100 %. These are Daniels' HRmax ranges for
  the E, M, T and I zones (Daniels 2014); recovery runs at 60–70 % sit below the easy band and are a
  judgement call. Races get no band: the right intensity depends on the distance.
- **Why max heart rate, not resting or lactate threshold.** It is the one number most runners know
  or can measure in a hard 5 km or hill repeats. Formulas such as 220 minus age have a standard
  deviation of about 10 bpm (Tanaka et al. 2001), so the form asks for a measured value and leaves
  the field optional.
- **Heart rate lags and drifts.** It takes a few minutes to reach the band at the start of a run and
  climbs with heat, dehydration and duration (cardiovascular drift), so the planner presents the band
  next to pace and RPE as a cross-check, never as the primary target.

## Periodisation

Two build strategies (ADR 0015). **Steady** spreads the ramp evenly over the available weeks and
suits 8–24 weeks. **Build fast, then maintain** (default beyond 24 weeks) ramps to peak volume in
about 16 weeks at up to 10 %/week, holds ~90 % of peak with step-backs and alternating tempo and
interval work, then runs a 12-week marathon block (6 build + 3 peak + 3 taper). Long maintenance
periods are where tune-up races belong.

Weeks are allocated backwards from race day: taper (1–3 weeks), peak (0–3), then build and base
split the remainder (`periodize`). With fewer than 8 weeks the plan is compressed and the athlete is
warned; with fewer than 12 weeks a milder warning is shown. 16–18 weeks is the comfortable range.

## Known simplifications

- Heart rate is guidance only. When the athlete enters a maximum heart rate, planned runs show a
  band derived from it (below); logged heart rate is not recorded and does not steer the plan. No
  power data.
- No heat/altitude adjustment.
- Cross-training is not modelled; a blocked day is simply no running.
- Long-run time cap uses the middle of the easy zone, not the athlete's actual long-run pace.

## Sources

- Daniels, J. & Gilbert, J. (1979). *Oxygen Power: Performance Tables for Distance Runners.*
- Daniels, J. (2014). *Daniels' Running Formula*, 3rd ed. Human Kinetics.
- Tanaka, H., Monahan, K. D. & Seals, D. R. (2001). Age-predicted maximal heart rate revisited.
  *J Am Coll Cardiol* 37(1):153–6.
- Pfitzinger, P. & Douglas, S. (2019). *Advanced Marathoning*, 3rd ed. Human Kinetics.
- Bosquet, L. et al. (2007). Effects of tapering on performance: a meta-analysis. *Med Sci Sports
  Exerc* 39(8):1358–65.
- Seiler, S. (2010). What is best practice for training intensity and duration distribution in
  endurance athletes? *Int J Sports Physiol Perform* 5(3):276–91.
- Gabbett, T. (2016). The training–injury prevention paradox. *Br J Sports Med* 50:273–80, and the
  critique by Impellizzeri, F. et al. (2020). Acute:chronic workload ratio: conceptual issues and
  fundamental pitfalls. *Int J Sports Physiol Perform* 15(6):907–13.
- Nielsen, R. et al. (2014). Excessive progression in weekly running distance and risk of
  running-related injuries. *J Orthop Sports Phys Ther* 44(10):739–47.
