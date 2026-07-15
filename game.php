<?php
/*
 * Dart 501 – Game state sync backend
 *
 * GET  ?id=<gameId>        → returns stored game-state JSON (or 404)
 * GET  ?code=<roomCode>    → returns {"gameId":"…"} for the latest game under that code (or 404)
 * POST body: {"id":"…","state":{…}}         → saves game-state JSON if it is not stale
 * POST body: {"code":"…","gameId":"…"}      → creates/updates a room-code → gameId mapping
 *
 * Game states are stored as plain JSON files in the ./games/ directory.
 * Room-code mappings are stored in the ./codes/ directory.
 * Files older than 24 h are pruned on every POST to avoid unbounded growth.
 */

/* ── Sentry ── */
$sentry_enabled = false;
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
    \Sentry\init([
        'dsn' => 'https://71d7f7f3ce33cf56c7ead5f04fc7b748@o4509889334083584.ingest.de.sentry.io/4511236648796240',
    ]);
    \Sentry\configureScope(function (\Sentry\State\Scope $scope): void {
        $scope->setTag('method', $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN');
        $scope->setExtra('query_params', array_keys($_GET));
    });
    $sentry_enabled = true;
}

/**
 * Report a message to Sentry if the SDK is loaded.
 *
 * @param string $message Human-readable description of the problem.
 * @param string $level   One of 'error', 'warning', 'info'.
 */
function sentry_report(string $message, string $level = 'warning'): void
{
    global $sentry_enabled;
    if (!$sentry_enabled) {
        return;
    }
    $severity = match ($level) {
        'error'   => \Sentry\Severity::error(),
        'info'    => \Sentry\Severity::info(),
        default   => \Sentry\Severity::warning(),
    };
    \Sentry\captureMessage($message, $severity);
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

/* ── Preflight ── */
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ── Config ── */
define('GAMES_DIR',     __DIR__ . '/games');
define('CODES_DIR',     __DIR__ . '/codes');
define('MAX_BODY',      65536);          // 64 KB per game file
define('MAX_AGE_SECS',  86400);          // prune files older than 24 h

/* ── Storage dir ── */
if (!is_dir(GAMES_DIR) && !mkdir(GAMES_DIR, 0750, true)) {
    sentry_report('Storage unavailable: could not create games directory', 'error');
    http_response_code(500);
    echo json_encode(['error' => 'Storage unavailable']);
    exit;
}
if (!is_dir(CODES_DIR) && !mkdir(CODES_DIR, 0750, true)) {
    sentry_report('Storage unavailable: could not create codes directory', 'error');
    http_response_code(500);
    echo json_encode(['error' => 'Codes storage unavailable']);
    exit;
}

/* ── Helpers ── */
function validate_id(string $raw): ?string
{
    // Accept UUID v4 or any alphanumeric+hyphen string, 8–64 chars
    $id = trim($raw);
    if (preg_match('/^[a-zA-Z0-9\-]{8,64}$/', $id)) {
        return $id;
    }
    return null;
}

function validate_room_code(string $raw): ?string
{
    // Accept exactly XXXX-XXXX where X is A-Z (uppercase)
    $code = strtoupper(trim($raw));
    if (preg_match('/^[A-Z]{4}-[A-Z]{4}$/', $code)) {
        return $code;
    }
    return null;
}

function game_file(string $id): string
{
    return GAMES_DIR . '/' . $id . '.json';
}

function code_file(string $code): string
{
    return CODES_DIR . '/' . $code . '.json';
}

function state_updated_at($state): ?int
{
    if (!is_array($state) || !isset($state['updatedAt']) || !is_numeric($state['updatedAt'])) {
        return null;
    }
    return (int) $state['updatedAt'];
}

function prune_old_games(): void
{
    $files = glob(GAMES_DIR . '/*.json');
    if (!$files) {
        return;
    }
    $cutoff = time() - MAX_AGE_SECS;
    foreach ($files as $file) {
        if (filemtime($file) < $cutoff) {
            @unlink($file);
        }
    }
}

function prune_old_codes(): void
{
    $files = glob(CODES_DIR . '/*.json');
    if (!$files) {
        return;
    }
    $cutoff = time() - MAX_AGE_SECS;
    foreach ($files as $file) {
        if (filemtime($file) < $cutoff) {
            @unlink($file);
        }
    }
}

/* ── GET – fetch game state or resolve room code ── */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Room-code lookup: ?code=XXXX-XXXX
    if (isset($_GET['code'])) {
        $code = validate_room_code($_GET['code'] ?? '');
        if ($code === null) {
            $raw_code = substr($_GET['code'] ?? '', 0, 32);
            sentry_report("User problem: invalid room code format in GET request – '{$raw_code}'");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid room code']);
            exit;
        }

        $file = code_file($code);
        if (!is_file($file)) {
            sentry_report("User problem: room code not found – {$code}", 'info');
            http_response_code(404);
            echo json_encode(['error' => 'Room code not found']);
            exit;
        }

        $data = file_get_contents($file);
        if ($data === false) {
            sentry_report("Server error: could not read room code file – {$code}", 'error');
            http_response_code(500);
            echo json_encode(['error' => 'Could not read room code']);
            exit;
        }

        echo $data;
        exit;
    }

    // Game-state lookup: ?id=<gameId>
    $id = validate_id($_GET['id'] ?? '');
    if ($id === null) {
        $raw_id = substr($_GET['id'] ?? '', 0, 64);
        sentry_report("User problem: invalid or missing game ID in GET request – '{$raw_id}'");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or missing game ID']);
        exit;
    }

    $file = game_file($id);
    if (!is_file($file)) {
        sentry_report("User problem: game not found – {$id}", 'info');
        http_response_code(404);
        echo json_encode(['error' => 'Game not found']);
        exit;
    }

    $data = file_get_contents($file);
    if ($data === false) {
        sentry_report("Server error: could not read game file – {$id}", 'error');
        http_response_code(500);
        echo json_encode(['error' => 'Could not read game']);
        exit;
    }

    echo $data;
    exit;
}

