package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestSuggest(t *testing.T) {
	for _, tc := range []struct {
		name      string
		status    int
		body      string
		wantError bool
	}{
		{"valid", 200, `{"choices":[{"message":{"content":"{\"status\":\"INCONCLUSIVE\",\"evidence_refs\":[],\"step_ids\":[\"check_policy\"]}"},"finish_reason":"stop"}]}`, false},
		{"provider failure", 429, `{"error":"private response"}`, true},
		{"invalid model JSON", 200, `{"choices":[{"message":{"content":"unknown"},"finish_reason":"stop"}]}`, true},
		{"truncated", 200, `{"choices":[{"message":{"content":"{}"},"finish_reason":"length"}]}`, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			httpClient := &http.Client{Transport: transportFunc(func(req *http.Request) (*http.Response, error) {
				if req.URL.String() != endpoint || req.Header.Get("Authorization") != "Bearer synthetic-test-key" || req.Method != http.MethodPost {
					t.Fatal("unexpected request metadata")
				}
				return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
			})}
			got, err := New("synthetic-test-key", "model-test", time.Second, httpClient).Suggest(t.Context(), investigation.Request{Status: entities.Inconclusive})
			if (err != nil) != tc.wantError || (err == nil && got.Status != entities.Inconclusive) {
				t.Fatalf("suggestion = %+v, err = %v", got, err)
			}
		})
	}
}

func TestCancellationAndTimeout(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(req *http.Request) (*http.Response, error) {
		<-req.Context().Done()
		return nil, req.Context().Err()
	})}
	adapter := New("synthetic-test-key", "model-test", 20*time.Millisecond, client)
	_, err := adapter.Suggest(t.Context(), investigation.Request{})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("timeout: %v", err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = adapter.Suggest(ctx, investigation.Request{})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation: %v", err)
	}
}

func TestReviewStructuredOutput(t *testing.T) {
	var input investigation.Request
	if err := json.Unmarshal([]byte(`{"status":"INCONCLUSIVE","review":{"insights":[],"mappings":[]}}`), &input); err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Transport: transportFunc(func(req *http.Request) (*http.Response, error) {
		var payload struct {
			Format struct {
				Type   string                `json:"type"`
				Schema struct{ Strict bool } `json:"json_schema"`
			} `json:"response_format"`
		}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil || payload.Format.Type != "json_schema" || !payload.Format.Schema.Strict {
			t.Fatalf("wrong response format: %+v, %v", payload.Format, err)
		}
		body := `{"choices":[{"message":{"content":"{\"status\":\"INCONCLUSIVE\",\"evidence_refs\":[],\"step_ids\":[\"check_policy\"],\"review\":{\"insights\":[],\"mappings\":[]}}"},"finish_reason":"stop"}]}`
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, nil
	})}
	got, err := New("synthetic-test-key", "model-test", time.Second, client).Suggest(t.Context(), input)
	if err != nil || got.Review == nil {
		t.Fatalf("review=%+v err=%v", got, err)
	}
}

func TestRequestBodyIsRedacted(t *testing.T) {
	event := entities.Event{
		EventID: "evt-sentinel-901", DataRef: "subject-sentinel-ref",
		Action: "DATA_SENT", Outcome: "COMPLETED", Classification: "PII",
		SourceService: "sales-api", DestinationService: "external-crm",
	}
	finding := entities.Finding{
		RuleID: "DENY_EXTERNAL_PII", Status: entities.VerifiedViolation,
		EvidenceEventIDs: []string{event.EventID},
	}
	graph := entities.Graph{Edges: []entities.Edge{{
		Source: event.SourceService, Target: event.DestinationService,
		EvidenceStatus: entities.Observed, EvidenceEventIDs: []string{event.EventID},
	}}}
	policy := entities.Policy{Classification: "PII", AllowedDestinations: []string{"internal-crm"}}
	facts := investigation.NewFixtureFacts(finding, []entities.Event{event}, graph, policy, []entities.Finding{finding})

	var body []byte
	calls := 0
	client := &http.Client{Transport: transportFunc(func(req *http.Request) (*http.Response, error) {
		calls++
		var err error
		body, err = io.ReadAll(req.Body)
		if err != nil {
			t.Fatal(err)
		}
		// Rank the observed send, the destination concern, and its confidentiality mapping.
		content := `{"status":"VERIFIED_VIOLATION","evidence_refs":["E1"],"step_ids":["review_export"],"review":{"insights":[{"id":"I1","evidence_refs":["E1"]},{"id":"I2","evidence_refs":["E1"]}],"mappings":[{"id":"5(1)(f)","evidence_refs":["E1"]}]}}`
		message, err := json.Marshal(content)
		if err != nil {
			t.Fatal(err)
		}
		response := `{"choices":[{"finish_reason":"stop","message":{"content":` + string(message) + `}}]}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(response))}, nil
	})}

	service := investigation.New(New("synthetic-test-key", "model-test", time.Second, client))
	result, err := service.ExplainFixture(t.Context(), finding, facts)
	if err != nil || calls != 1 || result.Mode != "ai" {
		t.Fatalf("provider calls=%d mode=%q err=%v", calls, result.Mode, err)
	}
	if !strings.Contains(string(body), `\"ref\":\"E1\"`) {
		t.Error("serialized request is missing evidence alias E1")
	}
	for _, sentinel := range []string{event.EventID, event.DataRef} {
		if strings.Contains(string(body), sentinel) {
			t.Errorf("serialized request contains sentinel %q", sentinel)
		}
	}
}
