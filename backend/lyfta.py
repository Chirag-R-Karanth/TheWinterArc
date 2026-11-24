"""Offline identity and structure validation for documented Lyfta workout pages.

This is not an importer. Preserve source fields without interpreting unitless
weight, set-type codes, or workout duration. Callers retain the original bytes.
"""

from datetime import datetime


def _require(condition, field):
    if not condition:
        raise ValueError(f"Invalid Lyfta workout page: {field}")


def parse_workout_page(page):
    """Return the validated page, keeping its hierarchy, ordering and metadata."""
    _require(isinstance(page, dict) and page.get("status") is True, "status")
    workouts = page.get("workouts")
    _require(isinstance(workouts, list), "workouts")
    seen_workouts = set()
    for workout in workouts:
        _require(isinstance(workout, dict), "workout")
        workout_id = workout.get("id")
        _require(type(workout_id) is int and workout_id not in seen_workouts, "workout.id")
        seen_workouts.add(workout_id)
        timestamp = workout.get("workout_perform_date")
        _require(isinstance(timestamp, str), "workout_perform_date")
        try:
            observed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError("Invalid Lyfta workout page: workout_perform_date") from None
        _require(observed.utcoffset() is not None, "workout_perform_date timezone")
        exercises = workout.get("exercises")
        _require(isinstance(exercises, list), "exercises")
        for exercise in exercises:
            _require(isinstance(exercise, dict) and type(exercise.get("exercise_id")) is int,
                     "exercise_id")
            sets = exercise.get("sets")
            _require(isinstance(sets, list), "sets")
            seen_sets = set()
            for item in sets:
                _require(isinstance(item, dict), "set")
                set_id = item.get("id")
                _require(isinstance(set_id, str) and bool(set_id.strip()) and set_id not in seen_sets,
                         "set.id")
                seen_sets.add(set_id)
                _require(type(item.get("is_completed")) is bool, "set.is_completed")
    return page
