<?php
/**
 * Mikhmon V4 - Logique métier hotspot : script on-login des profils, vouchers, ventes.
 */

const MK_EXPIRE_MODES = [
    'none' => 'Aucune (pas d\'expiration)',
    'remove' => 'Supprimer l\'utilisateur à l\'expiration',
    'notice' => 'Bloquer l\'utilisateur à l\'expiration (le garder)',
];

const MK_CHARSETS = [
    'num' => ['Chiffres (123)', '23456789'],
    'lower' => ['Minuscules (abc)', 'abcdefghjkmnpqrstuvwxyz'],
    'upper' => ['Majuscules (ABC)', 'ABCDEFGHJKMNPQRSTUVWXYZ'],
    'lownum' => ['Minuscules + chiffres', 'abcdefghjkmnpqrstuvwxyz23456789'],
    'upnum' => ['Majuscules + chiffres', 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'],
    'mix' => ['Mixte (aB3)', 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'],
];

function mk_random_string(int $len, string $charset = 'num'): string
{
    $chars = MK_CHARSETS[$charset][1] ?? MK_CHARSETS['num'][1];
    $out = '';
    $max = strlen($chars) - 1;
    for ($i = 0; $i < $len; $i++) {
        $out .= $chars[random_int(0, $max)];
    }
    return $out;
}

/** Valide une durée RouterOS (ex: 30m, 1h, 1d12h, 4w). */
function mk_valid_duration(string $s): bool
{
    return (bool)preg_match('/^(\d+w)?(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/', $s) && $s !== '';
}

/**
 * Construit le script on-login d'un profil utilisateur.
 * $o : mode (none|remove|notice), price, sprice, validity, lock (bool), record (bool)
 *
 * Au premier login de l'utilisateur :
 *  - si mode != none : crée un scheduler "exp-<user>" (intervalle = validité) qui supprime
 *    ou bloque l'utilisateur à l'échéance, puis note la date d'expiration en commentaire ;
 *  - verrouille éventuellement l'utilisateur sur l'adresse MAC ;
 *  - enregistre la vente dans /system script (format compatible Mikhmon V3).
 */
function mk_build_onlogin(array $o): string
{
    $mode = array_key_exists($o['mode'] ?? '', MK_EXPIRE_MODES) ? $o['mode'] : 'none';
    $price = (string)(float)($o['price'] ?? 0);
    $sprice = (string)(float)($o['sprice'] ?? 0);
    $validity = preg_replace('/[^0-9wdhms]/', '', (string)($o['validity'] ?? ''));
    if ($validity === '' || !mk_valid_duration($validity)) {
        $validity = '';
        $mode = 'none';
    }
    $lock = !empty($o['lock']) ? '1' : '0';
    $record = !empty($o['record']) ? '1' : '0';

    if ($mode === 'none' && $lock === '0' && $record === '0') {
        return ":put \",mkv4,none,$price,$validity,$sprice,0,0,\";";
    }

    $kill = '/ip hotspot active remove [find where user=\"" . $user . "\"]; '
        . '/ip hotspot cookie remove [find where user=\"" . $user . "\"]; ';
    $evRemove = '"' . $kill . '/ip hotspot user remove [find where name=\"" . $user . "\"]; '
        . '/system scheduler remove [find where name=\"" . $sname . "\"]"';
    $evNotice = '"/ip hotspot user set [find where name=\"" . $user . "\"] limit-uptime=1s comment=\"" . $comment . " | EXPIRE\"; '
        . $kill . '/system scheduler remove [find where name=\"" . $sname . "\"]"';

    return <<<RSC
:put ",mkv4,$mode,$price,$validity,$sprice,$lock,$record,";
{
:local mode "$mode";
:local price "$price";
:local validity "$validity";
:local lock "$lock";
:local record "$record";
:local mac \$"mac-address";
:local date [/system clock get date];
:local time [/system clock get time];
:local uid [/ip hotspot user find where name=\$user];
:local comment [/ip hotspot user get \$uid comment];
:local profile [/ip hotspot user get \$uid profile];
:if ([:typeof [:find \$comment "1st:"]] = "nil") do={
  :local note ("1st:" . \$date . " " . \$time);
  :if (\$mode != "none") do={
    :local sname ("exp-" . \$user);
    /system scheduler remove [find where name=\$sname];
    :local ev "";
    :if (\$mode = "remove") do={
      :set ev ($evRemove);
    } else={
      :set ev ($evNotice);
    }
    /system scheduler add name=\$sname interval=\$validity on-event=\$ev comment="mikhmon" policy=read,write,policy,test disabled=no;
    :delay 1s;
    :set note (\$note . " | exp:" . [/system scheduler get [find where name=\$sname] next-run]);
  }
  :if (\$comment = "") do={
    /ip hotspot user set \$uid comment=\$note;
  } else={
    /ip hotspot user set \$uid comment=(\$comment . " | " . \$note);
  }
  :if (\$lock = "1") do={ /ip hotspot user set \$uid mac-address=\$mac; }
  :if (\$record = "1") do={
    /system script add name=(\$date . "-|-" . \$time . "-|-" . \$user . "-|-" . \$price . "-|-" . \$address . "-|-" . \$mac . "-|-" . \$validity . "-|-" . \$profile . "-|-" . \$comment) source=\$date comment="mikhmon";
  }
}
}
RSC;
}

/**
 * Lit les options Mikhmon d'un script on-login (V4, ou V3 pour la compatibilité).
 */
function mk_parse_onlogin(string $script): array
{
    $o = ['mode' => 'none', 'price' => '0', 'validity' => '', 'sprice' => '0', 'lock' => false, 'record' => false, 'managed' => false];
    if (preg_match('/:put ",mkv4,(\w*),([\d.]*),([0-9wdhms]*),([\d.]*),([01]),([01]),"/', $script, $m)) {
        return ['mode' => $m[1], 'price' => $m[2], 'validity' => $m[3], 'sprice' => $m[4],
            'lock' => $m[5] === '1', 'record' => $m[6] === '1', 'managed' => true];
    }
    // Mikhmon V3 : :put (",rem,1000,30d,1500,,Disable,");
    if (preg_match('/:put \(",(rem|ntf|remc|ntfc|0)?,([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),/', $script, $m)) {
        $mode = $m[1] ?? '';
        return ['mode' => str_starts_with($mode, 'rem') ? 'remove' : (str_starts_with($mode, 'ntf') ? 'notice' : 'none'),
            'price' => $m[2] ?: '0', 'validity' => $m[3], 'sprice' => $m[4] ?: '0',
            'lock' => strcasecmp($m[6], 'Enable') === 0, 'record' => str_ends_with($mode, 'c'), 'managed' => true, 'v3' => true];
    }
    return $o;
}

/** Lot d'origine d'un utilisateur (le commentaire est complété au 1er login : "vc-xxx | 1st:..."). */
function mk_batch(string $comment): string
{
    return explode(' | ', $comment, 2)[0];
}

/** Normalise une date RouterOS (v6 "oct/06/2026" ou v7 "2026-10-06") en Y-m-d. */
function mk_norm_date(string $d): ?string
{
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d)) {
        return $d;
    }
    if (preg_match('#^([a-z]{3})/(\d{2})/(\d{4})$#i', $d, $m)) {
        $months = ['jan' => 1, 'feb' => 2, 'mar' => 3, 'apr' => 4, 'may' => 5, 'jun' => 6, 'jul' => 7, 'aug' => 8, 'sep' => 9, 'oct' => 10, 'nov' => 11, 'dec' => 12];
        $mo = $months[strtolower($m[1])] ?? null;
        return $mo ? sprintf('%s-%02d-%s', $m[3], $mo, $m[2]) : null;
    }
    return null;
}

