// Package ai adapts the OpenAI Chat Completions API to investigation.Provider.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
)

const endpoint = "https://api.openai.com/v1/chat/completions"
const maxResponseBytes = 64 << 10

const instructions = "Prioritize follow-up actions for this audit finding. Return one JSON object with status copied exactly, evidence_refs containing all supplied refs exactly once, and step_ids containing one to three distinct values from the supplied applicable_step_ids. Do not include prose or extra fields."

type Client struct {
	apiKey, model string
	timeout       time.Duration
	http          *http.Client
}

var _ investigation.Provider = (*Client)(nil)

func New(apiKey, model string, timeout time.Duration, client *http.Client) *Client {
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	if client == nil {
		client = http.DefaultClient
	}
	bounded := *client
	bounded.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return &Client{apiKey: apiKey, model: model, timeout: min(timeout, 5*time.Second), http: &bounded}
}

func (c *Client) Suggest(ctx context.Context, input investigation.Request) (investigation.Suggestion, error) {
	var result investigation.Suggestion
	if c.apiKey == "" || c.model == "" {
		return result, errors.New("AI provider configuration is incomplete")
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	evidence, err := json.Marshal(input)
	if err != nil {
		return result, fmt.Errorf("encode investigation input: %w", err)
	}
	type message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	payload, err := json.Marshal(struct {
		Model               string            `json:"model"`
		Messages            []message         `json:"messages"`
		ResponseFormat      map[string]string `json:"response_format"`
		MaxCompletionTokens int               `json:"max_completion_tokens"`
	}{
		Model: c.model, Messages: []message{{Role: "system", Content: instructions}, {Role: "user", Content: string(evidence)}},
		ResponseFormat: map[string]string{"type": "json_object"}, MaxCompletionTokens: 512,
	})
	if err != nil {
		return result, fmt.Errorf("encode AI request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return result, fmt.Errorf("create AI request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(req)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return result, fmt.Errorf("AI request interrupted: %w", ctxErr)
		}
		return result, errors.New("AI request failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return result, fmt.Errorf("AI provider returned HTTP %d", response.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return result, fmt.Errorf("AI response interrupted: %w", ctxErr)
		}
		return result, errors.New("could not read AI response")
	}
	if len(body) > maxResponseBytes {
		return result, errors.New("AI response exceeded size limit")
	}
	var envelope struct {
		Choices []struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				Content string `json:"content"`
				Refusal string `json:"refusal"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(body, &envelope) != nil || len(envelope.Choices) != 1 ||
		envelope.Choices[0].FinishReason != "stop" || envelope.Choices[0].Message.Refusal != "" {
		return result, errors.New("invalid AI response envelope")
	}
	decoder := json.NewDecoder(strings.NewReader(envelope.Choices[0].Message.Content))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&result) != nil || decoder.Decode(new(any)) != io.EOF ||
		result.Status == "" || result.EvidenceRefs == nil || result.StepIDs == nil {
		return investigation.Suggestion{}, errors.New("invalid AI suggestion")
	}
	return result, nil
}
