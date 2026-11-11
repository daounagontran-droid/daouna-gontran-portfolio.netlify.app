<?php
/**
 * Mikhmon V4 - MikroTik Hotspot Monitor
 * Contrôleur frontal : index.php?p=<page>
 */

require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/layout.php';

$page = preg_replace('/[^a-z_]/', '', get('p', 'dashboard')) ?: 'dashboard';

// Première installation : création du compte administrateur.
if (!cfg()['admin']) {
    $page = 'setup';
} elseif ($page === 'logout') {
    if (is_post()) {
        csrf_check();
        $_SESSION = [];
        session_destroy();
    }
    redirect(url('login'));
} elseif (!is_logged()) {
    $page = 'login';
}

// Pages accessibles sans routeur sélectionné.
$noRouter = ['setup', 'login', 'routers', 'settings'];
// Pages autonomes (sans menu ni gabarit).
$standalone = ['setup', 'login', 'print', 'ajax'];

if ($page !== 'setup' && $page !== 'login' && !in_array($page, $noRouter, true) && !router()) {
    redirect(url('routers'));
}

$file = __DIR__ . '/pages/' . $page . '.php';
if (!is_file($file)) {
    http_response_code(404);
    $file = __DIR__ . '/pages/notfound.php';
}

$title = 'Mikhmon V4';
ob_start();
try {
    include $file;
} catch (RouterOSException $e) {
    if (in_array($page, $standalone, true)) {
        ob_end_clean();
        if ($page === 'ajax') {
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
            exit;
        }
        throw $e;
    }
    echo '<div class="alert alert-error"><strong>Erreur routeur :</strong> ' . h($e->getMessage())
        . ' — <a href="' . h(url('routers')) . '">vérifier la connexion</a></div>';
}
$content = ob_get_clean();

if (in_array($page, $standalone, true)) {
    echo $content;
} else {
    render_layout($title, $page, $content);
}
