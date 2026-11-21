// Package lineage reconstructs a service graph from audit evidence.
package lineage

import (
	"cmp"
	"encoding/base64"
	"slices"
	"strconv"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

type Service struct {
	NodeKinds map[string]string
}

type edgeKey struct {
	source, target string
	status         entities.EvidenceStatus
}

type dataKey struct {
	trace, ref string
}

func (s Service) Reconstruct(input []entities.Event) ([]entities.Event, entities.Graph) {
	events := normalize(input)
	nodes := make(map[string]entities.Node)
	evidence := make(map[edgeKey][]string)
	byTransfer := make(map[string][]entities.Event)
	byData := make(map[dataKey][]entities.Event)

	for _, event := range events {
		for _, id := range []string{event.Service, event.SourceService, event.DestinationService} {
			if id != "" {
				kind := s.NodeKinds[id]
				if kind == "" {
					kind = "unknown"
				}
				nodes[id] = entities.Node{ID: id, Label: id, Kind: kind}
			}
		}
		if !completedSend(event) {
			continue
		}
		key := edgeKey{event.SourceService, event.DestinationService, entities.Observed}
		evidence[key] = append(evidence[key], event.EventID)
		if event.TransferID != "" {
			byTransfer[event.TransferID] = append(byTransfer[event.TransferID], event)
		}
		if event.TraceID != "" && event.DataRef != "" {
			key := dataKey{event.TraceID, event.DataRef}
			byData[key] = append(byData[key], event)
		}
	}

	for _, event := range events {
		source, target := event.SourceService, event.DestinationService
		switch event.Action {
		case "DATA_SENT":
			if !completedSend(event) && source != "" && target != "" {
				key := edgeKey{source, target, entities.Inferred}
				evidence[key] = append(evidence[key], event.EventID)
			}
		case "DATA_RECEIVED":
			if event.Outcome != "COMPLETED" {
				continue
			}
			if target == "" {
				target = event.Service
			}
			if target == "" || corroborated(event, target, byTransfer[event.TransferID]) {
				continue
			}
			if source != "" {
				key := edgeKey{source, target, entities.Inferred}
				evidence[key] = append(evidence[key], event.EventID)
				continue
			}
			source, ids := precedingDestination(event, target, byData[dataKey{event.TraceID, event.DataRef}])
			if source != "" {
				key := edgeKey{source, target, entities.Inferred}
				evidence[key] = append(evidence[key], ids...)
				evidence[key] = append(evidence[key], event.EventID)
			}
		}
	}

	graph := entities.Graph{Nodes: []entities.Node{}, Edges: []entities.Edge{}}
	for _, node := range nodes {
		graph.Nodes = append(graph.Nodes, node)
	}
	slices.SortFunc(graph.Nodes, func(a, b entities.Node) int { return cmp.Compare(a.ID, b.ID) })

	position := make(map[string]int, len(events))
	for index, event := range events {
		position[event.EventID] = index
	}
	for key, ids := range evidence {
		slices.SortFunc(ids, func(a, b string) int { return cmp.Compare(position[a], position[b]) })
		graph.Edges = append(graph.Edges, entities.Edge{
			ID: edgeID(key), Source: key.source, Target: key.target,
			EvidenceStatus: key.status, EvidenceEventIDs: slices.Compact(ids),
		})
	}
	slices.SortFunc(graph.Edges, func(a, b entities.Edge) int {
		return cmp.Or(cmp.Compare(a.Source, b.Source), cmp.Compare(a.Target, b.Target), cmp.Compare(a.EvidenceStatus, b.EvidenceStatus))
	})
	return events, graph
}

func completedSend(event entities.Event) bool {
	return event.Action == "DATA_SENT" && event.Outcome == "COMPLETED" &&
		event.SourceService != "" && event.DestinationService != ""
}

func corroborated(receive entities.Event, target string, sends []entities.Event) bool {
	for _, send := range sends {
		if send.DestinationService == target &&
			compatible(receive.SourceService, send.SourceService) &&
			compatible(receive.TraceID, send.TraceID) &&
			compatible(receive.DataRef, send.DataRef) {
			return true
		}
	}
	return false
}

func compatible(a, b string) bool {
	return a == "" || b == "" || a == b
}

func precedingDestination(receive entities.Event, target string, sends []entities.Event) (string, []string) {
	var source string
	var ids []string
	for _, send := range sends {
		if !send.OccurredAt.Before(receive.OccurredAt) || send.DestinationService == target {
			continue
		}
		if source != "" && source != send.DestinationService {
			return "", nil
		}
		source = send.DestinationService
		ids = append(ids, send.EventID)
	}
	return source, ids
}

func edgeID(key edgeKey) string {
	// Prefix the source length so arbitrary service IDs cannot collide.
	pair := strconv.Itoa(len(key.source)) + ":" + key.source + key.target
	return "edge-" + string(key.status) + "-" + base64.RawURLEncoding.EncodeToString([]byte(pair))
}

func normalize(input []entities.Event) []entities.Event {
	byID := make(map[string]entities.Event, len(input))
	conflicts := make(map[string]bool)
	for _, event := range input {
		if event.EventID == "" || conflicts[event.EventID] {
			continue
		}
		event.OccurredAt = event.OccurredAt.UTC()
		event.ObservedAt = event.ObservedAt.UTC()
		if existing, ok := byID[event.EventID]; ok {
			// A retry may change receipt time. Conflicting event payloads cannot serve as evidence.
			payload := event
			payload.ObservedAt = existing.ObservedAt
			if payload != existing {
				delete(byID, event.EventID)
				conflicts[event.EventID] = true
				continue
			}
			if !event.ObservedAt.Before(existing.ObservedAt) {
				continue
			}
		}
		byID[event.EventID] = event
	}
	events := make([]entities.Event, 0, len(byID))
	for _, event := range byID {
		events = append(events, event)
	}
	slices.SortFunc(events, func(a, b entities.Event) int {
		return cmp.Or(a.OccurredAt.Compare(b.OccurredAt), cmp.Compare(a.EventID, b.EventID))
	})
	return events
}
