<?php
// Aggiornamento automatico su Aruba (hosting Windows/IIS), come in Classifiche. Il PHP non può scrivere nella cartella del sito,
// quindi i file aggiornati stanno in mdb-database/calendariogare/sito/ e web.config li fa servire da api/sito.php al posto di
// quelli statici.
//
// - La GitHub Action (scripts/pubblica-aruba.ts) chiede le impronte dei file pubblicati (?a=sito-impronte), manda a pezzi uno zip
//   con quelli cambiati (?a=sito-carica) e il server lo estrae in mdb-database/calendariogare/sito/.
// - Dopo un caricamento completo con FileZilla, npm run pubblica:aruba -- --svuota toglie le copie (?a=sito-svuota).
// Incluso da api/index.php e api/sito.php: aperto direttamente non fa nulla.

if (!defined('CALENDARIO_API')) {
    http_response_code(404);
    exit;
}

/** Tipi di file del sito che si possono aggiornare (niente PHP né configurazione del server). */
const TIPI_FILE = [
    'html' => 'text/html; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'js' => 'text/javascript; charset=utf-8',
    'css' => 'text/css; charset=utf-8',
    'svg' => 'image/svg+xml',
    'txt' => 'text/plain; charset=utf-8',
    'webmanifest' => 'application/manifest+json',
    'png' => 'image/png',
    'ico' => 'image/x-icon',
    'webp' => 'image/webp',
    'ics' => 'text/calendar; charset=utf-8',
];
/** Dimensione massima di un pezzo dello zip (sotto il post_max_size di PHP). */
const PEZZO_BYTE = 4 * 1024 * 1024;

/**
 * Configurazione: valori predefiniti, sovrascritti da mdb-database/calendariogare-config.php (fuori dal repository), un file che
 * restituisce un array, es. <?php return ['chiave_pubblicazione' => '…'];
 */
function config(): array {
    static $config = null;
    if ($config !== null) return $config;
    // Sul server: /calendariogare/api → ../../mdb-database, la cartella scrivibile nella radice del dominio.
    $dir = getenv('CALENDARIO_DB_DIR') ?: dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'mdb-database';
    $config = [
        'db_dir' => $dir,
        // Stessa stringa del secret ARUBA_CHIAVE su GitHub; vuota = pubblicazione disattivata.
        'chiave_pubblicazione' => '',
    ];
    $file = $dir . DIRECTORY_SEPARATOR . 'calendariogare-config.php';
    if (is_file($file)) $config = array_merge($config, (array)require $file);
    return $config;
}

function cartella_dati(): string {
    return config()['db_dir'] . DIRECTORY_SEPARATOR . 'calendariogare';
}

function cartella_sito(): string {
    return cartella_dati() . DIRECTORY_SEPARATOR . 'sito';
}

function rispondi(array $dati, int $stato = 200): never {
    http_response_code($stato);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dati, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function errore(int $stato, string $messaggio): never {
    rispondi(['errore' => $messaggio], $stato);
}

/** Percorso relativo di un file del sito ("data/partite.json"): niente risalite, niente api/, solo i tipi ammessi. */
function percorso_valido(string $percorso): bool {
    if ($percorso === '' || strlen($percorso) > 300 || preg_match('/[\\\\:\0]/', $percorso) || str_starts_with($percorso, 'api/')) return false;
    foreach (explode('/', $percorso) as $parte) {
        if ($parte === '' || $parte === '.' || $parte === '..') return false;
    }
    return isset(TIPI_FILE[strtolower(pathinfo($percorso, PATHINFO_EXTENSION))]);
}

/** Chiamate della pubblicazione: chiave nell'intestazione X-Chiave. Senza chiave giusta l'API non esiste (404). */
function richiedi_chiave(): void {
    $chiave = config()['chiave_pubblicazione'];
    $data = $_SERVER['HTTP_X_CHIAVE'] ?? '';
    if ($chiave === '' || !is_string($data) || !hash_equals($chiave, $data)) errore(404, 'Non trovato.');
}

/** Impronte (sha1) dei file che il sito serve adesso: quelli statici della cartella, sostituiti da quelli aggiornati. */
function impronte_sito(): array {
    $file = [];
    foreach ([dirname(__DIR__), cartella_sito()] as $base) {
        if (!is_dir($base)) continue;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            if (!$f->isFile()) continue;
            $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($base) + 1));
            if (percorso_valido($rel)) $file[$rel] = sha1_file($f->getPathname());
        }
    }
    return $file;
}

