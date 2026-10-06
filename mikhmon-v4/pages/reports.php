<?php
/** Rapport des ventes : filtres par période, totaux, export CSV, suppression. */

$title = 'Rapport des ventes';
$api = api();

if (is_post()) {
    csrf_check();
    try {
        $ids = array_filter((array)($_POST['ids'] ?? []), fn($i) => is_string($i) && preg_match('/^\*[0-9A-F]+$/i', $i));
        if ($ids) {
            // Par paquets pour ne pas dépasser la taille d'une commande.
            foreach (array_chunk($ids, 200) as $chunk) {
                $api->comm('/system/script/remove', ['.id' => implode(',', $chunk)]);
            }
            flash('ok', count($ids) . ' enregistrement(s) supprimé(s).');
        }
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect(post('back') ?: url('reports'));
}

$from = get('from') ?: date('Y-m-01');
$to = get('to') ?: date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
    $from = date('Y-m-01');
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
    $to = date('Y-m-d');
}
$fProfile = get('profile');
$q = mb_strtolower(get('q'));

$all = mk_sales($api);
$sales = array_values(array_filter($all, fn($s) => $s['date'] >= $from && $s['date'] <= $to
    && ($fProfile === '' || $s['profile'] === $fProfile)
    && ($q === '' || str_contains(mb_strtolower($s['user'] . ' ' . $s['comment'] . ' ' . $s['mac']), $q))));

if (get('export') === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="ventes_' . $from . '_' . $to . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Date', 'Heure', 'Utilisateur', 'Profil', 'Validité', 'Prix', 'IP', 'MAC', 'Commentaire'], ';');
    foreach ($sales as $s) {
        fputcsv($out, [$s['date'], $s['time'], $s['user'], $s['profile'], $s['validity'], $s['price'], $s['ip'], $s['mac'], $s['comment']], ';');
    }
    fclose($out);
    exit;
}

$total = array_sum(array_column($sales, 'price'));
$byProfile = [];
$byDay = [];
foreach ($sales as $s) {
    $byProfile[$s['profile']] = [($byProfile[$s['profile']][0] ?? 0) + 1, ($byProfile[$s['profile']][1] ?? 0) + $s['price']];
    $byDay[$s['date']] = ($byDay[$s['date']] ?? 0) + $s['price'];
}
arsort($byProfile);
ksort($byDay);
$maxDay = max(1, $byDay ? max($byDay) : 1);
$profiles = array_unique(array_column($all, 'profile'));
sort($profiles);
$params = array_filter(['from' => $from, 'to' => $to, 'profile' => $fProfile, 'q' => get('q')]);
$presets = [
    "Aujourd'hui" => [date('Y-m-d'), date('Y-m-d')],
    'Hier' => [date('Y-m-d', strtotime('-1 day')), date('Y-m-d', strtotime('-1 day'))],
    '7 jours' => [date('Y-m-d', strtotime('-6 days')), date('Y-m-d')],
    'Ce mois' => [date('Y-m-01'), date('Y-m-d')],
    'Mois dernier' => [date('Y-m-01', strtotime('first day of last month')), date('Y-m-t', strtotime('first day of last month'))],
    'Cette année' => [date('Y-01-01'), date('Y-m-d')],
];
?>
<form class="toolbar" method="get">
  <input type="hidden" name="p" value="reports">
  <label class="inline-label">Du <input type="date" name="from" value="<?= h($from) ?>" class="input-sm"></label>
  <label class="inline-label">au <input type="date" name="to" value="<?= h($to) ?>" class="input-sm"></label>
  <select name="profile" class="input-sm"><option value="">Tous les profils</option><?= select_options($profiles, $fProfile) ?></select>
  <input name="q" value="<?= h(get('q')) ?>" placeholder="Utilisateur, MAC…" class="input-sm">
  <button class="btn btn-sm btn-primary">Afficher</button>
  <span class="spacer"></span>
  <a class="btn btn-sm" href="<?= h(url('reports', $params + ['export' => 'csv'])) ?>">⇩ Export CSV</a>
  <button class="btn btn-sm" type="button" onclick="window.print()">⎙ Imprimer</button>
