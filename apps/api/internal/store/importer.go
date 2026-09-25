package store

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
)

// ImportReport is what a Supabase import copied (or would copy, on a dry run).
type ImportReport struct {
	Users int64
	// NoPassword counts accounts without a password hash (they must reset it).
	NoPassword int64
	// Rows per public table copied; Skipped are source tables the schema lacks.
	Rows    map[string]int64
	Skipped []string
	// PhotoKeys are the storage objects the imported rows point at.
	PhotoKeys []string
	// XPMismatches counts profiles whose xp differs from their ledger sum.
	XPMismatches int64
}

// notImported are target tables the source doesn't provide (or that migrations own).
var notImported = map[string]bool{"users": true, "goose_db_version": true}

// ImportSupabase copies a Supabase project's database into a freshly migrated,
// empty target (Phase 7.1, one-time): auth.users → users (bcrypt hashes kept;
// they are rehashed to argon2id on each user's next login), then every public
// table the two schemas share, column by column. It runs in one target
// transaction as the owner with triggers and FK checks off (replication role),
// so table order doesn't matter; a dry run rolls back. Reference tables the
// migrations seeded are replaced by the source's rows.
func ImportSupabase(ctx context.Context, sourceURL, targetURL string, dryRun bool) (ImportReport, error) {
	report := ImportReport{Rows: map[string]int64{}}
	src, err := pgx.Connect(ctx, sourceURL)
	if err != nil {
		return report, fmt.Errorf("connect source: %w", err)
	}
	defer func() { _ = src.Close(ctx) }()
	dst, err := pgx.Connect(ctx, targetURL)
	if err != nil {
		return report, fmt.Errorf("connect target: %w", err)
	}
	defer func() { _ = dst.Close(ctx) }()

	var existing int64
	if err := dst.QueryRow(ctx, `SELECT count(*) FROM public.users`).Scan(&existing); err != nil {
		return report, fmt.Errorf("target users: %w", err)
	}
	if existing > 0 {
		return report, errors.New("the target already has users — import into a freshly migrated database")
	}

	tx, err := dst.Begin(ctx)
	if err != nil {
		return report, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `SET LOCAL session_replication_role = replica`); err != nil {
		return report, fmt.Errorf("replication role (the target URL must be the owner): %w", err)
	}

	tables, err := publicTables(ctx, tx)
	if err != nil {
		return report, err
	}
	if _, err := tx.Exec(ctx, `TRUNCATE `+quotedTables(tables)); err != nil {
		return report, fmt.Errorf("clear target: %w", err)
	}
	if err := importUsers(ctx, src, tx, &report); err != nil {
		return report, err
	}
	sourceTables, err := publicTables(ctx, src)
	if err != nil {
		return report, err
	}
	for _, table := range sourceTables {
		if !slices.Contains(tables, table) && !notImported[table] {
			report.Skipped = append(report.Skipped, table)
		}
	}
	for _, table := range tables {
		if !slices.Contains(sourceTables, table) {
			continue
		}
		n, err := copyTable(ctx, src, tx, table)
		if err != nil {
			return report, err
		}
		report.Rows[table] = n
	}
	if err := resetSequences(ctx, tx); err != nil {
		return report, err
	}
	if err := collect(ctx, tx, `SELECT storage_path FROM public.body_photos ORDER BY storage_path`, &report.PhotoKeys); err != nil {
		return report, err
	}
	if err := tx.QueryRow(ctx, `
		SELECT count(*) FROM public.profiles p
		WHERE COALESCE(p.xp, 0) <> COALESCE((SELECT sum(amount) FROM public.xp_transactions x WHERE x.user_id = p.id), 0)`,
	).Scan(&report.XPMismatches); err != nil {
		return report, fmt.Errorf("xp check: %w", err)
	}
	if dryRun {
		return report, nil // deferred rollback
	}
	return report, tx.Commit(ctx)
}

// importUsers copies auth.users; an account without a password (magic link, OAuth)
// gets an unusable hash and signs in after a password reset.
func importUsers(ctx context.Context, src *pgx.Conn, dst pgx.Tx, report *ImportReport) error {
	n, err := pipe(ctx, src, dst, `
		SELECT id, email, COALESCE(NULLIF(encrypted_password, ''), '!'), email_confirmed_at,
		       COALESCE(created_at, now()), COALESCE(updated_at, created_at, now())
		FROM auth.users WHERE email IS NOT NULL AND deleted_at IS NULL`,
		`public.users (id, email, password_hash, email_verified_at, created_at, updated_at)`)
	if err != nil {
		return fmt.Errorf("copy users: %w", err)
	}
	report.Users = n
	return dst.QueryRow(ctx, `SELECT count(*) FROM public.users WHERE password_hash = '!'`).Scan(&report.NoPassword)
}

