package fixtures

import (
	"strings"
	"testing"
)

func TestEventIDsUseUniqueScenarioPrefixes(t *testing.T) {
	store := Store{}
	prefixes := map[string]string{
		"allowed_transfer":           "evt-a-",
		"unauthorized_transfer":      "evt-u-",
		"shuffled_transfer":          "evt-s-",
		"missing_intermediate":       "evt-m-",
		"partial_evidence_confirmed": "evt-e-",
	}
	seen := make(map[string]string)
	for _, scenario := range store.List() {
		prefix, exists := prefixes[scenario.ID]
		if !exists {
			t.Fatalf("scenario %q has no expected event ID prefix", scenario.ID)
		}
		events, _, err := store.Load(t.Context(), scenario.ID)
		if err != nil {
			t.Fatal(err)
		}
		for _, event := range events {
			if suffix, ok := strings.CutPrefix(event.EventID, prefix); !ok || suffix == "" {
				t.Errorf("scenario %q: event ID %q must start with %q and have a suffix", scenario.ID, event.EventID, prefix)
			}
			if previous, exists := seen[event.EventID]; exists {
				t.Errorf("event ID %q is repeated in %q and %q", event.EventID, previous, scenario.ID)
			}
			seen[event.EventID] = scenario.ID
		}
	}
}
