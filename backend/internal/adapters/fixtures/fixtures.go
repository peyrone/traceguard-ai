// Package fixtures provides the synthetic demo scenarios embedded in the API.
package fixtures

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/ports"
)

//go:embed data/*.json
var data embed.FS

var catalog = []entities.Scenario{
	{ID: "allowed_transfer", Label: "Allowed transfer"},
	{ID: "unauthorized_transfer", Label: "Unauthorized transfer"},
	{ID: "shuffled_transfer", Label: "Shuffled audit events"},
	{ID: "missing_intermediate", Label: "Missing intermediate evidence"},
	{ID: "partial_evidence_confirmed", Label: "Partial evidence, confirmed violation"},
}

type Store struct{}

func (Store) List() []entities.Scenario {
	return slices.Clone(catalog)
}

func (Store) Load(ctx context.Context, id string) ([]entities.Event, entities.Policy, error) {
	if err := ctx.Err(); err != nil {
		return nil, entities.Policy{}, fmt.Errorf("load scenario: %w", err)
	}
	if !slices.ContainsFunc(catalog, func(s entities.Scenario) bool { return s.ID == id }) {
		return nil, entities.Policy{}, fmt.Errorf("load scenario %q: %w", id, ports.ErrScenarioNotFound)
	}
	raw, err := data.ReadFile("data/" + id + ".json")
	if err != nil {
		return nil, entities.Policy{}, fmt.Errorf("read scenario %q: %w", id, err)
	}
	var fixture struct {
		Events []entities.Event `json:"events"`
		Policy entities.Policy  `json:"policy"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		return nil, entities.Policy{}, fmt.Errorf("decode scenario %q: %w", id, err)
	}
	return fixture.Events, fixture.Policy, nil
}
