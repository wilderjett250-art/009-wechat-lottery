$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Node = if ($env:NODE_EXE) { $env:NODE_EXE } else { (Get-Command node -ErrorAction SilentlyContinue).Source }

if (-not $Node -or -not (Test-Path -LiteralPath $Node)) {
  throw "Node.js not found. Install Node.js 18+ or set NODE_EXE to node.exe."
}

Push-Location $ProjectRoot
try {
  $bad = @()
  Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Filter '*.js' |
    Where-Object { $_.FullName -notlike '*\node_modules\*' } |
    ForEach-Object {
      & $Node --check $_.FullName
      if ($LASTEXITCODE -ne 0) {
        $bad += $_.FullName
      }
    }

  if ($bad.Count -gt 0) {
    throw "JavaScript syntax check failed: $($bad -join ', ')"
  }

  & $Node -e "const fs=require('fs');const path=require('path');const root=process.cwd();const bad=[];function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);if(p.includes('node_modules'))continue;const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(p.endsWith('.json')){try{JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){bad.push(p+': '+e.message)}}}}walk(root);if(bad.length){console.error(bad.join('\n'));process.exit(1)}console.log('JS and JSON checks passed');"
  $testFiles = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'tests') -File -Filter '*.test.js' |
    Sort-Object FullName |
    Select-Object -ExpandProperty FullName
  & $Node --test @testFiles
  if ($LASTEXITCODE -ne 0) {
    throw "Node tests failed"
  }
} finally {
  Pop-Location
}
