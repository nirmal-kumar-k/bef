# Copies the Azure VM's database backups to this PC, so a lost VM does not
# take its backups with it. Only downloads dumps not already here; never
# deletes anything on either side.
#
# Run by hand:
#   powershell -ExecutionPolicy Bypass -File D:\BEF\scripts\pull-backups.ps1
#
# Scheduled daily by a Windows task (see docs/TODO-CHANGES.md for the
# Register-ScheduledTask command). Appends to pull-backups.log in -Dest.

param(
  [string]$KeyFile = 'D:\BEF\BEF_key.pem',
  [string]$Server  = 'azureuser@20.238.27.79',
  [string]$Remote  = '/home/azureuser/bef-backups',
  [string]$Dest    = 'D:\BEF-backups'
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$log = Join-Path $Dest 'pull-backups.log'
function Log($msg) { "[{0:yyyy-MM-dd HH:mm:ss}] $msg" -f (Get-Date) | Tee-Object -FilePath $log -Append }

$sshOpts = @('-i', $KeyFile, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')

$remoteFiles = & ssh @sshOpts $Server "ls -1 $Remote/*.dump 2>/dev/null"
if ($LASTEXITCODE -ne 0 -and -not $remoteFiles) {
  Log "ERROR: could not list $Remote on $Server (exit $LASTEXITCODE)"
  exit 1
}

$copied = 0
foreach ($path in $remoteFiles) {
  $name = Split-Path $path -Leaf
  $local = Join-Path $Dest $name
  if (Test-Path $local) { continue }
  & scp @sshOpts "${Server}:$path" $local
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $local) -or (Get-Item $local).Length -eq 0) {
    Log "ERROR: failed to copy $name"
    if (Test-Path $local) { Remove-Item $local }
    exit 1
  }
  Log ("copied {0} ({1:N0} KB)" -f $name, ((Get-Item $local).Length / 1KB))
  $copied++
}

$total = (Get-ChildItem $Dest -Filter '*.dump').Count
Log "done: $copied new, $total dump(s) on this PC"
