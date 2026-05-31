param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot "..\seo-evidence\captures")
)

$ErrorActionPreference = "Stop"
$capturedAt = (Get-Date).ToUniversalTime()
$runName = $capturedAt.ToString("yyyy-MM-ddTHH-mm-ssZ")
$runDirectory = Join-Path $OutputRoot $runName
$snapshotDirectory = Join-Path $runDirectory "snapshots"
$rdapDirectory = Join-Path $runDirectory "rdap"

New-Item -ItemType Directory -Force -Path $snapshotDirectory, $rdapDirectory | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$manifest = [ordered]@{
  capturedAtUtc = $capturedAt.ToString("o")
  snapshots = @()
  rdap = @()
  localEvidence = @()
}

$snapshotTargets = [ordered]@{
  "irenee-institut-home" = "https://irenee-institut.org/"
  "irenee-institut-robots" = "https://irenee-institut.org/robots.txt"
  "irenee-institut-sitemap" = "https://irenee-institut.org/sitemap.xml"
  "institutsaintirenee-home" = "https://www.institutsaintirenee.fr/"
  "institutsaintirenee-programme" = "https://www.institutsaintirenee.fr/programme"
  "institutsaintirenee-intervenants" = "https://www.institutsaintirenee.fr/intervenants"
  "institutsaintirenee-bibliotheque" = "https://www.institutsaintirenee.fr/bibliotheque"
  "institutsaintirenee-a-propos" = "https://www.institutsaintirenee.fr/a-propos"
  "institutsaintirenee-contact" = "https://www.institutsaintirenee.fr/contact"
  "institutsaintirenee-inscription" = "https://www.institutsaintirenee.fr/inscription"
  "institutsaintirenee-robots" = "https://www.institutsaintirenee.fr/robots.txt"
}

foreach ($entry in $snapshotTargets.GetEnumerator()) {
  $response = Invoke-WebRequest -Uri $entry.Value -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 30
  $extension = if ($entry.Value.EndsWith(".xml")) { ".xml" } elseif ($entry.Value.EndsWith(".txt")) { ".txt" } else { ".html" }
  $filePath = Join-Path $snapshotDirectory "$($entry.Key)$extension"
  [System.IO.File]::WriteAllText($filePath, $response.Content, $utf8NoBom)
  $hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $manifest.snapshots += [ordered]@{
    name = $entry.Key
    url = $entry.Value
    status = [int]$response.StatusCode
    finalUrl = $response.BaseResponse.ResponseUri.AbsoluteUri
    file = $filePath
    sha256 = $hash
    bytes = (Get-Item -LiteralPath $filePath).Length
  }
}

$rdapTargets = [ordered]@{
  "irenee-institut-org" = "https://rdap.publicinterestregistry.org/rdap/domain/irenee-institut.org"
  "institutsaintirenee-fr" = "https://rdap.nic.fr/domain/institutsaintirenee.fr"
}

foreach ($entry in $rdapTargets.GetEnumerator()) {
  $response = Invoke-WebRequest -Uri $entry.Value -UseBasicParsing -TimeoutSec 30
  $filePath = Join-Path $rdapDirectory "$($entry.Key).json"
  [System.IO.File]::WriteAllText($filePath, $response.Content, $utf8NoBom)
  $hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $manifest.rdap += [ordered]@{
    name = $entry.Key
    url = $entry.Value
    status = [int]$response.StatusCode
    file = $filePath
    sha256 = $hash
    bytes = (Get-Item -LiteralPath $filePath).Length
  }
}

$historicalChunk = Join-Path $PSScriptRoot "..\old_build\_next\static\chunks\4d65e31d7568815a.js"
if (Test-Path -LiteralPath $historicalChunk) {
  $resolvedHistoricalChunk = (Resolve-Path -LiteralPath $historicalChunk).Path
  $manifest.localEvidence += [ordered]@{
    name = "historical-home-content-chunk"
    file = $resolvedHistoricalChunk
    sha256 = (Get-FileHash -LiteralPath $resolvedHistoricalChunk -Algorithm SHA256).Hash.ToLowerInvariant()
    bytes = (Get-Item -LiteralPath $resolvedHistoricalChunk).Length
  }
}

$manifestPath = Join-Path $runDirectory "manifest.json"
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), $utf8NoBom)

Write-Output "Evidence captured in $runDirectory"
Write-Output "Manifest: $manifestPath"
