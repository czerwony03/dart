<?php
/*
 * Dart 501 – Game state sync backend
 *
 * GET  ?id=<gameId>        → returns stored game-state JSON (or 404)
 * POST body: {"id":"…","state":{…}} → saves game-state JSON (last-write-wins)
 *
 * Game states are stored as plain JSON files in the ./games/ directory.
 * Files older than 24 h are pruned on every POST to avoid unbounded growth.
 */

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
define('MAX_BODY',      65536);          // 64 KB per game file
define('MAX_AGE_SECS',  86400);          // prune files older than 24 h

/* ── Storage dir ── */
if (!is_dir(GAMES_DIR) && !mkdir(GAMES_DIR, 0750, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Storage unavailable']);
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

function game_file(string $id): string
{
    return GAMES_DIR . '/' . $id . '.json';
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

/* ── GET – fetch game state ── */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
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

/* ── POST – save game state ── */
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
