param(
    [string]$Notes,
    [string]$LlamaServer,
    [int]$StartupTimeout = 3600
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pythonPath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    $pythonPath = (Get-Command python -ErrorAction Stop).Source
}
if (-not $LlamaServer) {
    $llamaCommand = Get-Command llama-server -ErrorAction SilentlyContinue
    if ($llamaCommand) { $LlamaServer = $llamaCommand.Source }
    else {
        $installedLlama = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\ggml.llamacpp_Microsoft.Winget.Source_8wekyb3d8bbwe\llama-server.exe'
        $LlamaServer = if (Test-Path -LiteralPath $installedLlama) { $installedLlama } else { 'llama-server' }
    }
}
if ($Notes) {
    & $pythonPath build.py $Notes
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
elseif (-not (Test-Path -LiteralPath 'viewer\graph-data.js')) {
    & $pythonPath build.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& $pythonPath server.py --llama-server $LlamaServer --startup-timeout $StartupTimeout
