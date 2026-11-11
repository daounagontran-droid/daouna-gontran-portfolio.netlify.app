<?php
/** Impression des vouchers : lots existants et impression rapide. */

$title = 'Imprimer des vouchers';
$api = api();

$batches = [];
foreach ($api->comm('/ip/hotspot/user/print', ['.proplist' => 'name,profile,comment,uptime']) as $u) {
    $b = mk_batch($u['comment'] ?? '');
    if (!preg_match('/^(vc|up)-/', $b)) {
        continue;
    }
    $batches[$b] ??= ['total' => 0, 'unused' => 0, 'profiles' => []];
    $batches[$b]['total']++;
    if (!str_contains($u['comment'] ?? '', '1st:') && in_array($u['uptime'] ?? '0s', ['0s', '', '00:00:00'], true)) {
        $batches[$b]['unused']++;
    }
    $batches[$b]['profiles'][$u['profile'] ?? ''] = true;
}
krsort($batches);
$profiles = hs_profile_names();
$tpls = ['default' => 'Standard (carte)', 'small' => 'Petit format', 'thermal' => 'Ticket thermique 58 mm'];
?>
<div class="grid-2">
  <div class="card">
    <h3>Impression rapide</h3>
    <p class="muted small">Génère un lot de codes uniques puis ouvre directement la page d'impression.</p>
    <form method="post" action="<?= h(url('generate')) ?>" class="form grid2">
      <?= csrf_field() ?><input type="hidden" name="then" value="print"><input type="hidden" name="mode" value="vc">
      <input type="hidden" name="charset" value="num"><input type="hidden" name="len" value="6">
      <label>Profil<select name="profile"><?= select_options($profiles, $profiles[1] ?? 'default') ?></select></label>
      <label>Quantité<input type="number" name="qty" min="1" max="200" value="12"></label>
      <label class="span2">Modèle<select name="tpl"><?= select_options($tpls, 'default', true) ?></select></label>
      <div class="span2 actions"><button class="btn btn-primary">Générer et imprimer</button></div>
    </form>
  </div>
  <div class="card">
    <h3>Imprimer un utilisateur</h3>
    <form method="get" action="index.php" target="_blank" class="form">
      <input type="hidden" name="p" value="print">
      <label>Nom d'utilisateur<input name="user" required></label>
      <label>Modèle<select name="tpl"><?= select_options($tpls, 'default', true) ?></select></label>
      <button class="btn">Imprimer</button>
    </form>
  </div>
</div>

<div class="card">
  <h3>Lots de vouchers</h3>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Lot</th><th>Profil(s)</th><th class="num">Total</th><th class="num">Non utilisés</th><th>Imprimer</th></tr></thead>
    <tbody>
    <?php foreach ($batches as $b => $info): ?>
      <tr>
        <td><a href="<?= h(url('users', ['comment' => $b])) ?>"><?= h($b) ?></a></td>
        <td><?= h(implode(', ', array_keys($info['profiles']))) ?></td>
        <td class="num"><?= $info['total'] ?></td>
        <td class="num"><?= $info['unused'] ?></td>
        <td class="row-actions">
          <?php foreach ($tpls as $k => $lbl): ?>
            <a class="btn btn-xs" target="_blank" href="<?= h(url('print', ['comment' => $b, 'tpl' => $k])) ?>"><?= h($lbl) ?></a>
          <?php endforeach; ?>
          <a class="btn btn-xs" target="_blank" href="<?= h(url('print', ['comment' => $b, 'unused' => 1])) ?>">Non utilisés</a>
        </td>
      </tr>
    <?php endforeach; ?>
    <?php if (!$batches): ?><tr><td colspan="5" class="muted">Aucun lot. <a href="<?= h(url('generate')) ?>">Générer des vouchers</a></td></tr><?php endif; ?>
    </tbody>
  </table></div>
</div>
