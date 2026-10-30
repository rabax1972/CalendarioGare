# Crea (o ricrea) l'attività pianificata che esegue scripts\aggiorna-nazionali.ps1:
# ogni sera alle 23:15 e, nel weekend in cui si gioca, anche alle 19:15.
# Se il PC è spento all'ora prevista, l'attività parte appena possibile.
# Per toglierla: Unregister-ScheduledTask -TaskName 'CalendarioGare - nazionali'

$Nome = 'CalendarioGare - nazionali'
$Script = Join-Path $PSScriptRoot 'aggiorna-nazionali.ps1'

$azione = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Script`""
$quando = @(
  New-ScheduledTaskTrigger -Daily -At '23:15'
  New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday, Sunday -At '19:15'
)
$impostazioni = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $Nome -Action $azione -Trigger $quando -Settings $impostazioni `
  -Description 'Aggiorna i campionati nazionali di pallavolo (myvolley.net) e li invia a GitHub.' -Force | Out-Null
Write-Output "Attività '$Nome' registrata. Log: $(Join-Path $env:LOCALAPPDATA 'CalendarioGare-nazionali.log')"
