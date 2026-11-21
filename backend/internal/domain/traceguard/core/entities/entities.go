package entities

import "time"

type Event struct {
	EventID            string    `json:"event_id"`
	TraceID            string    `json:"trace_id"`
	TransferID         string    `json:"transfer_id"`
	OccurredAt         time.Time `json:"occurred_at"`
	ObservedAt         time.Time `json:"observed_at"`
	Service            string    `json:"service"`
	Action             string    `json:"action"`
	Outcome            string    `json:"outcome"`
	SourceService      string    `json:"source_service"`
	DestinationService string    `json:"destination_service"`
	DataRef            string    `json:"data_ref"`
	Classification     string    `json:"classification"`
	Purpose            string    `json:"purpose"`
}

type Policy struct {
	PolicyID            string   `json:"policy_id"`
	Classification      string   `json:"classification"`
	AllowedDestinations []string `json:"allowed_destinations"`
	AllowedPurposes     []string `json:"allowed_purposes"`
}

type EvidenceStatus string

const (
	Observed EvidenceStatus = "OBSERVED"
	Inferred EvidenceStatus = "INFERRED"
)

type Status string

const (
	VerifiedViolation   Status = "VERIFIED_VIOLATION"
	PotentialViolation  Status = "POTENTIAL_VIOLATION"
	Inconclusive        Status = "INCONCLUSIVE"
	NoViolationObserved Status = "NO_VIOLATION_OBSERVED"
)

type Node struct {
	ID, Label, Kind string
}

type Edge struct {
	ID, Source, Target string
	EvidenceStatus     EvidenceStatus
	EvidenceEventIDs   []string
}

type Graph struct {
	Nodes []Node
	Edges []Edge
}

type Finding struct {
	ID, RuleID                        string
	Status                            Status
	Message                           string
	EvidenceEventIDs, MissingEvidence []string
}

type Scenario struct {
	ID, Label string
}
