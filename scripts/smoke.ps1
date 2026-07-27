$ErrorActionPreference = 'Stop'

$BaseUrl = if ($env:BASE_URL) { $env:BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:5177' }
$AdminToken = $env:ADMIN_TOKEN

function Test-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [string[]]$Headers = @()
  )

  $url = "$BaseUrl$Path"
  $args = @('-s', '-o', 'NUL', '-w', '%{http_code}')
  foreach ($header in $Headers) {
    $args += @('-H', $header)
  }
  $args += $url

  $status = & curl.exe @args
  if ($status -ne '200') {
    throw "Smoke check failed: $url returned HTTP $status"
  }
  Write-Host "OK $url"
}

Test-Url '/api/health'
Test-Url '/mini'

if ($AdminToken) {
  $cookieFile = Join-Path ([IO.Path]::GetTempPath()) ("lottery-admin-$PID.cookie")
  try {
    $loginBody = @{ token = $AdminToken } | ConvertTo-Json -Compress
    $loginStatus = & curl.exe -s -o NUL -w '%{http_code}' -c $cookieFile -H 'Content-Type: application/json' --data-raw $loginBody "$BaseUrl/api/admin/session"
    if ($loginStatus -ne '200') {
      throw "Smoke check failed: $BaseUrl/api/admin/session returned HTTP $loginStatus"
    }
    $cookieHeader = ((Get-Content -LiteralPath $cookieFile | Where-Object { $_ -and $_ -notmatch '^#' } | Select-Object -Last 1) -split '\s+')[-1]
    Test-Url '/admin' @("Cookie: admin_session=$cookieHeader")
    Test-Url '/api/admin/summary' @("Cookie: admin_session=$cookieHeader")
  } finally {
    Remove-Item -LiteralPath $cookieFile -Force -ErrorAction SilentlyContinue
  }
} else {
  Test-Url '/admin'
  Test-Url '/api/admin/summary'
}

Write-Host "Smoke checks passed for $BaseUrl"
