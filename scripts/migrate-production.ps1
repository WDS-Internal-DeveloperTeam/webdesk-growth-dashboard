<#
.SYNOPSIS
    Applies pending database migrations to the PRODUCTION database, safely.

.DESCRIPTION
    Wraps the `@webdesk/database` migrate scripts with the handling this project has
    always used for production: read the connection string from `prod-db.env` (never
    hardcoded, never echoed), show what is pending BEFORE changing anything, require a
    typed confirmation, apply, then independently re-verify.

    Deliberately has NO down/revert path. Reverting production is not a routine
    operation and must never be one keystroke away — if a migration needs reverting,
    that is a considered decision made with the full context in front of you.

.PARAMETER StatusOnly
    Read-only. Reports pending migrations and exits without writing anything.
    Safe to run at any time.

.PARAMETER EnvFile
    Path to the env file holding DATABASE_URL. Defaults to `prod-db.env` in the repo root.

.EXAMPLE
    .\scripts\migrate-production.ps1 -StatusOnly
    Check what is pending. Changes nothing.

.EXAMPLE
    .\scripts\migrate-production.ps1
    Show pending migrations, ask for confirmation, apply, then verify.

.NOTES
    Run from the repository root. Requires pnpm on PATH.
#>

[CmdletBinding()]
param(
    [switch]$StatusOnly,
    [string]$EnvFile = "prod-db.env"
)

$ErrorActionPreference = "Stop"

function Write-Step  ([string]$m) { Write-Host "`n$m" -ForegroundColor Cyan }
function Write-Ok    ([string]$m) { Write-Host $m -ForegroundColor Green }
function Write-Warn  ([string]$m) { Write-Host $m -ForegroundColor Yellow }

# --- Locate the repo root -----------------------------------------------------------
$repoRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
    throw "Not inside a git repository. Run this from the webdesk-growth-dashboard checkout."
}
Set-Location $repoRoot

if (-not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile (looked in $repoRoot). Pass -EnvFile to override."
}

# --- Load DATABASE_URL, without ever printing its value ------------------------------
$loaded = @{}
foreach ($line in (Get-Content $EnvFile)) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $key, $value = $line -split '=', 2
    $key = $key.Trim()
    $value = $value.Trim().Trim('"').Trim("'")
    if ($key) {
        Set-Item -Path "env:$key" -Value $value
        $loaded[$key] = $true
    }
}

if (-not $env:DATABASE_URL) {
    throw "$EnvFile did not define DATABASE_URL."
}

# --- Show the TARGET so you can confirm it is the right database, password redacted ---
# Guards against the real failure mode of having a local test DATABASE_URL still set in
# the shell: you see exactly which host and database you are about to write to.
try {
    $uri = [uri]$env:DATABASE_URL
    $targetHost = $uri.Host
    $targetDb = $uri.AbsolutePath.TrimStart('/')
    $targetUser = ($uri.UserInfo -split ':')[0]
} catch {
    $targetHost = "<unparseable>"; $targetDb = "<unparseable>"; $targetUser = "<unparseable>"
}

Write-Step "Target"
Write-Host "  host:     $targetHost"
Write-Host "  database: $targetDb"
Write-Host "  user:     $targetUser"
Write-Host "  env file: $EnvFile"

if ($targetHost -match '^(localhost|127\.0\.0\.1|::1)$') {
    Write-Warn "`n  NOTE: this is a LOCAL host, not a remote production database."
    Write-Warn "  If you meant to migrate production, stop and check $EnvFile."
}

try {
    # --- 1. Read-only status ---------------------------------------------------------
    Write-Step "1/3  Pending migrations (read-only)"
    pnpm --filter @webdesk/database run migrate:status
    if ($LASTEXITCODE -ne 0) { throw "migrate:status failed (exit $LASTEXITCODE). Nothing was changed." }

    if ($StatusOnly) {
        Write-Ok "`nStatus-only run. Nothing was changed."
        return
    }

    # --- 2. Confirm ------------------------------------------------------------------
    Write-Step "2/3  Confirm"
    Write-Host "  Review the pending list above. Migrations are applied to " -NoNewline
    Write-Host "$targetDb on $targetHost" -ForegroundColor Yellow -NoNewline
    Write-Host "."
    Write-Host "  There is no revert path in this script."
    $answer = Read-Host "  Type 'apply' to proceed (anything else cancels)"

    if ($answer -ne "apply") {
        Write-Warn "`nCancelled. Nothing was changed."
        return
    }

    # --- 3. Apply, then independently re-verify --------------------------------------
    Write-Step "3/3  Applying"
    pnpm --filter @webdesk/database run migrate
    if ($LASTEXITCODE -ne 0) { throw "migrate FAILED (exit $LASTEXITCODE). Re-run with -StatusOnly to see the current state." }

    Write-Step "Verifying (a separate read, not the migrate command's own claim)"
    pnpm --filter @webdesk/database run migrate:status
    if ($LASTEXITCODE -ne 0) { throw "Post-migration status check failed (exit $LASTEXITCODE)." }

    Write-Ok "`nDone. Confirm the verification above reports 0 pending."
}
finally {
    # Always clear, even on failure or Ctrl+C: a production DATABASE_URL left set in the
    # shell is how a later local command ends up pointed at production by accident.
    foreach ($key in $loaded.Keys) { Remove-Item -Path "env:$key" -ErrorAction SilentlyContinue }
    Write-Host "`n(Environment variables from $EnvFile cleared from this shell.)" -ForegroundColor DarkGray
}
