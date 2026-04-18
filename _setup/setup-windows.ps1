# ClaudeHome Setup — Windows
# Run from: C:\Users\arran\ClaudeHome\_setup\
# Usage: .\setup-windows.ps1

$ClaudeDir = "$env:USERPROFILE\.claude"
$SetupDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Setting up Claude Code config on Windows..." -ForegroundColor Cyan

# 1. Copy skills
Write-Host "Copying skills..."
Copy-Item "$SetupDir\skills\*" "$ClaudeDir\skills\" -Force
Write-Host "  Done. Skills in $ClaudeDir\skills\"

# 2. Copy settings.json (plugins list)
Write-Host "Copying settings.json..."
Copy-Item "$SetupDir\settings.json" "$ClaudeDir\settings.json" -Force
Write-Host "  Done."

# 3. Set up mcp.json with token
$token = Read-Host "Enter your REPLICATE_API_TOKEN (leave blank to skip MCP setup)"
if ($token) {
    $mcpJson = Get-Content "$SetupDir\mcp-template.json" -Raw
    $mcpJson = $mcpJson -replace 'CLAUDE_DIR', $ClaudeDir.Replace('\','\\')
    Set-Content "$ClaudeDir\mcp.json" $mcpJson
    Set-Content "$env:USERPROFILE\.env.claude" "REPLICATE_API_TOKEN=$token"
    Write-Host "  MCP configured. Token saved to $env:USERPROFILE\.env.claude"
} else {
    Write-Host "  Skipped MCP setup."
}

Write-Host ""
Write-Host "Setup complete. Open Claude Code and set working directory to:" -ForegroundColor Green
Write-Host "  $env:USERPROFILE\ClaudeHome" -ForegroundColor Green