</form>
<div class="toolbar presets">
  <?php foreach ($presets as $lbl => [$f, $t]): ?>
    <a class="chip <?= $f === $from && $t === $to ? 'on' : '' ?>" href="<?= h(url('reports', ['from' => $f, 'to' => $t] + array_filter(['profile' => $fProfile]))) ?>"><?= h($lbl) ?></a>
  <?php endforeach; ?>
</div>

<div class="stats">
  <?= stat_card('Total des ventes', h(money($total)), h(date('d/m/Y', strtotime($from)) . ' → ' . date('d/m/Y', strtotime($to))), 'orange') ?>
  <?= stat_card('Vouchers vendus', (string)count($sales), '', 'green') ?>
  <?= stat_card('Moyenne par jour', h(money($byDay ? $total / max(1, (strtotime($to) - strtotime($from)) / 86400 + 1) : 0)), '', 'blue') ?>
</div>

<div class="grid-2">
  <div class="card">
    <h3>Par jour</h3>
    <div class="bars">
      <?php foreach (array_slice($byDay, -31, null, true) as $d => $v): ?>
        <div class="bar-col" title="<?= h(date('d/m', strtotime($d)) . ' : ' . money($v)) ?>"><span style="height:<?= round($v / $maxDay * 100) ?>%"></span><small><?= h(date('d', strtotime($d))) ?></small></div>
      <?php endforeach; ?>
      <?php if (!$byDay): ?><p class="muted">Aucune donnée.</p><?php endif; ?>
    </div>
  </div>
  <div class="card">
    <h3>Par profil</h3>
    <table class="table compact">
      <thead><tr><th>Profil</th><th class="num">Ventes</th><th class="num">Montant</th></tr></thead>
      <tbody>
      <?php foreach ($byProfile as $p => [$n, $v]): ?>
        <tr><td><?= h($p) ?></td><td class="num"><?= $n ?></td><td class="num"><?= h(money($v)) ?></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<form method="post" data-confirm="Supprimer définitivement les enregistrements sélectionnés ?">
  <?= csrf_field() ?><input type="hidden" name="back" value="<?= h(url('reports', $params)) ?>">
  <div class="toolbar"><span class="muted small"><?= count($sales) ?> vente(s)</span><span class="spacer"></span>
    <button class="btn btn-sm btn-danger">Supprimer la sélection</button></div>
  <div class="table-wrap"><table class="table" data-sortable>
    <thead><tr><th><input type="checkbox" data-check-all></th><th>Date</th><th>Heure</th><th>Utilisateur</th><th>Profil</th><th>Validité</th><th>IP</th><th>MAC</th><th>Lot</th><th class="num">Prix</th></tr></thead>
    <tbody>
    <?php foreach ($sales as $s): ?>
      <tr><td><input type="checkbox" name="ids[]" value="<?= h($s['id']) ?>"></td>
        <td><?= h(date('d/m/Y', strtotime($s['date']))) ?></td><td><?= h($s['time']) ?></td><td><strong><?= h($s['user']) ?></strong></td>
        <td><?= h($s['profile']) ?></td><td><?= h(mk_duration($s['validity'])) ?></td><td><?= h($s['ip']) ?></td><td class="mono"><?= h($s['mac']) ?></td>
        <td class="small"><?= h($s['comment']) ?></td><td class="num"><?= h(money($s['price'])) ?></td></tr>
    <?php endforeach; ?>
    <?php if (!$sales): ?><tr><td colspan="10" class="muted">Aucune vente sur cette période.</td></tr><?php endif; ?>
    </tbody>
    <tfoot><tr><th colspan="9">Total</th><th class="num"><?= h(money($total)) ?></th></tr></tfoot>
  </table></div>
</form>
