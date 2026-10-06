<?php
/** Trafic en direct d'une interface. */

$title = 'Trafic en direct';
$api = api();
$r = router();
$ifaces = $api->comm('/interface/print', ['.proplist' => 'name,type,running,disabled']);
$sel = get('iface') ?: $r['iface'];
?>
<div class="toolbar">
  <form method="get" class="inline"><input type="hidden" name="p" value="traffic">
    <select name="iface" class="input-sm" onchange="this.form.submit()">
      <?php foreach ($ifaces as $i): ?><option value="<?= h($i['name']) ?>" <?= $i['name'] === $sel ? 'selected' : '' ?>><?= h($i['name'] . ' (' . ($i['type'] ?? '') . ')' . (($i['running'] ?? '') === 'true' ? '' : ' – inactif')) ?></option><?php endforeach; ?>
    </select></form>
</div>
<div class="card">
  <canvas id="trafficChart" height="320" data-src="<?= h(url('ajax', ['a' => 'traffic', 'iface' => $sel])) ?>" data-reload="2"></canvas>
  <div class="legend"><span class="rx">▼ Rx <b id="rxNow">–</b></span><span class="tx">▲ Tx <b id="txNow">–</b></span></div>
</div>
<div class="table-wrap"><table class="table">
  <thead><tr><th>Interface</th><th>Type</th><th>État</th></tr></thead>
  <tbody><?php foreach ($ifaces as $i): ?>
    <tr><td><a href="<?= h(url('traffic', ['iface' => $i['name']])) ?>"><?= h($i['name']) ?></a></td><td><?= h($i['type'] ?? '') ?></td>
      <td><?= ($i['disabled'] ?? '') === 'true' ? '<span class="tag">désactivée</span>' : (($i['running'] ?? '') === 'true' ? '<span class="tag ok">active</span>' : '<span class="tag bad">déconnectée</span>') ?></td></tr>
  <?php endforeach; ?></tbody>
</table></div>
