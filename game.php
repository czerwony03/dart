<?php
/*
 * Dart 501 – Game state sync backend
 *
 * GET  ?id=<gameId>        → returns stored game-state JSON (or 404)
 * GET  ?code=<roomCode>    → returns {"gameId":"…"} for the latest game under that code (or 404)
 * POST body: {"id":"…","state":{…}}         → saves game-state JSON (last-write-wins)
 * POST body: {"code":"…","gameId":"…"}      → creates/updates a room-code → gameId mapping
 *
 * Game states are stored as plain JSON files in the ./games/ directory.
 * Room-code mappings are stored in the ./codes/ directory.
 * Files older than 24 h are pruned on every POST to avoid unbounded growth.
 */

/* ── Sentry ── */
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
    \Sentry\init([
        'dsn' => 'https://71d7f7f3ce33cf56c7ead5f04fc7b748@o4509889334083584.ingest.de.sentry.io/4511236648796240',
    ]);
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
    http_response_code(500);
    echo json_encode(['error' => 'Storage unavailable']);
    exit;
}
if (!is_dir(CODES_DIR) && !mkdir(CODES_DIR, 0750, true)) {
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
            http_response_code(400);
            echo json_encode(['error' => 'Invalid room code']);
            exit;
        }

        $file = code_file($code);
        if (!is_file($file)) {
            http_response_code(404);
            echo json_encode(['error' => 'Room code not found']);
            exit;
        }

        $data = file_get_contents($file);
        if ($data === false) {
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
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or missing game ID']);
        exit;
    }

    $file = game_file($id);
    if (!is_file($file)) {
        http_response_code(404);
        echo json_encode(['error' => 'Game not found']);
        exit;
    }

    $data = file_get_contents($file);
    if ($data === false) {
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
    if ($raw === false || strlen($raw) > MAX_BODY) {
        http_response_code(413);
        echo json_encode(['error' => 'Payload too large']);
        exit;
    }

    $body = json_decode($raw, true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    // Room-code update: { code, gameId } — no state field
    if (isset($body['code']) && !isset($body['state'])) {
        $code   = validate_room_code($body['code'] ?? '');
        $gameId = validate_id($body['gameId'] ?? '');

        if ($code === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid room code']);
            exit;
        }
        if ($gameId === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or missing gameId']);
            exit;
        }

        $json = json_encode(['gameId' => $gameId]);
        $file = code_file($code);
        if (file_put_contents($file, $json, LOCK_EX) === false) {
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
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or missing game ID']);
        exit;
    }

    $state = $body['state'] ?? null;
    if (!is_array($state)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid state']);
        exit;
    }

    $json = json_encode($state, JSON_UNESCAPED_UNICODE);
    if ($json === false || strlen($json) > MAX_BODY) {
        http_response_code(400);
        echo json_encode(['error' => 'State serialisation failed or too large']);
        exit;
    }

    $file = game_file($id);
    if (file_put_contents($file, $json, LOCK_EX) === false) {
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
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
