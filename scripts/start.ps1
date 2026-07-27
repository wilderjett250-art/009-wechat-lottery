$ErrorActionPreference = 'Stop'

$Node = if ($env:NODE_EXE) { $env:NODE_EXE } else { (Get-Command node -ErrorAction SilentlyContinue).Source }

if (-not $Node -or -not (Test-Path -LiteralPath $Node)) {
  throw "Node.js not found. Install Node.js 18+ or set NODE_EXE to node.exe."
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  $env:HOST = '127.0.0.1'
  $env:PORT = if ($env:PORT) { $env:PORT } else { '5177' }
  & $Node server.js
} finally {
  Pop-Location
}
