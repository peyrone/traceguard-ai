package investigation

import (
	"slices"
	"testing"

	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/detection"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func TestGDPRReviewFixtures(t *testing.T) {
	for _, tc := range []struct {
		scenario, evidence string
		articles           []string
		uncertain          bool
	}{
		{"allowed_transfer", "evt-a-001", nil, false},
		{"unauthorized_transfer", "evt-u-003", []string{"5(1)(f)", "5(1)(b)"}, false},
		{"shuffled_transfer", "evt-s-003", []string{"5(1)(f)", "5(1)(b)"}, false},
		{"missing_intermediate", "evt-m-004", []string{"5(1)(f)", "5(1)(b)"}, true},
		{"partial_evidence_confirmed", "evt-e-002", []string{"5(1)(f)"}, false},
		{"partial_evidence_confirmed", "evt-e-001", nil, true},
	} {
		t.Run(tc.scenario+"/"+tc.evidence, func(t *testing.T) {
			events, policy, err := (fixtures.Store{}).Load(t.Context(), tc.scenario)
			if err != nil {
				t.Fatal(err)
			}
			events, graph := (lineage.Service{}).Reconstruct(events)
			findings, err := (detection.Evaluator{}).Detect(t.Context(), events, graph, policy)
			if err != nil {
				t.Fatal(err)
			}
			index := slices.IndexFunc(findings, func(f entities.Finding) bool { return slices.Contains(f.EvidenceEventIDs, tc.evidence) })
			if index < 0 {
				t.Fatalf("no finding for %s", tc.evidence)
			}
			finding := findings[index]
			review := reviewEvidence(finding, events, graph, findings, policy)
			if len(review.Insights) == 0 || review.Insights[0].Kind == "uncertainty" != tc.uncertain {
				t.Fatalf("wrong factual stance: %+v", review.Insights)
			}
			if !slices.Equal(review.Insights[0].EvidenceEventIDs, []string{tc.evidence}) {
				t.Fatalf("wrong primary citations: %+v", review.Insights[0])
			}
			var articles []string
			for _, mapping := range review.Mappings {
				articles = append(articles, mapping.Reference.Article)
				if !slices.Equal(mapping.EvidenceEventIDs, []string{tc.evidence}) || len(mapping.MissingFacts) == 0 || mapping.Reference.SourceURL == "" ||
					(mapping.Assessment == "insufficient_information") != tc.uncertain {
					t.Fatalf("unsupported mapping: %+v", mapping)
				}
			}
			if !slices.Equal(articles, tc.articles) {
				t.Fatalf("articles = %v, want %v", articles, tc.articles)
			}
			if tc.evidence == "evt-e-002" && !slices.ContainsFunc(review.Insights, func(i Insight) bool {
				return i.Kind == "uncertainty" && slices.Equal(i.EvidenceEventIDs, []string{"evt-e-001"})
			}) {
				t.Fatalf("missing separate upstream evidence: %+v", review.Insights)
			}
		})
	}
}

func TestGDPRReviewRequiresTrustedTransferEvidence(t *testing.T) {
	finding := entities.Finding{Status: entities.VerifiedViolation, RuleID: "DENY_EXTERNAL_PII", EvidenceEventIDs: []string{"unknown"}}
	review := reviewEvidence(finding, nil, entities.Graph{}, nil, entities.Policy{Classification: "PII"})
	if len(review.Mappings) != 0 || len(review.Insights) != 0 {
		t.Fatalf("invented evidence: %+v", review)
	}
}

func TestReviewRankingRejectsUnsupportedClaims(t *testing.T) {
	review := EvidenceReview{
		Insights: []Insight{{"observation", "Observed downstream send", []string{"send"}}, {"uncertainty", "Inferred upstream link", []string{"receipt"}}},
		Mappings: []GDPRMapping{{Reference: confidentialityReference, Assessment: "potential_concern", EvidenceEventIDs: []string{"send"}}},
	}
	prompt := reviewChoices(review, map[string]string{"send": "E1", "receipt": "E2"})
	valid := ReviewRanking{Insights: []ReviewSelection{{"I2", []string{"E2"}}, {"I1", []string{"E1"}}}, Mappings: []ReviewSelection{{"5(1)(f)", []string{"E1"}}}}
	for _, tc := range []struct {
		name   string
		change func(*ReviewRanking)
		valid  bool
	}{
		{"valid", nil, true},
		{"invented article", func(value *ReviewRanking) { value.Mappings[0].ID = "44" }, false},
		{"invented citation", func(value *ReviewRanking) { value.Insights[0].EvidenceRefs = []string{"E3"} }, false},
		{"claims observed from inferred evidence", func(value *ReviewRanking) { value.Insights[1].EvidenceRefs = []string{"E2"} }, false},
		{"omits uncertainty", func(value *ReviewRanking) { value.Insights = value.Insights[1:] }, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			selection := ReviewRanking{Insights: slices.Clone(valid.Insights), Mappings: slices.Clone(valid.Mappings)}
			if tc.change != nil {
				tc.change(&selection)
			}
			ranked, ok := rankReview(review, prompt, selection)
			if ok != tc.valid {
				t.Fatalf("valid = %v, wanted %v", ok, tc.valid)
			}
			if ok && ranked.Insights[0].Kind != "uncertainty" {
				t.Fatalf("ignored validated prioritisation: %+v", ranked)
			}
		})
	}
}
