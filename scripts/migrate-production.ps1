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
    [string]$EnvFile = "prod-db.env",
    [string]$LogFile
)

$ErrorActionPreference = "Stop"

# Log internally rather than relying on the caller to pipe. In Windows PowerShell 5.1,
# `*>&1` or `2>&1` on a NATIVE command wraps every stderr line in a NativeCommandError,
# which combines with ErrorActionPreference="Stop" to abort the script on output that is
# not an error at all -- pnpm writes its "$ cmd" banner to stderr. Start-Transcript
# captures everything without touching the streams.
if (-not $LogFile) {
    $LogFile = Join-Path $env:TEMP ("prod-migrate-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
}
try { Start-Transcript -Path $LogFile -Force | Out-Null; $transcribing = $true }
catch { $transcribing = $false; Write-Warning "Could not start a transcript; continuing without a log file." }

function Write-Step  ([string]$m) { Write-Host "`n$m" -ForegroundColor Cyan }
function Write-Ok    ([string]$m) { Write-Host $m -ForegroundColor Green }
function Write-Warn  ([string]$m) { Write-Host $m -ForegroundColor Yellow }

<#
Runs a pnpm script through cmd.exe and returns its exit code.

Not cosmetic. In Windows PowerShell 5.1, if this script's own output is redirected or
piped, every stderr line from a native command becomes a NativeCommandError record --
and pnpm writes its "$ <command>" banner to stderr on a perfectly successful run. With
ErrorActionPreference="Stop" that aborts mid-migration on output that is not an error.
Going through cmd.exe keeps native stderr out of PowerShell's error stream entirely, so
this script behaves identically whether it is run plainly or piped.
#>
function Invoke-PnpmScript ([string]$FilterAndScript) {
    # Out-Host, not a bare call: a PowerShell function returns EVERYTHING it emits, so
    # letting the command's output reach the pipeline would make the caller's `$code`
    # an array of every output line with the exit code appended -- and every numeric
    # comparison against it then misfires. Out-Host sends the output to the console
    # (where Start-Transcript still records it) and keeps the return value scalar.
    cmd /c "pnpm $FilterAndScript 2>&1" | Out-Host
    return $LASTEXITCODE
}

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
    # --- 0. Clear stale build output --------------------------------------------------
    # `pnpm build` runs tsc, which COMPILES sources but never DELETES outputs whose source
    # file was renamed or removed. A migration renamed on disk therefore leaves its old
    # compiled .js behind in dist/, and the migrator -- which reads dist/, not src/ -- runs
    # BOTH copies. On 2026-08-28 that applied the Asset Library migrations to production
    # twice under two different names: the first pass succeeded, the second failed on
    # "relation assets_public_id_unique already exists", and the ledger was left recording
    # names that no longer existed in the source tree. Removing dist/ first makes the build
    # authoritative.
    Write-Step "0/3  Clearing stale build output"
    foreach ($dir in @("packages\database\dist", "packages\database\dist-cjs")) {
        if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
    }
    Write-Host "  dist/ and dist-cjs/ cleared -- the next build is authoritative."

    # --- 1. Read-only status ---------------------------------------------------------
    Write-Step "1/3  Pending migrations (read-only)"
    $code = Invoke-PnpmScript "--filter @webdesk/database run migrate:status"
    if ($code -ne 0) { throw "migrate:status failed (exit $code). Nothing was changed." }

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
    $code = Invoke-PnpmScript "--filter @webdesk/database run migrate"
    if ($code -ne 0) { throw "migrate FAILED (exit $code). Re-run with -StatusOnly to see the current state." }

    Write-Step "Verifying (a separate read, not the migrate command's own claim)"
    $code = Invoke-PnpmScript "--filter @webdesk/database run migrate:status"
    if ($code -ne 0) { throw "Post-migration status check failed (exit $code)." }

    Write-Ok "`nDone. Confirm the verification above reports 0 pending."
}
finally {
    # Always clear, even on failure or Ctrl+C: a production DATABASE_URL left set in the
    # shell is how a later local command ends up pointed at production by accident.
    foreach ($key in $loaded.Keys) { Remove-Item -Path "env:$key" -ErrorAction SilentlyContinue }
    Write-Host "`n(Environment variables from $EnvFile cleared from this shell.)" -ForegroundColor DarkGray
    if ($transcribing) {
        try { Stop-Transcript | Out-Null } catch { }
        Write-Host "Full output logged to: $LogFile" -ForegroundColor DarkGray
    }
}
