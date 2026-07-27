$ErrorActionPreference = 'Stop'

$Npm = if ($env:NPM_EXE) { $env:NPM_EXE } else { (Get-Command npm -ErrorAction SilentlyContinue).Source }

if (-not $Npm -or -not (Test-Path -LiteralPath $Npm)) {
  throw "npm not found. Install Node.js 18+ or set NPM_EXE to npm.cmd."
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  & $Npm ci
} finally {
  Pop-Location
}
