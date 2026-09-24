// Command api is the CoachIn backend. One binary, several roles:
//
//	api serve                 run the HTTP API (default)
//	api migrate [up|down|status]
//	api storage-init          bootstrap the Garage node (layout, bucket, key)
//	api openapi               print the OpenAPI 3.1 document
//	api healthcheck           exit 0 when the local server is live (for Docker)
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"slices"
	"strings"
	"syscall"
)

type command func(ctx context.Context, args []string, logger *slog.Logger) error

var commands = map[string]command{
	"serve":        serve,
	"migrate":      migrate,
	"storage-init": storageInit,
	"openapi":      printOpenAPI,
	"healthcheck":  healthcheck,
}

func main() {
	os.Exit(run())
}

// run returns the exit code, so deferred cleanup happens before os.Exit.
func run() int {
	name, args := "serve", []string{}
	if len(os.Args) > 1 {
		name, args = os.Args[1], os.Args[2:]
	}

	cmd, ok := commands[name]
	if !ok {
		fmt.Fprintf(os.Stderr, "unknown command %q; available: %s\n", name, strings.Join(commandNames(), ", "))
		return 2
	}

	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := cmd(ctx, args, logger); err != nil {
		logger.Error(name+" failed", "error", err)
		return 1
	}
	return 0
}

func commandNames() []string {
	names := make([]string, 0, len(commands))
	for name := range commands {
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}
