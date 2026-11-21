package ports

import (
	"context"
	"errors"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

var ErrScenarioNotFound = errors.New("scenario not found")

type Fixtures interface {
	List() []entities.Scenario
	Load(ctx context.Context, id string) ([]entities.Event, entities.Policy, error)
}

type Lineage interface {
	Reconstruct(events []entities.Event) ([]entities.Event, entities.Graph)
}

type Detector interface {
	Detect(ctx context.Context, events []entities.Event, graph entities.Graph, policy entities.Policy) ([]entities.Finding, error)
}
