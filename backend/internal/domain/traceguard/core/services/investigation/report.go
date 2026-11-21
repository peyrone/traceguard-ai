package investigation

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

//go:embed report-copy.json
var reportCopyJSON []byte

var reportCopy = func() map[string]map[string]string {
	var copy map[string]map[string]string
	if err := json.Unmarshal(reportCopyJSON, &copy); err != nil {
		panic(err)
	}
	return copy
}()

type ReportSection struct {
	Kind, Text, RuleID string
	EvidenceEventIDs   []string
}

func (s Service) Report(ctx context.Context, audience, language string, status entities.Status, graph entities.Graph, findings []entities.Finding, events []entities.Event) ([]ReportSection, string) {
	tr := func(key string) string { return reportCopy[key][language] }
	byID := make(map[string]entities.Event, len(events))
	for _, event := range events {
		byID[event.EventID] = event
	}
	sections := []ReportSection{}
	var primaryIDs, gapIDs []string
	for _, f := range findings {
		if f.Status != status {
			continue
		}
		primaryIDs = append(primaryIDs, f.EvidenceEventIDs...)
		text := tr(string(status))
		if status == entities.VerifiedViolation || status == entities.PotentialViolation {
			if f.RuleID == "DENY_EXTERNAL_PII" {
				text += " " + tr("outside_destination")
			} else if f.RuleID == "DENY_PURPOSE" {
				text += " " + tr("outside_purpose")
			}
			expected := entities.Inferred
			if status == entities.VerifiedViolation {
				expected = entities.Observed
			}
			for _, edge := range graph.Edges {
				if edge.EvidenceStatus != expected {
					continue
				}
				if slices.ContainsFunc(edge.EvidenceEventIDs, func(id string) bool { return slices.Contains(f.EvidenceEventIDs, id) }) {
					text += " " + edge.Source + " → " + edge.Target
					break
				}
			}
		}
		sections = append(sections, ReportSection{Kind: "conclusion", Text: text, RuleID: f.RuleID, EvidenceEventIDs: f.EvidenceEventIDs})
	}
	if len(sections) == 0 {
		sections = append(sections, ReportSection{Kind: "conclusion", Text: tr(string(status))})
	}
	for _, edge := range graph.Edges {
		kind, label := "route", "observed"
		if edge.EvidenceStatus == entities.Inferred {
			kind, label = "uncertainty", "inferred"
			gapIDs = append(gapIDs, edge.EvidenceEventIDs...)
		} else if audience == "executive" {
			continue
		}
		text := fmt.Sprintf("%s · %s → %s", tr(label), edge.Source, edge.Target)
		if kind == "uncertainty" {
			for _, id := range edge.EvidenceEventIDs {
				e := byID[id]
				if e.Action == "DATA_RECEIVED" && e.Outcome == "COMPLETED" {
					text += fmt.Sprintf(". %s %s (%s).", tr("receipt"), e.Service, id)
				}
			}
		}
		sections = append(sections, ReportSection{Kind: kind, Text: text, EvidenceEventIDs: edge.EvidenceEventIDs})
	}
	if audience == "engineering" {
		for _, f := range findings {
			for _, gap := range f.MissingEvidence {
				text := tr(gap)
				if text == "" {
					text = tr("other_gap")
				}
				sections = append(sections, ReportSection{Kind: "uncertainty", Text: text, RuleID: f.RuleID, EvidenceEventIDs: f.EvidenceEventIDs})
			}
		}
	}
	if len(gapIDs) == 0 {
		sections = append(sections, ReportSection{Kind: "uncertainty", Text: tr("scope")})
	}
	actions := []string{}
	if status == entities.VerifiedViolation {
		actions = append(actions, "review_export")
	}
	if len(gapIDs) > 0 || status == entities.Inconclusive || status == entities.PotentialViolation {
		actions = append(actions, "collect_records")
	}
	actions = append(actions, "check_policy")
	refs := append(slices.Clone(primaryIDs), gapIDs...)
	slices.Sort(refs)
	ranked, mode := s.rankReportActions(ctx, audience, status, slices.Compact(refs), actions, byID)
	for _, action := range ranked {
		ids := primaryIDs
		if action == "collect_records" && len(gapIDs) > 0 {
			ids = gapIDs
		}
		sections = append(sections, ReportSection{Kind: "action", Text: tr(audience + "." + action), EvidenceEventIDs: slices.Compact(sortedCopy(ids))})
	}
	return sections, mode
}

// Only aliases, the verdict, audience, and a closed vocabulary of actions leave the service.
func (s Service) rankReportActions(ctx context.Context, audience string, status entities.Status, refs, actions []string, byID map[string]entities.Event) ([]string, string) {
	if s.provider == nil || len(refs) == 0 || len(actions) < 2 {
		return actions, "fallback"
	}
	req := Request{Audience: audience, Status: status, ApplicableStepIDs: slices.Clone(actions)}
	aliases := make([]string, len(refs))
	for i := range refs {
		aliases[i] = "E" + strconv.Itoa(i+1)
		req.Evidence = append(req.Evidence, EvidenceMetadata{Ref: aliases[i], Action: knownValue(byID[refs[i]].Action, "DATA_SENT", "DATA_RECEIVED"), Outcome: knownValue(byID[refs[i]].Outcome, "COMPLETED", "ATTEMPTED", "FAILED")})
	}
	pick, err := s.provider.Suggest(ctx, req)
	if err != nil || ctx.Err() != nil || pick.Status != status || pick.Review != nil ||
		!slices.Equal(sortedCopy(pick.EvidenceRefs), sortedCopy(aliases)) ||
		!slices.Equal(sortedCopy(pick.StepIDs), sortedCopy(actions)) {
		return actions, "fallback"
	}
	return pick.StepIDs, "ai"
}
