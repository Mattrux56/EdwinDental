# Crea el acceso directo "LabTrace" en el escritorio (solo si todavia no existe).
$raiz = Split-Path -Parent $PSScriptRoot
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'LabTrace.lnk'
if (Test-Path $lnk) { exit 0 }
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = Join-Path $raiz 'LabTrace.bat'
$s.WorkingDirectory = $raiz
$s.IconLocation = Join-Path $PSScriptRoot 'LabTrace.ico'
$s.WindowStyle = 7
$s.Description = 'Abrir LabTrace'
$s.Save()
