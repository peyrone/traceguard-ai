package enforcement

import (
	"testing"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

func TestSimulate(t *testing.T) {
	policy := entities.Policy{PolicyID: "policy-001", Classification: "PII",
		AllowedDestinations: []string{"sales-api"}, AllowedPurposes: []string{"CUSTOMER_SERVICE"}}
	valid := Request{SourceService: "customer-api", DestinationService: "sales-api",
		DataCategories: []string{"PII"}, Purpose: "CUSTOMER_SERVICE", PolicyID: "policy-001"}
	for _, tc := range []struct {
		name     string
		policy   *entities.Policy
		change   func(*Request)
		decision Decision
		rule     string
	}{
		{"allowed", &policy, nil, Allow, "TRANSFER_POLICY"},
		{"denied destination", &policy, func(r *Request) { r.DestinationService = "external-crm" }, Deny, "DENY_EXTERNAL_PII"},
		{"denied purpose", &policy, func(r *Request) { r.Purpose = "MARKETING" }, Deny, "DENY_PURPOSE"},
		{"missing policy", nil, nil, Indeterminate, "TRANSFER_POLICY"},
		{"wrong policy", &policy, func(r *Request) { r.PolicyID = "unknown" }, Indeterminate, "TRANSFER_POLICY"},
		{"missing source", &policy, func(r *Request) { r.SourceService = " " }, Indeterminate, "TRANSFER_POLICY"},
		{"missing purpose", &policy, func(r *Request) { r.Purpose = "" }, Indeterminate, "TRANSFER_POLICY"},
		{"missing categories", &policy, func(r *Request) { r.DataCategories = nil }, Indeterminate, "TRANSFER_POLICY"},
		{"uncovered category", &policy, func(r *Request) { r.DataCategories = []string{"PII", "UNKNOWN"} }, Indeterminate, "TRANSFER_POLICY"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := valid
			if tc.change != nil {
				tc.change(&req)
			}
			calls := 0
			got := simulate(t.Context(), req, tc.policy, func(request Request) *SyntheticTransfer {
				calls++
				return executeSynthetic(request)
			})
			executed := tc.decision == Allow
			if got.Decision != tc.decision || got.RuleID != tc.rule || got.Reason == "" ||
				got.TransferExecuted != executed || (got.Transfer != nil) != executed || (calls == 1) != executed || calls > 1 {
				t.Fatalf("result = %+v, executions = %d", got, calls)
			}
			if executed && (got.Transfer.SourceService != req.SourceService || got.Transfer.DestinationService != req.DestinationService) {
				t.Fatalf("unexpected synthetic transfer: %+v", got.Transfer)
			}
		})
	}
}
