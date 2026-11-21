package fixtures

import "testing"

func TestEventIDsAreUniqueAcrossScenarios(t *testing.T) {
	store := Store{}
	seen := make(map[string]string)
	for _, scenario := range store.List() {
		events, _, err := store.Load(t.Context(), scenario.ID)
		if err != nil {
			t.Fatal(err)
		}
		for _, event := range events {
			if event.EventID == "" {
				t.Errorf("scenario %q contains an empty event ID", scenario.ID)
			}
			if previous, exists := seen[event.EventID]; exists {
				t.Errorf("event ID %q is repeated in %q and %q", event.EventID, previous, scenario.ID)
			}
			seen[event.EventID] = scenario.ID
		}
	}
}
