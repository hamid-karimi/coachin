package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/community"
)

// CommunityService is the social surfaces (flag-gated).
type CommunityService interface {
	Leaderboard(ctx context.Context, userID uuid.UUID, board community.Board) (community.Leaderboard, error)
	Clubs(ctx context.Context, userID uuid.UUID) ([]community.Membership, error)
	CreateClub(ctx context.Context, userID uuid.UUID, name, description string) (string, error)
	JoinClub(ctx context.Context, userID uuid.UUID, code string) (string, error)
	SetPrimaryClub(ctx context.Context, userID, clubID uuid.UUID) (string, error)
	LeaveClub(ctx context.Context, userID, clubID uuid.UUID) (string, error)
}

// CircleService is the Circle tab (flag-gated).
type CircleService interface {
	Circle(ctx context.Context, userID uuid.UUID) (community.CircleView, error)
	People(ctx context.Context, userID uuid.UUID, term string, page int) (community.PeoplePage, error)
	Follow(ctx context.Context, userID, id uuid.UUID) (string, error)
	Unfollow(ctx context.Context, userID, id uuid.UUID) (string, error)
}

// PersonBody is another user as the community shows them (no email).
type PersonBody struct {
	UserID    uuid.UUID `json:"userId"`
	Name      string    `json:"name" doc:"Full name, else \"Athlete\""`
	AvatarURL *string   `json:"avatarUrl"`
	Level     int64     `json:"level"`
	Tier      string    `json:"tier"`
	XP        int64     `json:"xp"`
	Following bool      `json:"following"`
}

// CoachRefBody is one of your coaches.
type CoachRefBody struct {
	PersonBody
	Sport string `json:"sport" doc:"Sport name, else \"General coaching\""`
}

// CircleBody is who you follow and your coaches.
type CircleBody struct {
	Following []PersonBody   `json:"following"`
	Coaches   []CoachRefBody `json:"coaches"`
}

type circleOutput struct {
	Body CircleBody
}

type peopleInput struct {
	Q    string `query:"q" maxLength:"200" doc:"Name contains, or an exact email"`
	Page int    `query:"page" minimum:"1" default:"1"`
}

// PeopleBody is a page of search results.
type PeopleBody struct {
	People  []PersonBody `json:"people"`
	Page    int          `json:"page"`
	HasNext bool         `json:"hasNext"`
}

type peopleOutput struct {
	Body PeopleBody
}

type followInput struct {
	Body struct {
		UserID uuid.UUID `json:"userId"`
	}
}

func personBody(r community.Row, following bool) PersonBody {
	p := PersonBody{UserID: r.ID, Name: deref(r.FullName), AvatarURL: r.AvatarURL, Level: r.Level, Tier: deref(r.LeagueTier), XP: r.XP, Following: following}
	if p.Name == "" {
		p.Name = "Athlete"
	}
	if p.Tier == "" {
		p.Tier = "bronze"
	}
	return p
}

