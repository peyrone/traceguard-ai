package investigation

import (
	"slices"
	"strconv"
)

// ReviewSelection refers to one server-written claim or legal mapping and
// repeats its supporting aliases. The model cannot introduce new prose.
type ReviewSelection struct {
	ID           string   `json:"id"`
	EvidenceRefs []string `json:"evidence_refs"`
}

type ReviewRanking struct {
	Insights []ReviewSelection `json:"insights"`
	Mappings []ReviewSelection `json:"mappings"`
}

type reviewInsight struct {
	ReviewSelection
	Kind string `json:"kind"`
	Text string `json:"text"`
}

type reviewMapping struct {
	ReviewSelection
	Reference    GDPRReference `json:"reference"`
	Assessment   string        `json:"assessment"`
	Rationale    string        `json:"rationale"`
	MissingFacts []string      `json:"missing_facts"`
}

type reviewPrompt struct {
	Insights []reviewInsight `json:"insights"`
	Mappings []reviewMapping `json:"mappings"`
}

func reviewChoices(review EvidenceReview, aliases map[string]string) reviewPrompt {
	prompt := reviewPrompt{Insights: []reviewInsight{}, Mappings: []reviewMapping{}}
	mapRefs := func(ids []string) []string {
		refs := make([]string, 0, len(ids))
		for _, id := range ids {
			refs = append(refs, aliases[id])
		}
		return refs
	}
	for i, item := range review.Insights {
		prompt.Insights = append(prompt.Insights, reviewInsight{
			ReviewSelection{"I" + strconv.Itoa(i+1), mapRefs(item.EvidenceEventIDs)}, item.Kind, item.Text,
		})
	}
	for _, item := range review.Mappings {
		prompt.Mappings = append(prompt.Mappings, reviewMapping{
			ReviewSelection{item.Reference.Article, mapRefs(item.EvidenceEventIDs)},
			item.Reference, item.Assessment, item.Rationale, item.MissingFacts,
		})
	}
	return prompt
}

func rankReview(review EvidenceReview, prompt reviewPrompt, ranking ReviewRanking) (EvidenceReview, bool) {
	insights, ok := rankSelections(review.Insights, len(prompt.Insights), func(i int) ReviewSelection {
		return prompt.Insights[i].ReviewSelection
	}, ranking.Insights)
	if !ok {
		return review, false
	}
	mappings, ok := rankSelections(review.Mappings, len(prompt.Mappings), func(i int) ReviewSelection {
		return prompt.Mappings[i].ReviewSelection
	}, ranking.Mappings)
	if !ok {
		return review, false
	}
	return EvidenceReview{Insights: insights, Mappings: mappings}, true
}

func rankSelections[T any](items []T, optionCount int, option func(int) ReviewSelection, selected []ReviewSelection) ([]T, bool) {
	if len(selected) != len(items) || len(items) != optionCount || selected == nil {
		return nil, false
	}
	result := make([]T, 0, len(items))
	used := make([]bool, optionCount)
	for _, item := range selected {
		matched := false
		for i := range optionCount {
			expected := option(i)
			if used[i] || item.ID != expected.ID || slices.Contains(expected.EvidenceRefs, "") ||
				!slices.Equal(sortedCopy(item.EvidenceRefs), sortedCopy(expected.EvidenceRefs)) {
				continue
			}
			result = append(result, items[i])
			used[i], matched = true, true
			break
		}
		if !matched {
			return nil, false
		}
	}
	return result, true
}
