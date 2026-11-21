package investigation

import (
	"fmt"
	"slices"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

const gdprArticle5URL = "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng#art_5"

type GDPRReference struct {
	Article     string `json:"article"`
	Title       string `json:"title"`
	Criteria    string `json:"criteria"`
	SourceURL   string `json:"source_url"`
	GuidanceURL string `json:"guidance_url"`
}

var confidentialityReference = GDPRReference{
	Article: "5(1)(f)", Title: "Principles relating to processing of personal data",
	Criteria:    "Where the GDPR applies to the processing of personal data, assess whether appropriate technical or organisational measures protect it against unauthorised or unlawful processing.",
	SourceURL:   gdprArticle5URL,
	GuidanceURL: "https://www.edpb.europa.eu/documents/guideline/guidelines-012021-on-examples-regarding-personal-data-breach-notification_en",
}

var purposeReference = GDPRReference{
	Article: "5(1)(b)", Title: "Principles relating to processing of personal data",
	Criteria:    "Compare the recorded use with the specified collection purpose. For further processing, assess compatibility and the Article 6(4) conditions where applicable.",
	SourceURL:   gdprArticle5URL,
	GuidanceURL: "https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_201904_dataprotection_by_design_and_by_default_v2.0_en.pdf",
}

type Insight struct {
	Kind             string   `json:"kind"`
	Text             string   `json:"text"`
	EvidenceEventIDs []string `json:"evidence_event_ids"`
}

type GDPRMapping struct {
	Reference        GDPRReference `json:"reference"`
	Assessment       string        `json:"assessment"`
	Rationale        string        `json:"rationale"`
	EvidenceEventIDs []string      `json:"evidence_event_ids"`
	MissingFacts     []string      `json:"missing_facts"`
}

type EvidenceReview struct {
	Insights []Insight
	Mappings []GDPRMapping
}

func reviewEvidence(finding entities.Finding, events []entities.Event, graph entities.Graph, related []entities.Finding, policy entities.Policy) EvidenceReview {
	var review EvidenceReview
	reviewedUpstream := map[string]bool{}
	for _, event := range events {
		if !slices.Contains(finding.EvidenceEventIDs, event.EventID) {
			continue
		}
		ids := []string{event.EventID}
		observed := event.Action == "DATA_SENT" && event.Outcome == "COMPLETED" &&
			slices.ContainsFunc(graph.Edges, func(edge entities.Edge) bool {
				return edge.EvidenceStatus == entities.Observed && edge.Source == event.SourceService &&
					edge.Target == event.DestinationService && slices.Contains(edge.EvidenceEventIDs, event.EventID)
			})
		target := event.DestinationService
		switch {
		case observed:
			review.Insights = append(review.Insights, Insight{"observation",
				fmt.Sprintf("The audit records a completed send from %s to %s. Recorded category: %s. Recorded purpose: %s.",
					event.SourceService, target, evidenceValue(event.Classification), evidenceValue(event.Purpose)), ids})
		case event.Action == "DATA_RECEIVED" && event.Outcome == "COMPLETED":
			if !entities.Meaningful(target) {
				target = event.Service
			}
			review.Insights = append(review.Insights, Insight{"uncertainty",
				fmt.Sprintf("The audit records a receipt at %s with category %s and purpose %s. The corresponding completed send and sender attribution remain unconfirmed.",
					evidenceValue(target), evidenceValue(event.Classification), evidenceValue(event.Purpose)), ids})
		default:
			continue
		}
		upstream := false
		if observed && finding.Status == entities.VerifiedViolation {
			for _, item := range related {
				if item.Status != entities.Inconclusive {
					continue
				}
				for _, id := range item.EvidenceEventIDs {
					if !slices.ContainsFunc(graph.Edges, func(edge entities.Edge) bool {
						return edge.EvidenceStatus == entities.Inferred && edge.Target == event.SourceService &&
							slices.Contains(edge.EvidenceEventIDs, id)
					}) {
						continue
					}
					upstream = true
					if !reviewedUpstream[id] && slices.ContainsFunc(events, func(record entities.Event) bool { return record.EventID == id }) {
						reviewedUpstream[id] = true
						review.Insights = append(review.Insights, Insight{"uncertainty",
							"A separate inferred link reaches the sending service. The supplied records leave the outbound data's upstream origin unresolved.", []string{id}})
					}
				}
			}
		}
		if event.Classification != "PII" || policy.Classification != event.Classification ||
			(finding.Status != entities.VerifiedViolation && finding.Status != entities.PotentialViolation) {
			continue
		}
		assessment := "insufficient_information"
		if observed {
			assessment = "potential_concern"
		}
		if policy.AllowedDestinations != nil && entities.Meaningful(target) && !slices.Contains(policy.AllowedDestinations, target) {
			missing := []string{"GDPR scope and whether real personal data was involved", "Recipient authorisation and the safeguards in place"}
			rationale := fmt.Sprintf("The audit names %s, which is outside the fixture policy's destination allowlist. This warrants checking confidentiality safeguards.", target)
			if !observed {
				missing = append(missing, "A matching completed send and sender attribution")
			}
			if upstream {
				missing = append(missing, "Evidence linking the inferred upstream relationship to the observed export")
			}
			review.Mappings = append(review.Mappings, GDPRMapping{confidentialityReference, assessment, rationale, ids, missing})
			review.Insights = append(review.Insights, Insight{"policy_concern", rationale, ids})
		}
		if policy.AllowedPurposes != nil && entities.Meaningful(event.Purpose) && !slices.Contains(policy.AllowedPurposes, event.Purpose) {
			missing := []string{"GDPR scope and the original collection purpose", "Evidence of further use and a compatibility assessment or other applicable basis for the change"}
			if !observed {
				missing = append(missing, "A matching completed send and sender attribution")
			}
			rationale := fmt.Sprintf("The audit records %s, a purpose outside the fixture policy's allowlist. The record leaves the original collection purpose and compatibility unresolved.", event.Purpose)
			review.Mappings = append(review.Mappings, GDPRMapping{purposeReference, assessment, rationale, ids, missing})
			review.Insights = append(review.Insights, Insight{"policy_concern", rationale, ids})
		}
	}
	return review
}

func evidenceValue(value string) string {
	if entities.Meaningful(value) {
		return value
	}
	return "unknown"
}
