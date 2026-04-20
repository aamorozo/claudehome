# ClaudeHome — migrate local Windows desktop projects to private GitHub repos
# Run from: C:\Users\arran\ClaudeHome\_setup\
# Usage: .\migrate-windows-projects-to-github.ps1           (live)
#        .\migrate-windows-projects-to-github.ps1 -DryRun   (no repo creation)
#
# What it does per project folder:
#   1. Scans for likely secrets (API keys, private keys, service accounts).
#   2. git init (if needed) + writes a hardened .gitignore.
#   3. Creates initial commit.
#   4. Creates PRIVATE GitHub repo under aamorozo/ and pushes.
#
# Prereqs on Windows:
#   winget install GitHub.cli
#   gh auth login

param(
    [string]$GitHubOwner = "aamorozo",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Add or remove rows here as you find more local projects.
$Projects = @(
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\mortgagepro"; Repo = "mortgagepro" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\mtgpro-ai";   Repo = "mtgpro-ai" }
)

$Gitignore = @'
# Secrets
.env
.env.*
*.env
*service-account*.json
*credentials*.json
firebase-debug*.log
.firebaserc
.env.claude

# OS
.DS_Store
Thumbs.db
desktop.ini

# Office lock files
~$*
.~lock.*

# Node
node_modules/
.next/
dist/
build/

# Python
__pycache__/
*.pyc
.venv/
venv/

# FUB / Notion exports (often contain PII)
fub_export*.csv
notion_batch_*.json
'@

function Assert-Gh {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Host "gh CLI not found. Install with: winget install GitHub.cli" -ForegroundColor Red
        exit 1
    }
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Not logged in to gh. Run: gh auth login" -ForegroundColor Red
        exit 1
    }
}

function Scan-Secrets($folder) {
    $patterns = @(
        'sk-[a-zA-Z0-9]{20,}',
        'AKIA[A-Z0-9]{16}',
        'BEGIN (RSA |OPENSSH )?PRIVATE KEY',
        'REPLICATE_API_TOKEN\s*=\s*[a-zA-Z0-9]{10,}',
        '"private_key"\s*:\s*"-----BEGIN'
    )
    $hits = @()
    Get-ChildItem -Path $folder -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object {
        $_.FullName -notmatch 'node_modules|\\\.next\\|\\dist\\|\\build\\|\\.git\\' `
        -and $_.Length -lt 1MB
      } |
      ForEach-Object {
        $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        if ($null -eq $content) { return }
        foreach ($p in $patterns) {
            if ($content -match $p) { $hits += "$($_.FullName) matches /$p/" }
        }
      }
    return $hits
}

Assert-Gh

foreach ($p in $Projects) {
    Write-Host ""
    Write-Host "==> $($p.Repo)  ($($p.Path))" -ForegroundColor Cyan

    if (-not (Test-Path $p.Path)) {
        Write-Host "   SKIP: folder not found" -ForegroundColor Yellow
        continue
    }

    Write-Host "   Scanning for likely secrets..."
    $hits = Scan-Secrets $p.Path
    if ($hits.Count -gt 0) {
        Write-Host "   POTENTIAL SECRETS FOUND. Review/remove before pushing:" -ForegroundColor Red
        $hits | ForEach-Object { Write-Host "     $_" -ForegroundColor Red }
        Write-Host "   Press Y to continue anyway (add to .gitignore first), any other key to skip:" -ForegroundColor Yellow
        $k = [Console]::ReadKey($true)
        if ($k.KeyChar -ne 'Y' -and $k.KeyChar -ne 'y') { continue }
    }

    Push-Location $p.Path
    try {
        if (-not (Test-Path ".git")) { git init -b main | Out-Null }
        if (-not (Test-Path ".gitignore")) {
            Set-Content -Path .gitignore -Value $Gitignore -Encoding UTF8
        }
        git add -A | Out-Null
        git commit -m "Initial commit: migrated from local desktop" 2>&1 | Out-Null

        if ($DryRun) {
            Write-Host "   DRY RUN: would create $GitHubOwner/$($p.Repo) and push" -ForegroundColor Green
        } else {
            gh repo create "$GitHubOwner/$($p.Repo)" --private --source . --push
            Write-Host "   created and pushed" -ForegroundColor Green
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Done. Next: claude.ai/code -> New project -> pick each new repo." -ForegroundColor Green
