# Aggiorna i campionati nazionali (myvolley.net) dal PC e li invia al repository.
# myvolley.net è dietro Cloudflare, che risponde 403 agli IP dei server di GitHub: da una connessione
# domestica invece risponde. Il push fa partire l'Action, che pubblica su Aruba.
#
# Lavora in un clone dedicato (non nella cartella di sviluppo), che viene riallineato a origin/main
# a ogni esecuzione. Commit con l'identità git globale. Log in %LOCALAPPDATA%\CalendarioGare-nazionali.log.
#
# Attività pianificata: scripts\installa-aggiorna-nazionali.ps1

# 'Continue': in PowerShell 5.1 lo stderr di git con 'Stop' diventerebbe un errore anche a comando riuscito.
$ErrorActionPreference = 'Continue'
$Repo = 'https://github.com/rabax1972/CalendarioGare.git'
$Clone = Join-Path $env:LOCALAPPDATA 'CalendarioGare-nazionali'
$Log = Join-Path $env:LOCALAPPDATA 'CalendarioGare-nazionali.log'

function Scrivi([string]$msg) {
  $riga = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Write-Output $riga
  Add-Content -Path $Log -Value $riga -Encoding utf8
}

# I comandi nativi non interrompono lo script da soli: si controlla il codice di uscita.
function Esegui([string]$exe, [string[]]$argomenti) {
  & $exe @argomenti 2>&1 | ForEach-Object { Add-Content -Path $Log -Value "    $_" -Encoding utf8 }
  if ($LASTEXITCODE -ne 0) { throw "$exe $($argomenti -join ' '): codice $LASTEXITCODE" }
}

function Allinea {
  Esegui git @('-C', $Clone, 'fetch', '--quiet', 'origin', 'main')
  Esegui git @('-C', $Clone, 'reset', '--quiet', '--hard', 'origin/main')
}

try {
  Scrivi 'Inizio aggiornamento nazionali'
  if (-not (Test-Path (Join-Path $Clone '.git'))) {
    Esegui git @('clone', '--quiet', $Repo, $Clone)
  }
  Set-Location $Clone

  for ($tentativo = 1; $tentativo -le 2; $tentativo++) {
    Allinea
    # Dipendenze solo quando cambia il lockfile.
    $impronta = (Get-FileHash 'package-lock.json').Hash
    $fileImpronta = 'node_modules\.impronta-lock'
    if (-not (Test-Path $fileImpronta) -or (Get-Content $fileImpronta) -ne $impronta) {
      Esegui npm.cmd @('ci', '--no-audit', '--no-fund')
      Set-Content -Path $fileImpronta -Value $impronta
    }

    # Codice 1 = una fonte non aggiornata: si continua comunque, i dati validi restano.
    & npm.cmd run scrape -- --fonte=myvolley 2>&1 | ForEach-Object { Add-Content -Path $Log -Value "    $_" -Encoding utf8 }
    if ($LASTEXITCODE -gt 1) { throw "scraper: codice $LASTEXITCODE" }
    if ($LASTEXITCODE -eq 1) { Scrivi 'Attenzione: myvolley non aggiornata (vedi sopra)' }

    Esegui git @('add', 'data')
    & git diff --cached --quiet -- . ':(exclude)data/meta.json'
    if ($LASTEXITCODE -eq 0) {
      Esegui git @('reset', '--quiet')
      Scrivi 'Nessuna variazione nei dati.'
      break
    }
    Esegui git @('commit', '--quiet', '-m', 'Aggiorna campionati nazionali')
    & git push --quiet origin HEAD:main 2>&1 | ForEach-Object { Add-Content -Path $Log -Value "    $_" -Encoding utf8 }
    if ($LASTEXITCODE -eq 0) { Scrivi 'Dati inviati: l''Action pubblica su Aruba.'; break }
    # Push rifiutato: nel frattempo l'Action ha salvato altri dati. Si riparte dal repository aggiornato.
    if ($tentativo -eq 2) { throw 'push rifiutato due volte' }
    Scrivi 'Push rifiutato, riprovo sui dati aggiornati.'
  }
  exit 0
} catch {
  Scrivi "ERRORE: $($_.Exception.Message)"
  exit 1
}
