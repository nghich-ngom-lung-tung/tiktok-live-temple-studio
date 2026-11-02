param([switch]$Https)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$viteCli = Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $venvPython) -or -not (Test-Path -LiteralPath $viteCli)) {
  & (Join-Path $PSScriptRoot 'setup.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'Setup failed.' }
}

$env:ZEROTTS_ALLOW_HUB_DOWNLOAD = '1'
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
$env:HF_HUB_DISABLE_XET = '1'
Write-Host 'ZeroTTS will use the pinned model revision from Hugging Face.'
Write-Host 'The first run may download about 900 MB.'
Write-Host 'Building the UI and starting the server...'
if ($Https) { npm run start:https } else { npm start }
if ($LASTEXITCODE -ne 0) { throw 'Server exited with an error.' }
