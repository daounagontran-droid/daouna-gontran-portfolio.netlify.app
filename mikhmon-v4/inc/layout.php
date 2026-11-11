<?php
/**
 * Mikhmon V4 - Gabarit HTML (menu latéral, barre supérieure) et composants.
 */

const MK_MENU = [
    ['Tableau de bord', [['dashboard', 'Tableau de bord', '◧']]],
    ['Hotspot', [
        ['users', 'Utilisateurs', '👤'],
        ['generate', 'Générer des vouchers', '✚'],
        ['profiles', 'Profils utilisateurs', '☰'],
        ['active', 'Sessions actives', '⚡'],
        ['hosts', 'Hôtes', '⌂'],
        ['bindings', 'IP Bindings', '⇄'],
        ['cookies', 'Cookies', '◔'],
    ]],
    ['Vouchers & ventes', [
        ['vouchers', 'Imprimer des vouchers', '⎙'],
        ['reports', 'Rapport des ventes', '₣'],
    ]],
    ['Réseau', [
        ['traffic', 'Trafic en direct', '↯'],
        ['dhcp', 'Baux DHCP', '⊞'],
        ['ppp', 'PPP', '⇌'],
    ]],
    ['Système', [
        ['log', 'Journal hotspot', '≣'],
        ['scheduler', 'Planificateur', '⏲'],
        ['system', 'Système', '⚙'],
    ]],
    ['Mikhmon', [
        ['routers', 'Routeurs', '⌘'],
        ['settings', 'Paramètres', '✎'],
    ]],
];

function theme_attr(): string
{
    $t = setting('theme', 'dark');
    return $t === 'light' ? 'light' : 'dark';
}

function head_html(string $title): string
{
    return '<!doctype html><html lang="fr" data-theme="' . theme_attr() . '"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="csrf" content="' . h(csrf_token()) . '">'
        . '<title>' . h($title) . ' · Mikhmon V4</title>'
        . '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E📶%3C/text%3E%3C/svg%3E">'
        . '<link rel="stylesheet" href="assets/app.css?v=' . MK_VERSION . '"></head>';
}

function render_layout(string $title, string $page, string $content): void
{
    $r = router();
    echo head_html($title);
    echo '<body><div class="app">';
    echo '<aside class="sidebar" id="sidebar"><div class="brand"><span class="logo">📶</span><div><strong>Mikhmon</strong> <span class="badge">V4</span><small>Hotspot Monitor</small></div></div><nav>';
    foreach (MK_MENU as [$group, $items]) {
        echo '<div class="nav-group">' . h($group) . '</div>';
        foreach ($items as [$p, $label, $icon]) {
            $active = $p === $page ? ' active' : '';
            echo '<a class="nav-link' . $active . '" href="' . h(url($p)) . '"><span class="ico">' . $icon . '</span>' . h($label) . '</a>';
        }
    }
    echo '<form method="post" action="' . h(url('logout')) . '">' . csrf_field() . '<button class="nav-link logout" type="submit"><span class="ico">⏻</span>Déconnexion</button></form>';
    echo '</nav><div class="sidebar-foot">Mikhmon V4 ' . MK_VERSION . '</div></aside>';

    echo '<div class="main"><header class="topbar"><button class="burger" id="burger" aria-label="Menu">☰</button>';
    echo '<h1>' . h($title) . '</h1><div class="topbar-right">';
    if ($r) {
        echo '<a class="router-pill" href="' . h(url('routers')) . '" title="Changer de routeur"><span class="dot"></span>' . h($r['name'] ?: $r['host']) . (!empty($r['demo']) ? ' <em>démo</em>' : '') . '</a>';
    }
    echo '<button class="btn-icon" id="themeToggle" title="Thème clair/sombre">◐</button></div></header>';
    echo '<main class="content">';
    foreach (flashes() as [$type, $msg]) {
        echo '<div class="alert alert-' . h($type) . '">' . h($msg) . '</div>';
    }
    echo $content;
    echo '</main></div></div><script src="assets/app.js?v=' . MK_VERSION . '"></script></body></html>';
}

function render_auth(string $title, string $body): void
{
    echo head_html($title);
    echo '<body class="auth"><div class="auth-card"><div class="brand big"><span class="logo">📶</span><div><strong>Mikhmon</strong> <span class="badge">V4</span><small>MikroTik Hotspot Monitor</small></div></div>';
    foreach (flashes() as [$type, $msg]) {
        echo '<div class="alert alert-' . h($type) . '">' . h($msg) . '</div>';
    }
    echo $body . '</div></body></html>';
}

/** Bouton POST (action destructrice) avec confirmation. */
function post_button(string $action, array $fields, string $label, string $class = 'btn btn-sm', ?string $confirm = null): string
{
    $html = '<form method="post" class="inline" action="' . h($action) . '"' . ($confirm ? ' data-confirm="' . h($confirm) . '"' : '') . '>' . csrf_field();
    foreach ($fields as $k => $v) {
        $html .= '<input type="hidden" name="' . h($k) . '" value="' . h($v) . '">';
    }
    return $html . '<button class="' . h($class) . '" type="submit">' . $label . '</button></form>';
}

function select_options(array $options, $selected, bool $assoc = false): string
{
    $html = '';
    foreach ($options as $k => $v) {
        $value = $assoc ? $k : $v;
        $html .= '<option value="' . h($value) . '"' . ((string)$value === (string)$selected ? ' selected' : '') . '>' . h($v) . '</option>';
    }
    return $html;
}

function stat_card(string $label, string $value, string $sub = '', string $accent = ''): string
{
    return '<div class="stat ' . h($accent) . '"><div class="stat-label">' . h($label) . '</div><div class="stat-value">' . $value . '</div>'
        . ($sub !== '' ? '<div class="stat-sub">' . $sub . '</div>' : '') . '</div>';
}

function yesno($v): string
{
    return $v === 'true' ? '<span class="tag ok">oui</span>' : '<span class="tag">non</span>';
}
