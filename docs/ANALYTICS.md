# Analytics methodology
Use R for reproducible statistics, Python for orchestration. Pin dependencies and version formulas. Store inputs, parameters, windows, timestamps and completeness. Validate against hand-calculated fixtures.
## Strength
Volume = sum(load × reps) for comparable loaded sets; do not equate bodyweight, assisted or machine loads without context. Epley estimated 1RM = load × (1 + reps/30); label estimate, restrict to suitable sets and document limits. Track weekly sets, frequency, PRs and density with explicit denominators.
## Muscle exposure
Proposed heuristic: exposure per muscle = sum(set exposure × involvement weight × exp(-elapsed_hours / tau)). Define exposure units and configurable tau; primary/secondary mapping versioned. Compare against personal workload history. Show insufficient data and separate workload from recovery. Not validated tissue recovery or injury prediction. Do not imply physiological readiness from workload alone.
## Readiness
Optional baseline-relative sleep duration, RHR, HRV, recent workload and consistency. Define baseline window, minimum coverage, weighting and missing-input rules before enabling score. Show components and confidence; unavailable when insufficient. Device sleep stages and energy expenditure are estimates.
## Correlation lab
Align observations by explicit aggregation and timezone; report paired N, date range, lag sign convention and missingness. Pearson, Spearman, rolling and lagged correlation, regression, LOESS, distributions and appropriate intervals. No silent imputation. Address autocorrelation, trends, outliers, small samples, confounding and multiple testing; use appropriate time-series uncertainty or label exploratory. Never infer causation.
## Other modules
Weight 7/30-day averages with coverage; goal forecasts only with assumptions and uncertainty. Nutrition missing days not zero. HR zones only with verified inputs. Habit rates require known scheduled opportunities. Mobility duration does not measure flexibility. Mood patterns are not diagnoses.
