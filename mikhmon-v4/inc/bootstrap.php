<?php
/**
 * Mikhmon V4 - Initialisation : configuration, authentification, CSRF, connexion routeur.
 */

declare(strict_types=1);

const MK_VERSION = '4.0.0';
define('MK_ROOT', dirname(__DIR__));
define('MK_DATA', MK_ROOT . '/data');
define('MK_CONFIG', MK_DATA . '/config.php');

require_once __DIR__ . '/RouterOSAPI.php';
require_once __DIR__ . '/DemoAPI.php';
require_once __DIR__ . '/hotspot.php';

error_reporting(E_ALL);
ini_set('display_errors', '0');

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('MIKHMONV4');
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
    session_start();
}

header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

// ------------------------------------------------------------------ configuration

function cfg(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = is_file(MK_CONFIG) ? (include MK_CONFIG) : [];
        if (!is_array($cfg)) {
            $cfg = [];
        }
        $cfg += ['admin' => null, 'key' => null, 'routers' => [], 'settings' => []];
        $cfg['settings'] += ['timezone' => 'Africa/Ndjamena', 'theme' => 'dark'];
    }
    return $cfg;
}

function cfg_save(array $cfg): void
{
    if (!is_dir(MK_DATA) && !@mkdir(MK_DATA, 0750, true)) {
        throw new RuntimeException('Impossible de créer le dossier data/ : vérifiez les permissions.');
    }
    $php = "<?php\n// Fichier généré par Mikhmon V4 - ne pas publier.\nreturn " . var_export($cfg, true) . ";\n";
    $tmp = MK_CONFIG . '.tmp';
    if (@file_put_contents($tmp, $php, LOCK_EX) === false || !@rename($tmp, MK_CONFIG)) {
        throw new RuntimeException('Impossible d\'écrire data/config.php : vérifiez les permissions.');
    }
    @chmod(MK_CONFIG, 0640);
    if (function_exists('opcache_invalidate')) {
        @opcache_invalidate(MK_CONFIG, true);
    }
}

function setting(string $k, $default = null)
{
    return cfg()['settings'][$k] ?? $default;
}

date_default_timezone_set(setting('timezone', 'UTC') ?: 'UTC');

/** Chiffre les mots de passe des routeurs (AES-256-GCM) avec la clé du fichier de config. */
function mk_encrypt(string $plain): string
{
    $key = base64_decode((string)cfg()['key']);
    $iv = random_bytes(12);
    $tag = '';
    $ct = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return 'v1:' . base64_encode($iv . $tag . $ct);
}

function mk_decrypt(string $enc): string
{
    if (!str_starts_with($enc, 'v1:')) {
        return $enc;
    }
    $raw = base64_decode(substr($enc, 3));
    $key = base64_decode((string)cfg()['key']);
    $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $plain === false ? '' : $plain;
}

// ------------------------------------------------------------------ utilitaires

function h($s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function url(string $page, array $params = []): string
{
    return 'index.php?' . http_build_query(['p' => $page] + $params);
}

function redirect(string $to): never
{
    header('Location: ' . $to);
    exit;
}

function flash(string $type, string $msg): void
{
    $_SESSION['flash'][] = [$type, $msg];
}

function flashes(): array
{
    $f = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $f;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . h(csrf_token()) . '">';
}

function csrf_check(): void
{
    if (!hash_equals(csrf_token(), (string)($_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF'] ?? ''))) {
        http_response_code(400);
        exit('Jeton CSRF invalide. Rechargez la page.');
    }
}

function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

function post(string $k, string $default = ''): string
{
    $v = $_POST[$k] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

function get(string $k, string $default = ''): string
{
    $v = $_GET[$k] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

// ------------------------------------------------------------------ authentification

function is_logged(): bool
{
    return !empty($_SESSION['admin']) && ($_SESSION['admin_fp'] ?? '') === hash('sha256', (string)(cfg()['admin']['hash'] ?? ''));
}

function login(string $user, string $pass): bool
{
    $a = cfg()['admin'];
    // Limitation basique des tentatives par session.
    $_SESSION['login_fail'] = $_SESSION['login_fail'] ?? 0;
    if ($_SESSION['login_fail'] >= 5 && time() - ($_SESSION['login_last'] ?? 0) < 60) {
        return false;
    }
    if ($a && hash_equals($a['user'], $user) && password_verify($pass, $a['hash'])) {
        session_regenerate_id(true);
        $_SESSION['admin'] = $user;
        $_SESSION['admin_fp'] = hash('sha256', $a['hash']);
        $_SESSION['login_fail'] = 0;
        return true;
    }
    $_SESSION['login_fail']++;
    $_SESSION['login_last'] = time();
    return false;
}

// ------------------------------------------------------------------ routeur courant

function router(?string $id = null): ?array
{
    $id ??= $_SESSION['rid'] ?? null;
    if ($id === null) {
        return null;
    }
    $r = cfg()['routers'][$id] ?? null;
    return $r ? $r + ['id' => $id] : null;
}

function router_defaults(): array
{
    return ['name' => '', 'host' => '', 'port' => 8728, 'ssl' => false, 'user' => 'admin', 'pass' => '', 'hotspot_name' => 'Mon Hotspot',
        'dns_name' => 'wifi.local', 'currency' => 'FCFA', 'iface' => 'ether1', 'reload' => 10, 'demo' => false];
}

/** Connexion API vers un routeur (mise en cache pour la requête). */
function api_for(array $r)
{
    if (!empty($r['demo'])) {
        return new DemoAPI();
    }
    $api = new RouterOSAPI(6);
    $api->connect($r['host'], $r['user'], mk_decrypt((string)$r['pass']), (int)$r['port'], !empty($r['ssl']));
    return $api;
}

function api()
{
    static $api = null;
    if ($api === null) {
        $r = router();
        if (!$r) {
            throw new RouterOSException('Aucun routeur sélectionné');
        }
        $api = api_for($r);
    }
    return $api;
}

function money($v): string
{
    $r = router();
    $cur = $r['currency'] ?? '';
    $dec = in_array(strtoupper($cur), ['FCFA', 'XAF', 'XOF', 'CFA', 'IDR', 'RP', 'GNF', 'MGA'], true) ? 0 : 2;
    return number_format((float)$v, $dec, ',', ' ') . ($cur !== '' ? ' ' . $cur : '');
}

/** Liste des profils utilisateurs hotspot (noms). */
function hs_profile_names(): array
{
    return array_map(fn($p) => $p['name'], api()->comm('/ip/hotspot/user/profile/print', ['.proplist' => 'name']));
}

function hs_server_names(): array
{
    return array_map(fn($p) => $p['name'], api()->comm('/ip/hotspot/print', ['.proplist' => 'name']));
}
