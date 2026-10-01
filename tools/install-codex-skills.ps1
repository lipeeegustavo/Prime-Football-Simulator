$ErrorActionPreference = 'Stop'

Write-Host 'Prime Football Simulator - instalacao de skills para Codex' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js nao foi encontrado. Instale Node.js 22.18 ou superior e execute este script novamente.'
}

$nodeVersionText = (node -v).TrimStart('v')
$nodeVersion = [Version]$nodeVersionText
$minimumVersion = [Version]'22.18.0'
if ($nodeVersion -lt $minimumVersion) {
  throw "Node.js $nodeVersionText detectado. Impeccable requer Node.js 22.18 ou superior."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
Write-Host "Projeto: $projectRoot" -ForegroundColor DarkGray

Write-Host '\n[1/2] Instalando Impeccable para Codex neste projeto...' -ForegroundColor Green
npx -y impeccable install -y --providers=codex --scope=project
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar Impeccable.' }

Write-Host '\n[2/2] Instalando grilling + grill-me para Codex...' -ForegroundColor Green
npx -y skills add mattpocock/skills --skill grilling --skill grill-me --agent codex --copy -y
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar as skills grilling/grill-me.' }

Write-Host '\nInstalacao concluida.' -ForegroundColor Cyan
Write-Host 'Reabra/recarregue o Codex para ele reconhecer as skills do projeto.' -ForegroundColor Yellow
Write-Host 'Impeccable: use $impeccable (ex.: $impeccable critique, $impeccable animate, $impeccable polish).' -ForegroundColor Gray
Write-Host 'Grilling: invoque $grilling. Grill Me: invoque $grill-me.' -ForegroundColor Gray
