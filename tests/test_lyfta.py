import unittest

from backend.lyfta import parse_workout_page


def fixture():
    # Synthetic workout shaped like the documented sandbox contract.
    return {"status": True, "sandbox": True, "workouts": [{
        "id": 1, "workout_perform_date": "2026-11-24T12:00:00Z", "exercises": [{
            "exercise_id": 2, "sets": [
                {"id": "a", "weight": "80", "reps": "5", "is_completed": True},
                {"id": "b", "weight": "", "reps": "", "is_completed": False},
            ],
        }],
    }]}


class LyftaPageTest(unittest.TestCase):
    def test_preserves_unitless_weights_order_and_sandbox_flag(self):
        page = fixture()
        self.assertIs(parse_workout_page(page), page)
        self.assertEqual(page, fixture())

    def test_rejects_ambiguous_set_identity(self):
        page = fixture()
        sets = page["workouts"][0]["exercises"][0]["sets"]
        sets[1]["id"] = sets[0]["id"]
        with self.assertRaisesRegex(ValueError, r"set\.id"):
            parse_workout_page(page)

    def test_rejects_timestamp_without_offset(self):
        page = fixture()
        page["workouts"][0]["workout_perform_date"] = "2026-11-24T12:00:00"
        with self.assertRaisesRegex(ValueError, "timezone"):
            parse_workout_page(page)
