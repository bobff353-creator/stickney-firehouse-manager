# Run only on the mounted vehicle's Windows device, with user approval.
# Does not change execution policy, install services, or enable startup tasks.
$ErrorActionPreference = 'Stop'
$trackerSource = Join-Path $PSScriptRoot 'StickneyVehicleTracker.cs'
$trackerCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $trackerCompiler)) { $trackerCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path -LiteralPath $trackerSource)) { throw 'Save StickneyVehicleTracker.cs beside this launcher first.' }
if (-not (Test-Path -LiteralPath $trackerCompiler)) { throw '.NET Framework 4.x is required. Ask your Windows administrator; no software was installed.' }
$trackerFolder = Join-Path $env:LOCALAPPDATA 'StickneyVehicleTracker'
$null = New-Item -ItemType Directory -Path $trackerFolder -Force
$trackerExe = Join-Path $trackerFolder 'StickneyVehicleTracker.exe'
& $trackerCompiler /nologo /target:winexe /platform:anycpu "/out:$trackerExe" /r:System.Device.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Net.Http.dll /r:System.Web.Extensions.dll /r:System.Security.dll $trackerSource
if ($LASTEXITCODE -ne 0) { throw 'The tracker could not compile. Close an existing tracker before updating it.' }
# The user explicitly runs this launcher to open the interactive permission/setup UI.
Start-Process -FilePath $trackerExe
