# Instala la última versión de LabTrace sin la marca "descargado de internet" (evita la pantalla de SmartScreen).
# Uso (PowerShell, sin administrador):
#   irm https://github.com/Mattrux56/EdwinDental/releases/latest/download/instalar.ps1 | iex
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue' # acelera mucho Invoke-WebRequest en PowerShell 5.1

$base = 'https://github.com/Mattrux56/EdwinDental/releases/latest/download'
try {
    Write-Host 'Buscando la última versión de LabTrace...'
    $yml = (Invoke-WebRequest -UseBasicParsing "$base/latest.yml").Content
    if ($yml -notmatch '(?m)^path:\s*(\S+)') { throw 'No se pudo leer latest.yml' }
    $archivo = $Matches[1].Trim("'`"")
    $destino = Join-Path $env:TEMP $archivo

    Write-Host "Descargando $archivo ..."
    Invoke-WebRequest -UseBasicParsing "$base/$archivo" -OutFile $destino
    Unblock-File -Path $destino

    Write-Host 'Instalando...'
    Start-Process -FilePath $destino -Wait
    Remove-Item $destino -Force -ErrorAction SilentlyContinue
    Write-Host 'Listo.'
} catch {
    Write-Host "No se pudo instalar LabTrace: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Revisa la conexión a internet y que exista un Release publicado.'
}
