package community

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
)

// Person is someone to follow (never their email).
type Person struct {
	Row
	Following bool
}

// Coach is one of the user's active coaches.
type Coach struct {
	Row
	SportName *string
}

// CircleStore reads and writes the social graph as the signed-in user.
type CircleStore interface {
	FollowingProfiles(ctx context.Context, userID uuid.UUID) ([]Row, error)
	MyCoaches(ctx context.Context, userID uuid.UUID) ([]Coach, error)
	// SearchPeople skips skip rows and returns up to limit.
	SearchPeople(ctx context.Context, userID uuid.UUID, term string, skip, limit int) ([]Person, error)
	ProfileExists(ctx context.Context, userID, id uuid.UUID) (bool, error)
	// Follow returns false when already following.
	Follow(ctx context.Context, userID, id uuid.UUID) (bool, error)
	// Unfollow returns false when not following.
	Unfollow(ctx context.Context, userID, id uuid.UUID) (bool, error)
}

// CircleService is the Circle tab.
type CircleService struct{ store CircleStore }

// NewCircleService builds the service.
func NewCircleService(store CircleStore) *CircleService { return &CircleService{store: store} }

// CircleView is who you follow and your coaches.
type CircleView struct {
	Following []Row
	Coaches   []Coach
}

// Circle reads the tab.
func (s *CircleService) Circle(ctx context.Context, userID uuid.UUID) (CircleView, error) {
	following, err := s.store.FollowingProfiles(ctx, userID)
	if err != nil {
		return CircleView{}, fmt.Errorf("following: %w", err)
	}
	coaches, err := s.store.MyCoaches(ctx, userID)
	if err != nil {
		return CircleView{}, fmt.Errorf("coaches: %w", err)
	}
	return CircleView{Following: following, Coaches: coaches}, nil
}

// Search paging (legacy page size).
const (
	PeoplePageSize = 10
	maxSearchTerm  = 80
)

// PeoplePage is one page of search results.
type PeoplePage struct {
	People  []Person
	Page    int
	HasNext bool
}

// People lists others by name (or an exact email), top XP first; an empty
// term lists everyone. Emails never come back.
func (s *CircleService) People(ctx context.Context, userID uuid.UUID, term string, page int) (PeoplePage, error) {
	page = max(page, 1)
	term = strings.TrimSpace(term)
	if utf8.RuneCountInString(term) > maxSearchTerm {
		term = string([]rune(term)[:maxSearchTerm])
	}
	people, err := s.store.SearchPeople(ctx, userID, term, (page-1)*PeoplePageSize, PeoplePageSize+1)
	if err != nil {
		return PeoplePage{}, fmt.Errorf("search people: %w", err)
	}
	out := PeoplePage{Page: page, HasNext: len(people) > PeoplePageSize, People: people}
	if out.HasNext {
		out.People = people[:PeoplePageSize]
	}
	return out, nil
}

// Follow adds someone to your circle.
func (s *CircleService) Follow(ctx context.Context, userID, id uuid.UUID) (string, error) {
	if id == userID {
		return "", apperr.New(apperr.Invalid, "You cannot follow yourself.")
	}
	exists, err := s.store.ProfileExists(ctx, userID, id)
	if err != nil {
		return "", fmt.Errorf("find user: %w", err)
	}
	if !exists {
		return "", apperr.New(apperr.NotFound, "User not found")
	}
	added, err := s.store.Follow(ctx, userID, id)
	if err != nil {
		return "", fmt.Errorf("follow: %w", err)
	}
	if !added {
		return "", apperr.New(apperr.Conflict, "You already follow this user.")
	}
	return "User followed.", nil
}

// Unfollow removes someone from your circle.
func (s *CircleService) Unfollow(ctx context.Context, userID, id uuid.UUID) (string, error) {
	removed, err := s.store.Unfollow(ctx, userID, id)
	if err != nil {
		return "", fmt.Errorf("unfollow: %w", err)
	}
	if !removed {
		return "", apperr.New(apperr.NotFound, "You don't follow this user.")
	}
	return "User unfollowed.", nil
}
