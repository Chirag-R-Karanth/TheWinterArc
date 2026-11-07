package api

import "testing"

func TestMesocycleValidation(t *testing.T) {
    valid := mesocycleInput{Name:"Hypertrophy Block", StartDate:"2026-11-09", DurationWeeks:6, DeloadWeek:intPtr(6)}
    if _, err := valid.validate(); err != nil { t.Fatalf("valid cycle rejected: %v", err) }

    cases := []mesocycleInput{
        {Name:"", StartDate:"2026-11-09", DurationWeeks:6},
        {Name:"Block", StartDate:"not-a-date", DurationWeeks:6},
        {Name:"Block", StartDate:"2026-11-09", DurationWeeks:0},
        {Name:"Block", StartDate:"2026-11-09", DurationWeeks:6, DeloadWeek:intPtr(7)},
        {Name:"Block", StartDate:"2026-11-09", DurationWeeks:2, Weeks:[]mesocycleWeekInput{
            {WeekNumber:1, VolumeMultiplier:1}, {WeekNumber:1, VolumeMultiplier:1},
        }},
        {Name:"Block", StartDate:"2026-11-09", DurationWeeks:2, Weeks:[]mesocycleWeekInput{
            {WeekNumber:1, VolumeMultiplier:2.5},
        }},
    }
    for i, in := range cases {
        if _, err := in.validate(); err == nil { t.Errorf("case %d: expected validation error", i) }
    }
}
func intPtr(v int) *int { return &v }
