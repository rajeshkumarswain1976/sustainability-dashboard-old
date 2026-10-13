param([string]$FrontendRoot = (Join-Path $PSScriptRoot '../../sustainability-dashboard'))
$ErrorActionPreference = 'Stop'
$FrontendRoot = (Resolve-Path -LiteralPath $FrontendRoot).Path
$destinationRoot = Join-Path $PSScriptRoot 'frontend'
foreach ($folder in @('src', 'public', 'server', 'config', 'knowledge')) {
    $folderRoot = Join-Path $FrontendRoot $folder
    foreach ($file in (Get-ChildItem -LiteralPath $folderRoot -File -Recurse | Where-Object { $_.FullName -notmatch '[\\/]__pycache__[\\/]' })) {
        $relative = $file.FullName.Substring($FrontendRoot.Length + 1)
        $destination = Join-Path $destinationRoot $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination
    }
}
foreach ($filename in @('package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js')) {
    Copy-Item -LiteralPath (Join-Path $FrontendRoot $filename) -Destination (Join-Path $destinationRoot $filename)
}
New-Item -ItemType Directory -Path "$destinationRoot\scripts" -Force | Out-Null
Copy-Item -LiteralPath "$FrontendRoot\scripts\dashboard_backend.py" -Destination "$destinationRoot\scripts\dashboard_backend.py"
Write-Output 'Deployment sources updated; credentials and runtime data were excluded.'
