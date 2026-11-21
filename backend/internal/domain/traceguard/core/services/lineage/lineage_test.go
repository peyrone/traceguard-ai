package lineage

import (
	"math/rand"
	"reflect"
	"testing"
	"time"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

func TestReconstruct(t *testing.T) {
	start := time.Date(2026, 11, 21, 3, 0, 0, 0, time.UTC)
	upstream := entities.Event{
		EventID: "up", TraceID: "trace", TransferID: "upstream",
		OccurredAt: start, ObservedAt: start.Add(time.Hour),
		Service: "customer-api", SourceService: "customer-api", DestinationService: "sales-api",
		Action: "DATA_SENT", Outcome: "COMPLETED", DataRef: "ref",
	}
	direct := upstream
	direct.EventID, direct.TransferID, direct.Service = "direct", "outbound", "sales-api"
	direct.SourceService, direct.DestinationService = "sales-api", "external-crm"
	direct.OccurredAt, direct.ObservedAt = start.Add(time.Minute), start.Add(time.Minute)
	receive := direct
	receive.EventID, receive.Action, receive.SourceService, receive.Service = "receive", "DATA_RECEIVED", "", "external-crm"
	partial := direct
	partial.EventID, partial.DestinationService = "partial", ""
	partial.OccurredAt = direct.OccurredAt.Add(-time.Second)
	ambiguous := partial
	ambiguous.EventID, ambiguous.SourceService = "ambiguous", "other-api"
	attempt := direct
	attempt.EventID, attempt.Outcome = "attempt", "ATTEMPTED"
	failed := direct
	failed.EventID, failed.Outcome = "failed", "FAILED"
	conflict := direct
	conflict.DestinationService = "other"
	retry := direct
	retry.ObservedAt = start.Add(2 * time.Hour)
	for _, tc := range []struct {
		name                       string
		input                      []entities.Event
		unique, observed, inferred int
		evidence                   []string
	}{
		{"direct and duplicate", []entities.Event{direct, upstream, retry, direct}, 2, 2, 0, []string{"direct"}},
		{"missing link", []entities.Event{receive, upstream}, 2, 1, 1, []string{"up", "receive"}},
		{"attempted", []entities.Event{attempt}, 1, 0, 1, []string{"attempt"}},
		{"failed", []entities.Event{failed}, 1, 0, 1, []string{"failed"}},
		{"conflicting duplicate", []entities.Event{direct, conflict}, 0, 0, 0, nil},
		{"complementary endpoints", []entities.Event{receive, partial}, 2, 0, 1, []string{"partial", "receive"}},
		{"ambiguous transfer ID", []entities.Event{receive, partial, ambiguous}, 3, 0, 0, nil},
		{"no source clue", []entities.Event{receive}, 1, 0, 0, nil},
		{"receive corroborates send", []entities.Event{receive, direct}, 2, 1, 0, []string{"direct"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := Service{}
			events, graph := service.Reconstruct(tc.input)
			observed, inferred := 0, 0
			var evidence []string
			for _, edge := range graph.Edges {
				switch edge.EvidenceStatus {
				case entities.Observed:
					observed++
				case entities.Inferred:
					inferred++
				}
				if edge.Target == "external-crm" {
					evidence = edge.EvidenceEventIDs
				}
			}
			if len(events) != tc.unique || observed != tc.observed || inferred != tc.inferred || !reflect.DeepEqual(evidence, tc.evidence) {
				t.Fatalf("unique=%d, observed=%d, inferred=%d, evidence=%v, graph=%+v", len(events), observed, inferred, evidence, graph)
			}
			rng := rand.New(rand.NewSource(42))
			shuffled := append([]entities.Event{}, tc.input...)
			for range 20 {
				rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
				gotEvents, gotGraph := service.Reconstruct(shuffled)
				if !reflect.DeepEqual(events, gotEvents) || !reflect.DeepEqual(graph, gotGraph) {
					t.Fatalf("shuffle changed results: %v %+v", gotEvents, gotGraph)
				}
			}
		})
	}
}

func TestBlankEndpointCannotCreateObservedEdge(t *testing.T) {
	event := entities.Event{EventID: "send", Service: "sales-api", Action: "DATA_SENT", Outcome: "COMPLETED", SourceService: "sales-api", DestinationService: " 	 "}
	_, graph := (Service{}).Reconstruct([]entities.Event{event})
	if len(graph.Edges) != 0 || len(graph.Nodes) != 1 {
		t.Fatalf("unexpected graph: %+v", graph)
	}
}