// copyTable copies the columns both schemas have. Ledger reasons that repeat a
// once-only key are relabeled "#dup<n>" on the way in (amounts kept), as
// migration 00009 did for existing data.
func copyTable(ctx context.Context, src *pgx.Conn, dst pgx.Tx, table string) (int64, error) {
	targetCols, err := columns(ctx, dst, table)
	if err != nil {
		return 0, err
	}
	sourceCols, err := columns(ctx, src, table)
	if err != nil {
		return 0, err
	}
	shared := []string{}
	for _, c := range targetCols {
		if slices.Contains(sourceCols, c) {
			shared = append(shared, c)
		}
	}
	selects := make([]string, len(shared))
	for i, c := range shared {
		selects[i] = pgx.Identifier{c}.Sanitize()
	}
	query := fmt.Sprintf(`SELECT %s FROM public.%s`, strings.Join(selects, ", "), pgx.Identifier{table}.Sanitize())
	if table == "xp_transactions" && slices.Contains(shared, "reason") {
		query = fmt.Sprintf(`SELECT %s FROM (%s) x`, strings.Join(selects, ", "), xpRelabel(selects))
	}
	n, err := pipe(ctx, src, dst, query, fmt.Sprintf("public.%s (%s)", pgx.Identifier{table}.Sanitize(), strings.Join(selects, ", ")))
	if err != nil {
		return 0, fmt.Errorf("copy %s: %w", table, err)
	}
	return n, nil
}

// pipe streams query's rows from src into target (text COPY both ways: values
// move exactly, whatever their types). Returns the rows copied.
func pipe(ctx context.Context, src *pgx.Conn, dst pgx.Tx, query, target string) (int64, error) {
	reader, writer := io.Pipe()
	done := make(chan error, 1)
	go func() {
		_, err := src.PgConn().CopyTo(ctx, writer, "COPY ("+query+") TO STDOUT")
		_ = writer.CloseWithError(err)
		done <- err
	}()
	tag, err := dst.Conn().PgConn().CopyFrom(ctx, reader, "COPY "+target+" FROM STDIN")
	_ = reader.CloseWithError(err)
	if readErr := <-done; readErr != nil && err == nil {
		err = readErr
	}
	return tag.RowsAffected(), err
}

// xpRelabel selects the ledger with the 2nd+ copy of a once-only reason renamed.
func xpRelabel(selects []string) string {
	cols := strings.Join(selects, ", ")
	cols = strings.Replace(cols, `"reason"`, `CASE WHEN n > 1 THEN reason || '#dup' || n ELSE reason END AS reason`, 1)
	return fmt.Sprintf(`
		SELECT %s FROM (
		  SELECT t.*, CASE
		      WHEN t.reason IS NULL OR split_part(t.reason, ':', 1) IN ('plan_item', 'plan_item_undo')
		        OR t.reason ~ '^workout_log:[0-9]+$' THEN 1
		      ELSE row_number() OVER (PARTITION BY t.user_id, t.reason ORDER BY t.created_at, t.id) END AS n
		  FROM public.xp_transactions t) ranked`, cols)
}

// publicTables lists the base tables in public.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func publicTables(ctx context.Context, q querier) ([]string, error) {
	var tables []string
	err := collect(ctx, q, `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`, &tables)
	return slices.DeleteFunc(tables, func(t string) bool { return notImported[t] }), err
}

// columns lists a table's writable columns (no generated ones).
func columns(ctx context.Context, q querier, table string) ([]string, error) {
	var cols []string
	err := collect(ctx, q, `
		SELECT column_name FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'
		ORDER BY ordinal_position`, &cols, table)
	return cols, err
}

// resetSequences moves every owned sequence past the imported ids.
func resetSequences(ctx context.Context, tx pgx.Tx) error {
	var stmts []string
	err := collect(ctx, tx, `
		SELECT format('SELECT setval(%L, COALESCE((SELECT max(%I) FROM %s), 0) + 1, false)', s.oid::regclass, a.attname, t.oid::regclass)
		FROM pg_class s
		JOIN pg_depend d ON d.objid = s.oid AND d.deptype IN ('a', 'i')
		JOIN pg_class t ON t.oid = d.refobjid
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
		JOIN pg_namespace n ON n.oid = t.relnamespace
		WHERE s.relkind = 'S' AND n.nspname = 'public'`, &stmts)
	if err != nil {
		return fmt.Errorf("list sequences: %w", err)
	}
	for _, stmt := range stmts {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("reset sequence: %w", err)
		}
	}
	return nil
}

func quotedTables(tables []string) string {
	quoted := make([]string, len(tables))
	for i, t := range tables {
		quoted[i] = pgx.Identifier{"public", t}.Sanitize()
	}
	return strings.Join(quoted, ", ")
}

// collect scans a single-column query into out.
func collect[T any](ctx context.Context, q querier, sql string, out *[]T, args ...any) error {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return err
	}
	values, err := pgx.CollectRows(rows, pgx.RowTo[T])
	*out = values
	return err
}
