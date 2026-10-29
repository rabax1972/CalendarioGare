<?php
// File aggiornati dalla GitHub Action (mdb-database/calendariogare/sito/, vedi _pubblicazione.php): web.config manda qui le
// richieste per cui ne esiste uno, al posto del file statico della cartella /calendariogare.

define('CALENDARIO_API', true);
require __DIR__ . '/_pubblicazione.php';

$percorso = is_string($_GET['f'] ?? null) ? $_GET['f'] : '';
$file = cartella_sito() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $percorso);
if (!percorso_valido($percorso) || !is_file($file)) {
    // Tolto tra il controllo di web.config e questa richiesta (es. cartella appena svuotata).
    http_response_code(404);
    exit;
}

$tipo = TIPI_FILE[strtolower(pathinfo($percorso, PATHINFO_EXTENSION))];
$mtime = (int)filemtime($file);
$etag = '"' . dechex($mtime) . '-' . dechex((int)filesize($file)) . '"';
header('Content-Type: ' . $tipo);
header('X-Content-Type-Options: nosniff');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
header('ETag: ' . $etag);
// JS e CSS in assets/ hanno l'hash nel nome; il resto (dati, index.html, sw.js) cambia e va ricontrollato con l'ETag.
header('Cache-Control: ' . (str_starts_with($percorso, 'assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'));
header('Vary: Accept-Encoding');

if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}

$corpo = file_get_contents($file);
$testo = str_starts_with($tipo, 'text/') || str_starts_with($tipo, 'application/') || $tipo === 'image/svg+xml';
if ($testo && function_exists('gzencode') && str_contains($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip')) {
    $corpo = gzencode($corpo, 5);
    header('Content-Encoding: gzip');
}
header('Content-Length: ' . strlen($corpo));
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $corpo;
