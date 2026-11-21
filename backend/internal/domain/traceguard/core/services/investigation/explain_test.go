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

func TestExplainConflictingEvidence(t *testing.T) {
	completed := Evidence{EventID: "x", Action: "DATA_SENT", Outcome: "COMPLETED"}
	failed := Evidence{EventID: "x", Action: "DATA_SENT", Outcome: "FAILED"}
	received := Evidence{EventID: "x", Action: "DATA_RECEIVED", Outcome: "COMPLETED"}
	for _, status := range []entities.Status{entities.VerifiedViolation, entities.PotentialViolation} {
		finding := entities.Finding{Status: status, EvidenceEventIDs: []string{"x"}}
		for _, tc := range []struct {
			name     string
			evidence []Evidence
		}{
			{"failed first", []Evidence{failed, completed}},
			{"completed first", []Evidence{completed, failed}},
			{"action differs", []Evidence{completed, received}},
			{"repeat after conflict", []Evidence{completed, failed, completed}},
		} {
			t.Run(string(status)+"/"+tc.name, func(t *testing.T) {
				service := New(providerFunc(func(context.Context, Request) (Suggestion, error) {
					t.Error("provider called for unresolved evidence")
					return Suggestion{}, nil
				}))
				got, err := service.Explain(t.Context(), finding, tc.evidence)
				if status == entities.VerifiedViolation {
					if !errors.Is(err, ErrInsufficientEvidence) {
						t.Fatalf("got %v, want ErrInsufficientEvidence", err)
					}
					return
				}
				want, wantErr := New(nil).Explain(t.Context(), finding, nil)
				if err != nil || wantErr != nil || got.Mode != "fallback" || len(got.EvidenceEventIDs) != 0 || !reflect.DeepEqual(got, want) {
					t.Fatalf("got %+v (%v), want unresolved fallback %+v (%v)", got, err, want, wantErr)
				}
			})
		}
	}
}

func TestExplainIdenticalEvidence(t *testing.T) {
	finding := entities.Finding{Status: entities.VerifiedViolation, EvidenceEventIDs: []string{"x"}}
	send := Evidence{EventID: "x", Action: "DATA_SENT", Outcome: "COMPLETED"}
	got, err := New(nil).Explain(t.Context(), finding, []Evidence{send, send})
	if err != nil || !reflect.DeepEqual(got.EvidenceEventIDs, []string{"x"}) {
		t.Fatalf("got citations %v, error %v", got.EvidenceEventIDs, err)
	}
}

func TestExplain(t *testing.T) {
	finding := entities.Finding{Status: entities.PotentialViolation, EvidenceEventIDs: []string{"evt-4", "absent"}}
	evidence := []Evidence{{EventID: "evt-4", Action: "DATA_RECEIVED", Outcome: "COMPLETED"}, {EventID: "unrelated"}}
	for _, tc := range []struct {
		name       string
		suggestion Suggestion
		err        error
		mode       string
	}{
		{"valid", Suggestion{Status: entities.PotentialViolation, EvidenceRefs: []string{"E1"}, StepIDs: []string{"check_policy"}}, nil, "ai"},
		{"changed classification", Suggestion{Status: entities.VerifiedViolation, EvidenceRefs: []string{"E1"}, StepIDs: []string{"check_policy"}}, nil, "fallback"},
		{"invented reference", Suggestion{Status: entities.PotentialViolation, EvidenceRefs: []string{"E2"}, StepIDs: []string{"check_policy"}}, nil, "fallback"},
		{"unvetted action", Suggestion{Status: entities.PotentialViolation, EvidenceRefs: []string{"E1"}, StepIDs: []string{"invented"}}, nil, "fallback"},
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

func TestExplainWithoutEvidenceUsesFallback(t *testing.T) {
	// No cited ID resolves to supplied evidence, so the AI has nothing grounded to work with.
	finding := entities.Finding{Status: entities.Inconclusive, EvidenceEventIDs: []string{"absent"}}
	called := false
	service := New(providerFunc(func(context.Context, Request) (Suggestion, error) {
		called = true
		// A suggestion that would otherwise pass every check: same status, matching (empty) refs, vetted step.
		return Suggestion{Status: entities.Inconclusive, EvidenceRefs: []string{}, StepIDs: []string{"collect_records"}}, nil
	}))

	got, err := service.Explain(t.Context(), finding, nil)
	if err != nil {
		t.Fatal(err)
	}
	if called {
		t.Fatal("provider must not be called when no evidence resolves")
	}
	if got.Mode != "fallback" || len(got.EvidenceEventIDs) != 0 {
		t.Fatalf("explanation = %+v", got)
	}
}
