# Build script for Kanso Video Thumbnail Provider
# Targets .NET Framework 4.8 (AnyCPU) and outputs bin\KansoThumbnailProvider.dll.

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $scriptPath "KansoThumbnailProvider.csproj"
$outputPath = Join-Path $scriptPath "bin"
$outputDll = Join-Path $outputPath "KansoThumbnailProvider.dll"

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

Write-Host "Building Kanso Video Thumbnail Provider..." -ForegroundColor Green

# 1. Try dotnet build first (used in CI and when .NET SDK is installed)
$dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnetCmd) {
    Write-Host "Building with dotnet build..." -ForegroundColor Yellow
    dotnet build $projectPath --configuration Release --output $outputPath
    if ($LASTEXITCODE -eq 0 -and (Test-Path $outputDll)) {
        Write-Host "Build completed successfully!" -ForegroundColor Green
        Write-Host "Output: $outputDll" -ForegroundColor Cyan
        exit 0
    }
    Write-Host "dotnet build failed, trying MSBuild.exe..." -ForegroundColor Yellow
}

# 2. Try Visual Studio / Build Tools MSBuild.exe (AnyCPU)
$msbuildCandidates = New-Object System.Collections.Generic.List[string]

$vswherePath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswherePath) {
    $vsInstall = & $vswherePath -latest -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" 2>$null | Select-Object -First 1
    if ($vsInstall) {
        $msbuildCandidates.Add($vsInstall)
    }
}

$msbuildCandidates.Add("${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe")
$msbuildCandidates.Add("${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe")
$msbuildCandidates.Add("${env:ProgramFiles}\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe")
$msbuildCandidates.Add("${env:ProgramFiles}\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe")
$msbuildCandidates.Add("${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe")
$msbuildCandidates.Add("${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe")

$msbuildFromPath = Get-Command msbuild -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if ($msbuildFromPath) {
    $msbuildCandidates.Add($msbuildFromPath)
}

$msbuildPath = $msbuildCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($msbuildPath) {
    Write-Host "Building project with MSBuild ($msbuildPath)..." -ForegroundColor Yellow
    & $msbuildPath $projectPath /p:Configuration=Release /p:Platform=AnyCPU /p:OutputPath="$outputPath\"
    if ($LASTEXITCODE -eq 0 -and (Test-Path $outputDll)) {
        Write-Host "Build completed successfully!" -ForegroundColor Green
        Write-Host "Output: $outputDll" -ForegroundColor Cyan
        exit 0
    }
    Write-Host "MSBuild failed, falling back to .NET Framework csc.exe..." -ForegroundColor Yellow
}

# 3. Fallback to built-in .NET Framework 4.x C# compiler (AnyCPU)
$cscCandidates = @(
    "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$cscPath = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $cscPath) {
    Write-Host "Error: Neither dotnet, MSBuild, nor .NET Framework csc.exe was found." -ForegroundColor Red
    exit 1
}

Write-Host "Building with csc.exe ($cscPath)..." -ForegroundColor Yellow
$assemblyInfo = Join-Path $scriptPath "AssemblyInfo.cs"
$providerSource = Join-Path $scriptPath "VideoThumbnailProvider.cs"

& $cscPath `
    /nologo `
    /target:library `
    /platform:anycpu `
    /optimize+ `
    /out:"$outputDll" `
    /reference:System.dll `
    /reference:System.Core.dll `
    /reference:System.Drawing.dll `
    /reference:Microsoft.CSharp.dll `
    "$assemblyInfo" `
    "$providerSource"

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $outputDll)) {
    Write-Host "Error: Build failed with exit code $LASTEXITCODE." -ForegroundColor Red
    exit 1
}

Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "Output: $outputDll" -ForegroundColor Cyan
