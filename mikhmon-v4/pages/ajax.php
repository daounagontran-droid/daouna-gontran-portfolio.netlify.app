<?php
/** Points d'accès JSON pour les rafraîchissements en direct. */

header('Content-Type: application/json');
header('Cache-Control: no-store');

$api = api();
$out = [];
switch (get('a')) {
    case 'traffic':
        $iface = get('iface') ?: (router()['iface'] ?? 'ether1');
        $t = $api->comm('/interface/monitor-traffic', ['interface' => $iface, 'once' => ''])[0] ?? [];
        $out = ['iface' => $iface, 'rx' => (int)($t['rx-bits-per-second'] ?? 0), 'tx' => (int)($t['tx-bits-per-second'] ?? 0), 't' => time()];
        break;
    case 'live':
        $res = $api->comm('/system/resource/print')[0] ?? [];
        $clock = $api->comm('/system/clock/print')[0] ?? [];
        $active = $api->comm('/ip/hotspot/active/print', ['count-only' => ''])[0]['ret'] ?? '0';
        $out = [
            'cpu' => (int)($res['cpu-load'] ?? 0),
            'mem' => mk_bytes(($res['total-memory'] ?? 0) - ($res['free-memory'] ?? 0)) . ' / ' . mk_bytes($res['total-memory'] ?? 0),
            'uptime' => mk_duration($res['uptime'] ?? ''),
            'clock' => ($clock['date'] ?? '') . ' ' . ($clock['time'] ?? ''),
            'active' => (int)$active,
        ];
        break;
    default:
        http_response_code(400);
        $out = ['error' => 'action inconnue'];
}
echo json_encode($out);
