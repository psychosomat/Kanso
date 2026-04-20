# Build script for Kanso Video Thumbnail Provider
# Requires .NET Framework 4.8 SDK and MSBuild

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $scriptPath "KansoThumbnailProvider.csproj"
$outputPath = Join-Path $scriptPath "bin"

Write-Host "Building Kanso Video Thumbnail Provider..." -ForegroundColor Green

# Try to use dotnet build first (for .NET SDK)
$dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnetCmd) {
    Write-Host "Building with dotnet build..." -ForegroundColor Yellow
    dotnet build $projectPath --configuration Release --output $outputPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build completed successfully!" -ForegroundColor Green
        Write-Host "Output: $outputPath" -ForegroundColor Cyan
        exit 0
    }
}

# Fallback to MSBuild.exe
Write-Host "dotnet build failed, trying MSBuild.exe..." -ForegroundColor Yellow

# Try .NET SDK 10 first
$dotnetRoot = "${env:ProgramFiles}\dotnet"
if (Test-Path $dotnetRoot) {
    $msbuildPath = Get-ChildItem -Path $dotnetRoot -Recurse -Filter "MSBuild.exe" -ErrorAction SilentlyContinue |
                   Select-Object -First 1 -ExpandProperty FullName
}

# Fallback to Visual Studio paths
if (-not ($msbuildPath) -or -not (Test-Path $msbuildPath)) {
    $msbuildPath = "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
}

if (-not (Test-Path $msbuildPath)) {
    $msbuildPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe"
}

if (-not (Test-Path $msbuildPath)) {
    # Try to find MSBuild in PATH
    $msbuildPath = Get-Command msbuild -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
}

if (-not ($msbuildPath) -or -not (Test-Path $msbuildPath)) {
    Write-Host "Error: Neither dotnet build nor MSBuild found. Please install .NET SDK or Visual Studio with .NET desktop development workload." -ForegroundColor Red
    exit 1
}

# Build the project
Write-Host "Building project with MSBuild..." -ForegroundColor Yellow
& $msbuildPath $projectPath /p:Configuration=Release /p:Platform=x64 /p:OutputPath=$outputPath

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "Output: $outputPath" -ForegroundColor Cyan
