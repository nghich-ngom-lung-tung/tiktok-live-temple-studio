$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

foreach ($commandName in @('node', 'npm', 'uv')) {
  if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
    throw "Command '$commandName' was not found. Install Node.js and uv, then run setup.ps1 again."
  }
}

Write-Host "Node.js: $(node --version)"
Write-Host "uv: $(uv --version)"
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\vite'))) {
  Write-Host 'Installing JavaScript dependencies...'
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
} else {
  Write-Host 'JavaScript dependencies are already installed.'
}

Write-Host 'Creating .venv and installing ZeroTTS from uv.lock...'
uv sync --locked
if ($LASTEXITCODE -ne 0) { throw 'uv sync --locked failed.' }

$venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
& $venvPython -c 'import numpy, onnxruntime, zerotts'
if ($LASTEXITCODE -ne 0) { throw 'Could not import ZeroTTS dependencies.' }
Write-Host 'ZeroTTS dependencies OK'

Write-Host ''
Write-Host 'Dependency setup complete.'
Write-Host 'To enable TTS, allow the model download from Hugging Face (about 900 MB on first run):'
Write-Host '$env:ZEROTTS_ALLOW_HUB_DOWNLOAD = "1"'
Write-Host 'npm start'
