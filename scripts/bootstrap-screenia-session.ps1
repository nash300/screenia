[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$targetBranch = "codex/local-service-setup"
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot ".." -Resolve)).Path
$canonicalRootCandidate = Join-Path $env:USERPROFILE "Desktop\screenia"
$canonicalRoot = if (Test-Path -LiteralPath $canonicalRootCandidate) {
  (Resolve-Path -LiteralPath $canonicalRootCandidate).Path
} else {
  $canonicalRootCandidate
}

Set-Location -LiteralPath $repoRoot

function Get-GitValue {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $result = & git @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) {
    return $null
  }

  return ($result | Out-String).Trim()
}

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Invoke-Npm {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  & npm.cmd @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

$statusLines = @( & git status --porcelain )
if ($LASTEXITCODE -ne 0) {
  throw "The current directory is not a usable Git checkout: $repoRoot"
}

$isDirty = $statusLines.Count -gt 0
$isCanonical = [StringComparer]::OrdinalIgnoreCase.Equals(
  $repoRoot.TrimEnd("\"),
  $canonicalRoot.TrimEnd("\")
)

Write-Output "Screenia session preparation"
Write-Output "  checkout: $repoRoot"
Write-Output "  canonical: $canonicalRoot"
Write-Output "  target branch: $targetBranch"

Invoke-Git -Arguments @("fetch", "--prune", "origin")

$remoteCommit = Get-GitValue -Arguments @("rev-parse", "origin/$targetBranch")
if (-not $remoteCommit) {
  throw "Remote branch origin/$targetBranch was not found."
}

$headCommit = Get-GitValue -Arguments @("rev-parse", "HEAD")
$currentBranch = Get-GitValue -Arguments @("branch", "--show-current")

if ($isCanonical) {
  if ($currentBranch -ne $targetBranch) {
    throw "The canonical checkout is on '$currentBranch', expected '$targetBranch'."
  }

  if ($isDirty) {
    Write-Warning "Canonical checkout has local changes; leaving it untouched and skipping pull."
  } else {
    $counts = Get-GitValue -Arguments @("rev-list", "--left-right", "--count", "HEAD...origin/$targetBranch")
    $countParts = $counts -split "\s+"
    $ahead = [int]$countParts[0]
    $behind = [int]$countParts[1]

    if ($ahead -gt 0 -and $behind -gt 0) {
      throw "Canonical checkout and origin/$targetBranch have diverged; refusing an automatic merge."
    }

    if ($behind -gt 0) {
      Invoke-Git -Arguments @("pull", "--ff-only", "origin", $targetBranch)
      $headCommit = Get-GitValue -Arguments @("rev-parse", "HEAD")
    } elseif ($ahead -gt 0) {
      Write-Warning "Canonical checkout has local commits that are not pushed to origin/$targetBranch."
    }
  }
} else {
  if ($isDirty) {
    throw "This temporary worktree has uncommitted changes; refusing to change its revision. Commit or preserve that work first."
  }

  if ($headCommit -ne $remoteCommit) {
    Invoke-Git -Arguments @("switch", "--detach", "origin/$targetBranch")
    $headCommit = Get-GitValue -Arguments @("rev-parse", "HEAD")
  }
}

$canonicalEnv = Join-Path $canonicalRoot ".env.local"
$localEnv = Join-Path $repoRoot ".env.local"
if (-not (Test-Path -LiteralPath $localEnv) -and (Test-Path -LiteralPath $canonicalEnv)) {
  Copy-Item -LiteralPath $canonicalEnv -Destination $localEnv
  Write-Output "  local environment: copied from the canonical checkout"
} elseif (Test-Path -LiteralPath $localEnv) {
  Write-Output "  local environment: already present"
} else {
  Write-Warning "No .env.local was found. Create it from .env.example or pull development variables from the linked Vercel project."
}

$canonicalVercelProject = Join-Path $canonicalRoot ".vercel\project.json"
$localVercelProject = Join-Path $repoRoot ".vercel\project.json"
if (-not (Test-Path -LiteralPath $localVercelProject) -and (Test-Path -LiteralPath $canonicalVercelProject)) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $localVercelProject) -Force | Out-Null
  Copy-Item -LiteralPath $canonicalVercelProject -Destination $localVercelProject
  Write-Output "  Vercel project link: copied"
}

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "node_modules"))) {
  Write-Output "  dependencies: installing from package-lock.json"
  Invoke-Npm -Arguments @("ci")
} else {
  Write-Output "  dependencies: already installed"
}

$finalHead = Get-GitValue -Arguments @("rev-parse", "HEAD")
$finalStatus = @( & git status --short --branch )
Write-Output "  revision: $finalHead"
Write-Output "  status: $($finalStatus -join ' | ')"
Write-Output "Read docs/current-project-checkpoint.md before making project changes."
Write-Output "Session preparation complete."
