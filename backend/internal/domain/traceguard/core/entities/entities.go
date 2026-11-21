package entities

import "time"

type Event struct {
	EventID, TraceID, TransferID      string
	OccurredAt, ObservedAt            time.Time
	Service, Action, Outcome          string
	SourceService, DestinationService string
	DataRef, Classification, Purpose  string
}

type Policy struct {
	PolicyID, Classification             string
	AllowedDestinations, AllowedPurposes []string
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
