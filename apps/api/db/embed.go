// Package db embeds the SQL migrations so the API binary can apply them
// without shipping loose files.
package db

import "embed"

// Migrations holds every goose migration under migrations/.
//
//go:embed migrations/*.sql
var Migrations embed.FS
