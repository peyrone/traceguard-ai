// Package enforcement gates synthetic transfers on a pre-transfer policy decision.
package enforcement

import (
	"context"
	"slices"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

type Decision string

const (
	Allow         Decision = "ALLOW"
	Deny          Decision = "DENY"
	Indeterminate Decision = "INDETERMINATE"
)

type Request struct {
	SourceService      string
	DestinationService string
	DataCategories     []string
	Purpose            string
	PolicyID           string
}

// Result records a synthetic attempt. It is separate from lineage audit events.
type Result struct {
	Decision         Decision
	RuleID           string
	Reason           string
	TransferExecuted bool
	Transfer         *SyntheticTransfer
}

// SyntheticTransfer is a receipt for the in-memory demo operation.
type SyntheticTransfer struct {
	SourceService      string
	DestinationService string
	DataCategories     []string
	Purpose            string
}

// Simulate uses a trusted policy supplied by the caller. The request policy ID
// selects the policy and cannot supply or override its allowlists.
func Simulate(ctx context.Context, request Request, policy *entities.Policy) Result {
	return simulate(ctx, request, policy, executeSynthetic)
}

func simulate(ctx context.Context, request Request, policy *entities.Policy, execute func(Request) *SyntheticTransfer) Result {
	result := decide(request, policy)
	if ctx.Err() != nil {
		return Result{Decision: Indeterminate, RuleID: "TRANSFER_POLICY", Reason: "Policy evaluation was canceled."}
	}
	if result.Decision == Allow {
		result.Transfer = execute(request)
		result.TransferExecuted = result.Transfer != nil
	}
	return result
}

func decide(request Request, policy *entities.Policy) Result {
	if !entities.Meaningful(request.SourceService) || !entities.Meaningful(request.DestinationService) ||
		!entities.Meaningful(request.Purpose) || !entities.Meaningful(request.PolicyID) || len(request.DataCategories) == 0 {
		return Result{Decision: Indeterminate, RuleID: "TRANSFER_POLICY", Reason: "Required transfer attributes are missing."}
	}
	if policy == nil || policy.PolicyID != request.PolicyID || !entities.Meaningful(policy.Classification) ||
		policy.AllowedDestinations == nil || policy.AllowedPurposes == nil {
		return Result{Decision: Indeterminate, RuleID: "TRANSFER_POLICY", Reason: "The requested privacy policy is unavailable or incomplete."}
	}
	for _, category := range request.DataCategories {
		if category != policy.Classification {
			return Result{Decision: Indeterminate, RuleID: "TRANSFER_POLICY", Reason: "The selected privacy policy does not cover every data category."}
		}
	}
	if !slices.Contains(policy.AllowedDestinations, request.DestinationService) {
		return Result{Decision: Deny, RuleID: "DENY_EXTERNAL_PII", Reason: "Destination is not permitted by the privacy policy."}
	}
	if !slices.Contains(policy.AllowedPurposes, request.Purpose) {
		return Result{Decision: Deny, RuleID: "DENY_PURPOSE", Reason: "Purpose is not permitted by the privacy policy."}
	}
	return Result{Decision: Allow, RuleID: "TRANSFER_POLICY", Reason: "The privacy policy permits the destination and purpose."}
}

func executeSynthetic(request Request) *SyntheticTransfer {
	return &SyntheticTransfer{
		SourceService: request.SourceService, DestinationService: request.DestinationService,
		DataCategories: slices.Clone(request.DataCategories), Purpose: request.Purpose,
	}
}
