$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DataDir = if ($env:DATA_DIR) { $env:DATA_DIR } else { Join-Path $ProjectRoot 'data' }
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $ProjectRoot 'backups' }
$Source = Join-Path $DataDir 'db.json'

if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
  $Seed = Join-Path $ProjectRoot 'data\seed.json'
  if (-not (Test-Path -LiteralPath $Seed -PathType Leaf)) {
    throw "Runtime database not found and seed data is missing: $Source"
  }
  New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
  Copy-Item -LiteralPath $Seed -Destination $Source
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Target = Join-Path $BackupDir "db-$timestamp.json"
Copy-Item -LiteralPath $Source -Destination $Target

$hash = (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash
[pscustomobject]@{
  Backup = $Target
  SHA256 = $hash
} | Format-List