/** Analyse un script de vente "date-|-heure-|-user-|-prix-|-ip-|-mac-|-validité-|-profil-|-commentaire". */
function mk_parse_sale(array $script): ?array
{
    $p = explode('-|-', $script['name'] ?? '');
    if (count($p) < 8) {
        return null;
    }
    $date = mk_norm_date($p[0]);
    if (!$date) {
        return null;
    }
    return [
        'id' => $script['.id'] ?? '', 'date' => $date, 'time' => $p[1], 'user' => $p[2], 'price' => (float)$p[3],
        'ip' => $p[4], 'mac' => $p[5], 'validity' => $p[6], 'profile' => $p[7], 'comment' => $p[8] ?? '',
    ];
}

/** Toutes les ventes enregistrées, triées de la plus récente à la plus ancienne. */
function mk_sales($api): array
{
    $sales = [];
    foreach ($api->comm('/system/script/print', ['?comment' => 'mikhmon', '.proplist' => '.id,name']) as $s) {
        if ($sale = mk_parse_sale($s)) {
            $sales[] = $sale;
        }
    }
    usort($sales, fn($a, $b) => strcmp($b['date'] . $b['time'], $a['date'] . $a['time']));
    return $sales;
}

function mk_bytes($b): string
{
    $b = (float)$b;
    if ($b <= 0) {
        return '0 B';
    }
    $u = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    $i = min((int)floor(log($b, 1024)), count($u) - 1);
    return round($b / (1024 ** $i), $i ? 2 : 0) . ' ' . $u[$i];
}

function mk_bits($b): string
{
    $b = (float)$b;
    if ($b < 1000) {
        return round($b) . ' bps';
    }
    $u = ['bps', 'kbps', 'Mbps', 'Gbps'];
    $i = min((int)floor(log($b, 1000)), 3);
    return round($b / (1000 ** $i), 1) . ' ' . $u[$i];
}

/** Convertit une taille saisie ("500M", "2G", "1024") en octets pour limit-bytes-total. */
function mk_parse_size(string $s): string
{
    $s = strtoupper(trim($s));
    if ($s === '') {
        return '';
    }
    if (!preg_match('/^(\d+(?:\.\d+)?)\s*([KMG]?)B?$/', $s, $m)) {
        return '';
    }
    $mult = ['' => 1, 'K' => 1024, 'M' => 1024 ** 2, 'G' => 1024 ** 3][$m[2]];
    return (string)(int)round((float)$m[1] * $mult);
}

/** Formate une durée RouterOS de façon lisible (1d2h3m4s -> 1j 2h 3m 4s). */
function mk_duration(?string $d): string
{
    if ($d === null || $d === '') {
        return '';
    }
    $units = ['w' => 'sem', 'd' => 'j', 'h' => 'h', 'm' => 'min', 's' => 's'];
    $out = preg_replace_callback('/(\d+)([wdhms])/', fn($m) => $m[1] . $units[$m[2]] . ' ', $d);
    return trim($out);
}
