<?php
/** Tableau de bord : état du routeur, hotspot, revenus et trafic en direct. */

$title = 'Tableau de bord';
$api = api();
$r = router();

$res = $api->comm('/system/resource/print')[0] ?? [];
$clock = $api->comm('/system/clock/print')[0] ?? [];
$identity = $api->comm('/system/identity/print')[0]['name'] ?? '';
try {
    $rb = $api->comm('/system/routerboard/print')[0] ?? [];
} catch (RouterOSException $e) {
    $rb = []; // CHR / x86 : pas de routerboard
}
$active = (int)($api->comm('/ip/hotspot/active/print', ['count-only' => ''])[0]['ret'] ?? 0);
$users = (int)($api->comm('/ip/hotspot/user/print', ['count-only' => ''])[0]['ret'] ?? 0);

$sales = mk_sales($api);
$today = date('Y-m-d');
$month = date('Y-m');
$inc = ['today' => [0, 0], 'month' => [0, 0]];
$days = [];
for ($i = 13; $i >= 0; $i--) {
    $days[date('Y-m-d', strtotime("-$i days"))] = 0;
}
foreach ($sales as $s) {
    if ($s['date'] === $today) {
        $inc['today'][0] += $s['price'];
        $inc['today'][1]++;
    }
    if (str_starts_with($s['date'], $month)) {
        $inc['month'][0] += $s['price'];
        $inc['month'][1]++;
    }
    if (isset($days[$s['date']])) {
        $days[$s['date']] += $s['price'];
    }
}
$maxDay = max(1, max($days));

$logs = array_filter($api->comm('/log/print'), fn($l) => str_contains($l['topics'] ?? '', 'hotspot'));
$logs = array_slice(array_reverse($logs), 0, 8);

$memUsed = ($res['total-memory'] ?? 0) - ($res['free-memory'] ?? 0);
$memPct = !empty($res['total-memory']) ? round($memUsed / $res['total-memory'] * 100) : 0;
$hddPct = !empty($res['total-hdd-space']) ? round((1 - $res['free-hdd-space'] / $res['total-hdd-space']) * 100) : 0;
$ifaces = array_map(fn($i) => $i['name'], $api->comm('/interface/print', ['.proplist' => 'name']));
?>
<div class="stats" data-live="<?= h(url('ajax', ['a' => 'live'])) ?>" data-reload="<?= (int)$r['reload'] ?>">
  <?= stat_card('Horloge du routeur', '<span data-k="clock">' . h(($clock['date'] ?? '') . ' ' . ($clock['time'] ?? '')) . '</span>', h($identity), 'blue') ?>
  <?= stat_card('Sessions actives', '<span data-k="active">' . $active . '</span>', '<a href="' . h(url('active')) . '">voir</a>', 'green') ?>
  <?= stat_card('Utilisateurs hotspot', (string)$users, '<a href="' . h(url('users')) . '">gérer</a>', 'purple') ?>
  <?= stat_card('Revenu du jour', h(money($inc['today'][0])), $inc['today'][1] . ' vente(s)', 'orange') ?>
  <?= stat_card('Revenu du mois', h(money($inc['month'][0])), $inc['month'][1] . ' vente(s)', 'teal') ?>
</div>

<div class="grid-2">
  <div class="card">
    <h3>Système</h3>
    <table class="kv">
      <tr><th>Modèle</th><td><?= h($res['board-name'] ?? '') ?> <?= h($rb['model'] ?? '') ?></td></tr>
      <tr><th>RouterOS</th><td><?= h($res['version'] ?? '') ?></td></tr>
      <tr><th>Uptime</th><td data-k="uptime"><?= h(mk_duration($res['uptime'] ?? '')) ?></td></tr>
      <tr><th>CPU</th><td><div class="bar"><span data-k="cpu-bar" style="width:<?= (int)($res['cpu-load'] ?? 0) ?>%"></span></div><span data-k="cpu"><?= (int)($res['cpu-load'] ?? 0) ?></span> %</td></tr>
      <tr><th>Mémoire</th><td><div class="bar"><span style="width:<?= $memPct ?>%"></span></div><span data-k="mem"><?= h(mk_bytes($memUsed) . ' / ' . mk_bytes($res['total-memory'] ?? 0)) ?></span></td></tr>
      <tr><th>Stockage</th><td><div class="bar"><span style="width:<?= $hddPct ?>%"></span></div><?= h(mk_bytes($res['free-hdd-space'] ?? 0)) ?> libres</td></tr>
    </table>
  </div>
  <div class="card">
    <div class="card-head"><h3>Trafic</h3>
      <select id="trafficIface" class="input-sm"><?= select_options($ifaces, $r['iface']) ?></select></div>
    <canvas id="trafficChart" height="170" data-src="<?= h(url('ajax', ['a' => 'traffic'])) ?>" data-reload="<?= (int)$r['reload'] ?>"></canvas>
    <div class="legend"><span class="rx">▼ Rx <b id="rxNow">–</b></span><span class="tx">▲ Tx <b id="txNow">–</b></span></div>
  </div>
</div>

<div class="grid-2">
  <div class="card">
    <div class="card-head"><h3>Revenus des 14 derniers jours</h3><a href="<?= h(url('reports')) ?>">rapport</a></div>
    <div class="bars">
      <?php foreach ($days as $d => $v): ?>
        <div class="bar-col" title="<?= h(date('d/m', strtotime($d)) . ' : ' . money($v)) ?>">
          <span style="height:<?= round($v / $maxDay * 100) ?>%"></span><small><?= h(date('d', strtotime($d))) ?></small>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
  <div class="card">
    <div class="card-head"><h3>Journal hotspot</h3><a href="<?= h(url('log')) ?>">tout voir</a></div>
    <?php if (!$logs): ?><p class="muted">Aucune entrée.</p><?php endif; ?>
    <ul class="log-list">
      <?php foreach ($logs as $l): ?>
        <li class="<?= str_contains($l['message'] ?? '', 'failed') ? 'bad' : '' ?>"><time><?= h($l['time'] ?? '') ?></time> <?= h($l['message'] ?? '') ?></li>
      <?php endforeach; ?>
    </ul>
  </div>
</div>

<div class="card">
  <div class="card-head"><h3>Dernières ventes</h3><a href="<?= h(url('reports')) ?>">rapport complet</a></div>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Date</th><th>Utilisateur</th><th>Profil</th><th>Validité</th><th class="num">Prix</th></tr></thead>
    <tbody>
    <?php foreach (array_slice($sales, 0, 6) as $s): ?>
      <tr><td><?= h($s['date'] . ' ' . $s['time']) ?></td><td><?= h($s['user']) ?></td><td><?= h($s['profile']) ?></td><td><?= h(mk_duration($s['validity'])) ?></td><td class="num"><?= h(money($s['price'])) ?></td></tr>
    <?php endforeach; ?>
    <?php if (!$sales): ?><tr><td colspan="5" class="muted">Aucune vente enregistrée.</td></tr><?php endif; ?>
    </tbody>
  </table></div>
</div>
