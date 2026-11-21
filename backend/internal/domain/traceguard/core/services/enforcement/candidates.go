package enforcement

import (
	"context"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

type Candidate struct {
	ID               string
	EdgeID           string
	EvidenceStatus   entities.EvidenceStatus
	EvidenceEventIDs []string
	Request          Request
}

// Candidates projects the normalized events and graph for a server-owned fixture.
func Candidates(scenarioID string, events []entities.Event, graph entities.Graph, policy entities.Policy) []Candidate {
	byID := make(map[string]entities.Event, len(events))
	for _, event := range events {
		byID[event.EventID] = event
	}
	nodes := make(map[string]bool, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodes[node.ID] = true
	}
	out := []Candidate{}
	for _, edge := range graph.Edges {
		if !nodes[edge.Source] || !nodes[edge.Target] {
			continue
		}
		candidate := Candidate{
			ID: scenarioID + "/" + edge.ID, EdgeID: edge.ID, EvidenceStatus: edge.EvidenceStatus,
			Request: Request{SourceService: edge.Source, DestinationService: edge.Target, PolicyID: policy.PolicyID},
		}
		switch edge.EvidenceStatus {
		case entities.Observed:
			for _, id := range edge.EvidenceEventIDs {
				event, found := byID[id]
				if !found || event.Action != "DATA_SENT" || event.Outcome != "COMPLETED" ||
					event.SourceService != edge.Source || event.DestinationService != edge.Target {
					continue
				}
				selected := candidate
				selected.ID += "/" + id
				selected.EvidenceEventIDs = []string{id}
				selected.Request.Purpose = event.Purpose
				if entities.Meaningful(event.Classification) {
					selected.Request.DataCategories = []string{event.Classification}
				}
				out = append(out, selected)
			}
		case entities.Inferred:
			for _, id := range edge.EvidenceEventIDs {
				if _, exists := byID[id]; exists {
					candidate.EvidenceEventIDs = append(candidate.EvidenceEventIDs, id)
				}
			}
			if len(candidate.EvidenceEventIDs) != 0 {
				out = append(out, candidate)
			}
		}
	}
	return out
}

func SimulateCandidate(ctx context.Context, candidate Candidate, policy entities.Policy) Result {
	if candidate.EvidenceStatus != entities.Observed {
		return Result{Decision: Indeterminate, RuleID: "TRANSFER_POLICY", Reason: "The relationship is inferred and lacks a directly observed completed send."}
	}
	return Simulate(ctx, candidate.Request, &policy)
}
