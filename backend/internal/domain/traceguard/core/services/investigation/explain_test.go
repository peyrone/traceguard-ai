package investigation

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

type providerFunc func(context.Context, Request) (Suggestion, error)

func (f providerFunc) Suggest(ctx context.Context, r Request) (Suggestion, error) { return f(ctx, r) }

func TestExplain(t *testing.T) {
	finding := entities.Finding{Status: entities.PotentialViolation, EvidenceEventIDs: []string{"evt-4", "absent"}}
	evidence := []Evidence{{EventID: "evt-4", Action: "DATA_RECEIVED", Outcome: "COMPLETED"}, {EventID: "unrelated"}}
	for _, tc := range []struct {
		name       string
		suggestion Suggestion
		err        error
		mode       string
	}{
		{"valid", Suggestion{entities.PotentialViolation, []string{"E1"}, []string{"check_policy"}}, nil, "ai"},
		{"changed classification", Suggestion{entities.VerifiedViolation, []string{"E1"}, []string{"check_policy"}}, nil, "fallback"},
		{"invented reference", Suggestion{entities.PotentialViolation, []string{"E2"}, []string{"check_policy"}}, nil, "fallback"},
		{"unvetted action", Suggestion{entities.PotentialViolation, []string{"E1"}, []string{"invented"}}, nil, "fallback"},
		{"provider failure", Suggestion{}, errors.New("provider failure"), "fallback"},
		{"timeout", Suggestion{}, context.DeadlineExceeded, "fallback"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := New(providerFunc(func(_ context.Context, r Request) (Suggestion, error) {
				if r.Status != finding.Status || len(r.Evidence) != 1 || r.Evidence[0].Ref != "E1" {
					t.Fatalf("provider input = %+v", r)
				}
				return tc.suggestion, tc.err
			}))
			got, err := service.Explain(t.Context(), finding, evidence)
			if err != nil {
				t.Fatal(err)
			}
			if got.Mode != tc.mode || got.Status != finding.Status || !strings.Contains(got.Explanation, "Potential violation") ||
				!reflect.DeepEqual(got.EvidenceEventIDs, []string{"evt-4"}) {
				t.Fatalf("explanation = %+v", got)
			}
			fallback, err := New(nil).Explain(t.Context(), finding, evidence)
			if err != nil {
				t.Fatal(err)
			}
			if tc.mode == "fallback" && !reflect.DeepEqual(got, fallback) {
				t.Fatal("fallback output changed with provider error")
			}
		})
	}
}