/**
 * Riceve un pezzo dello zip (corpo della richiesta). Con l'ultimo li unisce, controlla l'impronta sha256 ($id) ed estrae i file
 * in mdb-database/calendariogare/sito/.
 */
function ricevi_pezzo(string $id, int $parte, int $parti): array {
    if (!preg_match('/^[0-9a-f]{64}$/', $id) || $parti < 1 || $parti > 200 || $parte < 1 || $parte > $parti) errore(400, 'Richiesta non valida.');
    $dir = cartella_dati() . DIRECTORY_SEPARATOR . 'arrivo';
    if (!is_dir($dir)) mkdir($dir, 0700, true);
    // Pezzi rimasti da caricamenti interrotti.
    foreach (glob($dir . DIRECTORY_SEPARATOR . '*') ?: [] as $vecchio) {
        if (!str_starts_with(basename($vecchio), $id) && filemtime($vecchio) < time() - 3600) @unlink($vecchio);
    }
    $dati = file_get_contents('php://input', false, null, 0, PEZZO_BYTE + 1);
    if (!is_string($dati) || $dati === '' || strlen($dati) > PEZZO_BYTE) errore(413, 'Pezzo vuoto o troppo grande.');
    $pezzo = fn(int $n) => $dir . DIRECTORY_SEPARATOR . "$id.$n";
    file_put_contents($pezzo($parte), $dati, LOCK_EX);
    if ($parte < $parti) rispondi(['ricevuto' => $parte]);

    $zipFile = $dir . DIRECTORY_SEPARATOR . "$id.zip";
    $out = fopen($zipFile, 'wb');
    for ($n = 1; $n <= $parti; $n++) {
        $in = @fopen($pezzo($n), 'rb');
        if (!$in) {
            fclose($out);
            @unlink($zipFile);
            errore(400, "Manca il pezzo $n dello zip.");
        }
        stream_copy_to_stream($in, $out);
        fclose($in);
    }
    fclose($out);
    for ($n = 1; $n <= $parti; $n++) @unlink($pezzo($n));
    if (hash_file('sha256', $zipFile) !== $id) {
        @unlink($zipFile);
        errore(400, 'Zip danneggiato durante il trasferimento.');
    }
    try {
        $quanti = estrai($zipFile);
    } finally {
        @unlink($zipFile);
    }
    file_put_contents(cartella_dati() . DIRECTORY_SEPARATOR . 'pubblicazione.json', json_encode(['quando' => time(), 'file' => $quanti]), LOCK_EX);
    return ['ok' => true, 'file' => $quanti];
}

/** Estrae lo zip nella cartella dei file aggiornati, un file alla volta. */
function estrai(string $zipFile): int {
    @set_time_limit(300);
    ignore_user_abort(true);
    $zip = new ZipArchive();
    if ($zip->open($zipFile) !== true) errore(400, 'Zip non leggibile.');
    $quanti = 0;
    try {
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $nome = (string)$zip->getNameIndex($i);
            if (!percorso_valido($nome)) continue;
            $dest = cartella_sito() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $nome);
            if (!is_dir(dirname($dest))) mkdir(dirname($dest), 0700, true);
            // Prima in un file temporaneo e poi al suo posto: chi apre l'app in quel momento non legge mai un file a metà.
            $tmp = $dest . '.tmp';
            $in = $zip->getStream($nome);
            $out = fopen($tmp, 'wb');
            if (!$in || !$out) throw new RuntimeException("Non riesco a estrarre $nome.");
            stream_copy_to_stream($in, $out);
            fclose($in);
            fclose($out);
            if (!@rename($tmp, $dest)) {
                copy($tmp, $dest);
                @unlink($tmp);
            }
            $quanti++;
        }
    } finally {
        $zip->close();
    }
    return $quanti;
}

/** Svuota la cartella dei file aggiornati (dopo un caricamento completo con FileZilla): restituisce quanti file ha eliminato. */
function svuota(): int {
    $dir = cartella_sito();
    if (!is_dir($dir)) return 0;
    $quanti = 0;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) {
        if ($f->isDir()) {
            @rmdir($f->getPathname());
        } elseif (@unlink($f->getPathname())) {
            $quanti++;
        }
    }
    @rmdir($dir);
    return $quanti;
}
