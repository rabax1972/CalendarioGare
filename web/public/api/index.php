<?php
// API della pubblicazione automatica (vedi _pubblicazione.php). Tutte le chiamate richiedono l'intestazione X-Chiave.
//
//   GET  ?a=sito-impronte                    impronte dei file pubblicati
//   POST ?a=sito-carica&id=&parte=&parti=    un pezzo dello zip dei file nuovi o cambiati
//   POST ?a=sito-svuota                      dopo un caricamento completo con FileZilla

define('CALENDARIO_API', true);
require __DIR__ . '/_pubblicazione.php';

set_exception_handler(function (Throwable $e) {
    error_log('CalendarioGare API: ' . $e->getMessage());
    errore(500, 'Errore del server.');
});

richiedi_chiave();
$azione = ($_SERVER['REQUEST_METHOD'] ?? 'GET') . ' ' . (is_string($_GET['a'] ?? null) ? $_GET['a'] : '');

switch ($azione) {
    case 'GET sito-impronte':
        rispondi(['file' => impronte_sito(), 'pezzo' => PEZZO_BYTE]);
    case 'POST sito-carica':
        rispondi(ricevi_pezzo((string)($_GET['id'] ?? ''), (int)($_GET['parte'] ?? 0), (int)($_GET['parti'] ?? 0)));
    case 'POST sito-svuota':
        rispondi(['eliminati' => svuota()]);
    default:
        errore(404, 'Non trovato.');
}
