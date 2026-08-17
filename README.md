# Winterarc

> **Build in silence. Become something different.**

Winterarc is a personal training and performance system I'm building to bring the different parts of training into one place.

The idea came from a pretty simple problem: **training gets messy when everything is scattered.**

You might plan workouts somewhere, log them somewhere else, track running separately, keep recovery notes on your phone, and then have no real idea whether any of it is actually working.

I wanted to build something that connects all of it.

Not another social fitness app.
Not a collection of pretty graphs.
Not an AI that spits out random workouts.

Just a system that helps you **plan your training, actually do it, understand what happened, and make better decisions next time.**

---

## What is Winterarc?

At its core, Winterarc follows a simple loop:

```text
PLAN
  ↓
TRAIN
  ↓
RECOVER
  ↓
ANALYZE
  ↓
ADAPT
  ↺
```

The goal is to make this loop as natural as possible.

The **web app** is where you think and plan.

The **mobile app** is where you train and log.

The data from both eventually comes together to show you what's actually happening over time.

---

## Web = Plan & Analyze

The web application is meant to be the place where you step back and look at the bigger picture.

It will be used for things like:

* Building workouts
* Creating reusable workout templates
* Planning training
* Scheduling sessions
* Looking through previous sessions
* Tracking progression
* Viewing training trends
* Comparing planned vs actual training
* Looking at recovery
* Understanding how training is changing over time

I'm intentionally trying to keep this side relatively clean.

The goal isn't to give you 40 graphs because graphs look cool.

If a metric doesn't help you make a better training decision, I don't really want it there.

---

## Mobile = Execute & Log

The phone has a completely different job.

When you're actually training, you shouldn't have to fight an application just to record a set.

The mobile app is therefore focused on execution:

* See today's workout
* Start a session
* Follow the exercises
* Log sets, reps and weight
* Record RPE/RIR
* Rest timer
* Add notes
* Finish the session
* See a quick summary

That's basically it.

**When you're training, Winterarc should get out of your way.**

---

# What can you train?

Winterarc isn't being built around just lifting weights.

Training is much bigger than that.

The system is designed to eventually support:

### Strength

Exercises, sets, reps, load, RPE/RIR and progression.

### Conditioning

Intervals, work/rest periods, duration and intensity.

### Running

Distance, pace, duration and different types of running sessions.

### Plyometrics

Jumps, bounds, explosive work and training volume.

### Mobility

Movement preparation, mobility routines and range-of-motion work.

### Yoga & Stretching

Yoga and stretching are treated as actual parts of training and recovery rather than being shoved into some miscellaneous category.

### Recovery

Things like sleep, soreness, energy and readiness can eventually be used to understand how training is affecting you.

---

# The important part: planned ≠ actual

One of the things I want Winterarc to get right is the difference between what you **planned** to do and what you **actually** did.

For example, you might plan:

```text
Bench Press
4 × 6 @ 80 kg
RPE 8
```

But real life might look like:

```text
80 × 6
80 × 6
80 × 5
80 × 5
```

That's not a failure of the system.

**That's the data.**

Maybe you were tired.

Maybe recovery was bad.

Maybe 80 kg was too heavy that day.

Maybe you're progressing anyway.

Winterarc should eventually be able to connect those dots instead of pretending every workout went exactly according to plan.

---

# How it works

The basic architecture is intentionally straightforward.

```text
                  ┌─────────────────┐
                  │    Database     │
                  │ SQLite + Drizzle│
                  └────────┬────────┘
                           │
                    Shared data layer
                           │
             ┌─────────────┴─────────────┐
             │                           │
       ┌─────▼─────┐               ┌─────▼─────┐
       │    Web    │               │  Mobile   │
       │           │               │           │
       │   PLAN    │               │  EXECUTE  │
       │  ANALYZE  │               │    LOG    │
       └───────────┘               └───────────┘
```

The idea is to have one reliable source of truth rather than maintaining separate versions of workouts and sessions across the applications.

---

# Tech Stack

Winterarc is currently being built with:

### Web

* Next.js
* React
* TypeScript

### Mobile

* Expo
* React Native
* TypeScript

### Data

* SQLite
* Drizzle ORM

The project is being kept modular so that things like exercises, workouts, sessions, recovery and analytics can evolve independently instead of turning into one giant codebase.

---

# The Development Approach

One thing I'm trying very hard **not** to do with this project is build everything at once.

There are a lot of things Winterarc *could* eventually become.

But none of that matters if the basic loop doesn't work.

So the first real milestone is simply:

```text
Create a workout
      ↓
Save it
      ↓
See it on the phone
      ↓
Do the workout
      ↓
Log the sets
      ↓
Save the session
      ↓
See it on the web
```

If that works reliably, we have something.

Everything else can come afterwards.

---

# Roadmap

## Phase 1 — Foundation

* [ ] Database schema
* [ ] Drizzle integration
* [ ] Shared models
* [ ] Exercise database
* [ ] Seed data
* [ ] Data/API layer

## Phase 2 — Web

* [ ] Workout Builder
* [ ] Exercise selection
* [ ] Workout templates
* [ ] Workout editing
* [ ] Training schedule
* [ ] Real dashboard data

## Phase 3 — Mobile

* [ ] Today's workout
* [ ] Workout execution
* [ ] Set logging
* [ ] RPE/RIR
* [ ] Rest timer
* [ ] Session completion
* [ ] Offline-friendly logging

## Phase 4 — The Feedback Loop

* [ ] Mobile → database sync
* [ ] Session history
* [ ] Planned vs actual
* [ ] Training volume
* [ ] Exercise progression
* [ ] Performance trends

## Phase 5 — More Ways to Train

* [ ] Conditioning
* [ ] Running
* [ ] Plyometrics
* [ ] Mobility
* [ ] Yoga
* [ ] Stretching
* [ ] Recovery

## Phase 6 — Intelligence

Eventually, I'd like Winterarc to become better at helping answer questions like:

> Am I actually progressing?

> Am I doing too much?

> Is my recovery keeping up with my training?

> What should I change next week?

But **AI isn't the starting point.**

If the underlying data is bad, an intelligent system is just going to give you more confidently-worded bad advice.

So the foundation comes first.

---

# Where Winterarc is right now

🚧 **Very much a work in progress.**

This is an actively developed project, and things will probably break.

A lot.

The current focus is getting the basic web → database → mobile → database → web loop working properly before adding more complexity.

The goal is to build something that is actually usable, not just something that looks impressive in a screenshot.

---

# Why "Winterarc"?

The name is based on the idea of a **winter arc** — a period of deliberately putting in the work, often without much external validation, and coming out of it different from when you started.

That's basically what I want the project to represent.

Training isn't really about one workout.

It's the accumulation of hundreds of small decisions.

You show up.

You do the work.

You recover.

You look at what happened.

You adjust.

Then you do it again.

**That's the arc.**

---

## Winterarc

**Plan deliberately.
Train consistently.
Recover properly.
Look at the truth.
Adapt.**

And keep going.