/* ── POST – save game state or update room-code mapping ── */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw === false) {
        sentry_report('Server error: could not read POST request body', 'error');
        http_response_code(500);
        echo json_encode(['error' => 'Could not read request body']);
        exit;
    }
    if (strlen($raw) > MAX_BODY) {
        sentry_report('User problem: POST payload exceeds size limit (' . strlen($raw) . ' bytes)');
        http_response_code(413);
        echo json_encode(['error' => 'Payload too large']);
        exit;
    }

    $body = json_decode($raw, true);
    if (!is_array($body)) {
        sentry_report('User problem: POST body is not valid JSON');
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    // Room-code update: { code, gameId } — no state field
    if (isset($body['code']) && !isset($body['state'])) {
        $code   = validate_room_code($body['code'] ?? '');
        $gameId = validate_id($body['gameId'] ?? '');

        if ($code === null) {
            $raw_code = substr($body['code'] ?? '', 0, 32);
            sentry_report("User problem: invalid room code format in POST room-code update – '{$raw_code}'");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid room code']);
            exit;
        }
        if ($gameId === null) {
            $raw_game_id = substr($body['gameId'] ?? '', 0, 64);
            sentry_report("User problem: invalid or missing gameId in POST room-code update – '{$raw_game_id}'");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or missing gameId']);
            exit;
        }

        $json = json_encode(['gameId' => $gameId]);
        $file = code_file($code);
        if (file_put_contents($file, $json, LOCK_EX) === false) {
            sentry_report("Server error: could not write room code file – {$code}", 'error');
            http_response_code(500);
            echo json_encode(['error' => 'Could not write room code']);
            exit;
        }

        @prune_old_codes();

        http_response_code(200);
        echo json_encode(['ok' => true]);
        exit;
    }

    // Game-state save: { id, state }
    $id = validate_id($body['id'] ?? '');
    if ($id === null) {
        $raw_id = substr($body['id'] ?? '', 0, 64);
        sentry_report("User problem: invalid or missing game ID in POST game-state save – '{$raw_id}'");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or missing game ID']);
        exit;
    }

    $state = $body['state'] ?? null;
    if (!is_array($state)) {
        sentry_report('User problem: missing or invalid state in POST game-state save');
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid state']);
        exit;
    }

    $json = json_encode($state, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        sentry_report('Server error: state JSON serialisation failed for game ' . $id, 'error');
        http_response_code(400);
        echo json_encode(['error' => 'State serialisation failed or too large']);
        exit;
    }
    if (strlen($json) > MAX_BODY) {
        sentry_report('User problem: serialised state exceeds size limit for game ' . $id . ' (' . strlen($json) . ' bytes)');
        http_response_code(400);
        echo json_encode(['error' => 'State serialisation failed or too large']);
        exit;
    }

    $file = game_file($id);
    $incoming_updated_at = state_updated_at($state);
    if (is_file($file) && $incoming_updated_at !== null) {
        $existing_raw = file_get_contents($file);
        $existing_state = $existing_raw === false ? null : json_decode($existing_raw, true);
        $existing_updated_at = state_updated_at($existing_state);

        if ($existing_updated_at !== null && $existing_updated_at > $incoming_updated_at) {
            http_response_code(200);
            echo json_encode(['ok' => true, 'ignored' => 'stale']);
            exit;
        }
    }

    if (file_put_contents($file, $json, LOCK_EX) === false) {
        sentry_report("Server error: could not write game file – {$id}", 'error');
        http_response_code(500);
        echo json_encode(['error' => 'Could not write game']);
        exit;
    }

    // Best-effort cleanup — don't fail the request if it errors
    @prune_old_games();

    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

/* ── Any other method ── */
sentry_report('User problem: unsupported HTTP method – ' . ($_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN'));
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