func registerCircle(api huma.API, deps Deps) {
	svc, logger := deps.Circle, deps.logger()
	gated := huma.Middlewares{communityOnly(api, deps.CommunityEnabled), requireUser(api)}
	tags := []string{"community"}
	result := func(msg string) *resultOutput {
		return &resultOutput{Body: ResultBody{Status: "success", Message: msg}}
	}

	huma.Register(api, huma.Operation{
		OperationID: "getCircle", Method: http.MethodGet, Path: "/community/circle",
		Summary: "People you follow and your coaches", Tags: tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, _ *struct{}) (*circleOutput, error) {
		userID, _ := userFrom(ctx)
		c, err := svc.Circle(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := CircleBody{Following: make([]PersonBody, len(c.Following)), Coaches: make([]CoachRefBody, len(c.Coaches))}
		for i, r := range c.Following {
			body.Following[i] = personBody(r, true)
		}
		for i, coach := range c.Coaches {
			body.Coaches[i] = CoachRefBody{PersonBody: personBody(coach.Row, false), Sport: deref(coach.SportName)}
			if body.Coaches[i].Sport == "" {
				body.Coaches[i].Sport = "General coaching"
			}
		}
		return &circleOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "searchPeople", Method: http.MethodGet, Path: "/community/people",
		Summary:     "Find people to follow (by name, or an exact email)",
		Description: "Top lifetime XP first, 10 per page; never returns emails.",
		Tags:        tags, Middlewares: huma.Middlewares{communityOnly(api, deps.CommunityEnabled), requireUser(api), rateLimited(api, newLimiter(time.Second, 20))},
		Errors: []int{401, 404, 429},
	}, func(ctx context.Context, in *peopleInput) (*peopleOutput, error) {
		userID, _ := userFrom(ctx)
		page, err := svc.People(ctx, userID, in.Q, in.Page)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := PeopleBody{People: make([]PersonBody, len(page.People)), Page: page.Page, HasNext: page.HasNext}
		for i, p := range page.People {
			body.People[i] = personBody(p.Row, p.Following)
		}
		return &peopleOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "follow", Method: http.MethodPost, Path: "/community/follows",
		Summary: "Follow someone", Tags: tags, DefaultStatus: http.StatusCreated, Middlewares: gated, Errors: []int{400, 401, 404, 409},
	}, func(ctx context.Context, in *followInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.Follow(ctx, userID, in.Body.UserID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result(msg), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "unfollow", Method: http.MethodDelete, Path: "/community/follows/{id}",
		Summary: "Unfollow someone", Tags: tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.Unfollow(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result(msg), nil
	})
}

// communityOnly answers 404 while the community flag is off, so the
// surfaces don't exist rather than merely being hidden.
func communityOnly(api huma.API, enabled bool) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		if !enabled {
			_ = huma.WriteErr(api, ctx, http.StatusNotFound, "Not found")
			return
		}
		next(ctx)
	}
}

// LeaderboardRowBody is one ranked athlete. No email: boards reach people
// the viewer doesn't know.
type LeaderboardRowBody struct {
	Rank      int       `json:"rank"`
	UserID    uuid.UUID `json:"userId"`
	Name      string    `json:"name" doc:"Full name, else \"Athlete\""`
	AvatarURL *string   `json:"avatarUrl"`
	Level     int64     `json:"level"`
	Tier      string    `json:"tier"`
	XP        int64     `json:"xp" doc:"This week's XP, or lifetime XP when weekly is false"`
	IsYou     bool      `json:"isYou"`
}

// LeaderboardBody is a ranked board.
type LeaderboardBody struct {
	Board           string               `json:"board" enum:"global,club,circle"`
	PrimaryClubName *string              `json:"primaryClubName,omitempty"`
	Weekly          bool                 `json:"weekly" doc:"False: nobody earned XP this week, ranked by lifetime XP"`
	Rows            []LeaderboardRowBody `json:"rows"`
}

type leaderboardInput struct {
	Board string `query:"board" enum:"global,club,circle" default:"global"`
}

type leaderboardOutput struct {
	Body LeaderboardBody
}

// ClubMembershipBody is one of the user's clubs.
type ClubMembershipBody struct {
	ClubID     uuid.UUID `json:"clubId"`
	Name       string    `json:"name"`
	InviteCode string    `json:"inviteCode"`
	Role       string    `json:"role" doc:"owner or member"`
	IsPrimary  bool      `json:"isPrimary"`
}

// ClubsBody is the user's memberships.
type ClubsBody struct {
	Clubs []ClubMembershipBody `json:"clubs"`
}

type clubsOutput struct {
	Body ClubsBody
}

type createClubInput struct {
	Body struct {
		Name        string `json:"name" maxLength:"200"`
		Description string `json:"description,omitempty" maxLength:"2000"`
	}
}

type joinClubInput struct {
	Body struct {
		Code string `json:"code" maxLength:"64"`
	}
}

func leaderboardBody(userID uuid.UUID, lb community.Leaderboard) LeaderboardBody {
	body := LeaderboardBody{Board: string(lb.Board), PrimaryClubName: lb.PrimaryClubName, Weekly: lb.Weekly, Rows: make([]LeaderboardRowBody, len(lb.Rows))}
	for i, r := range lb.Rows {
		row := LeaderboardRowBody{Rank: i + 1, UserID: r.ID, Name: deref(r.FullName), AvatarURL: r.AvatarURL, Level: r.Level, Tier: deref(r.LeagueTier), XP: r.XP, IsYou: r.ID == userID}
		if row.Name == "" {
			row.Name = "Athlete"
		}
		if row.Tier == "" {
			row.Tier = "bronze"
		}
		body.Rows[i] = row
	}
	return body
}

func registerCommunity(api huma.API, deps Deps) {
	svc, logger := deps.Community, deps.logger()
	gated := huma.Middlewares{communityOnly(api, deps.CommunityEnabled), requireUser(api)}
	codeLimited := huma.Middlewares{communityOnly(api, deps.CommunityEnabled), requireUser(api), rateLimited(api, newLimiter(10*time.Second, 5))}
	tags := []string{"community"}
	result := func(msg string) *resultOutput {
		return &resultOutput{Body: ResultBody{Status: "success", Message: msg}}
	}

	huma.Register(api, huma.Operation{
		OperationID: "getLeaderboard", Method: http.MethodGet, Path: "/community/leaderboard",
		Summary:     "Weekly leaderboard: everyone, your primary club, or who you follow",
		Description: "404 while the community flag is off.",
		Tags:        tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, in *leaderboardInput) (*leaderboardOutput, error) {
		userID, _ := userFrom(ctx)
		lb, err := svc.Leaderboard(ctx, userID, community.Board(in.Board))
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &leaderboardOutput{Body: leaderboardBody(userID, lb)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listClubs", Method: http.MethodGet, Path: "/community/clubs",
		Summary: "Your clubs", Tags: tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, _ *struct{}) (*clubsOutput, error) {
		userID, _ := userFrom(ctx)
		clubs, err := svc.Clubs(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := ClubsBody{Clubs: make([]ClubMembershipBody, len(clubs))}
		for i, c := range clubs {
			body.Clubs[i] = ClubMembershipBody(c)
		}
		return &clubsOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "createClub", Method: http.MethodPost, Path: "/community/clubs",
		Summary: "Create a club (you own it; primary if you have none)", Tags: tags,
		DefaultStatus: http.StatusCreated, Middlewares: gated, Errors: []int{400, 401, 404, 502},
	}, func(ctx context.Context, in *createClubInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.CreateClub(ctx, userID, in.Body.Name, in.Body.Description)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result(msg), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "joinClub", Method: http.MethodPost, Path: "/community/clubs/join",
		Summary: "Join a club by invite code", Tags: tags, Middlewares: codeLimited, Errors: []int{400, 401, 404, 429},
	}, func(ctx context.Context, in *joinClubInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.JoinClub(ctx, userID, in.Body.Code)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result(msg), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setPrimaryClub", Method: http.MethodPut, Path: "/community/clubs/{id}/primary",
		Summary: "Make a club your primary (the My Club board)", Tags: tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.SetPrimaryClub(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result(msg), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "leaveClub", Method: http.MethodDelete, Path: "/community/clubs/{id}/membership",
		Summary: "Leave a club", Tags: tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.LeaveClub(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result(msg), nil
	})
}
