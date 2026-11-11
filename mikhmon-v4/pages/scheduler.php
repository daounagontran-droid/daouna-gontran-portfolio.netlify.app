<?php
/** Planificateur RouterOS (dont les expirations "exp-<user>" créées par Mikhmon). */

$title = 'Planificateur';
$api = api();
$M = '/system/scheduler';

if (is_post()) {
    csrf_check();
    try {
        if (in_array(post('action'), ['remove', 'enable', 'disable'], true)) {
            $api->comm("$M/" . post('action'), ['.id' => post('id')]);
            flash('ok', 'Action effectuée.');
        }
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect(url('scheduler', array_filter(['f' => get('f')])));
}

$f = get('f');
$rows = $api->comm("$M/print");
$exp = array_filter($rows, fn($s) => str_starts_with($s['name'] ?? '', 'exp-'));
if ($f === 'exp') {
    $rows = $exp;
} elseif ($f === 'other') {
    $rows = array_filter($rows, fn($s) => !str_starts_with($s['name'] ?? '', 'exp-'));
}
?>
<div class="toolbar">
  <a class="btn btn-sm <?= $f === '' ? 'btn-primary' : '' ?>" href="<?= h(url('scheduler')) ?>">Tout</a>
  <a class="btn btn-sm <?= $f === 'exp' ? 'btn-primary' : '' ?>" href="<?= h(url('scheduler', ['f' => 'exp'])) ?>">Expirations vouchers (<?= count($exp) ?>)</a>
  <a class="btn btn-sm <?= $f === 'other' ? 'btn-primary' : '' ?>" href="<?= h(url('scheduler', ['f' => 'other'])) ?>">Autres</a>
</div>
<div class="table-wrap"><table class="table" data-sortable>
  <thead><tr><th>Nom</th><th>Intervalle</th><th>Prochaine exécution</th><th>Exécutions</th><th>Commentaire</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $s): $dis = ($s['disabled'] ?? '') === 'true'; ?>
    <tr class="<?= $dis ? 'disabled' : '' ?>"><td><strong><?= h($s['name'] ?? '') ?></strong></td><td><?= h(mk_duration($s['interval'] ?? '')) ?></td>
      <td><?= h($s['next-run'] ?? '') ?></td><td><?= h($s['run-count'] ?? '') ?></td><td><?= h($s['comment'] ?? '') ?></td>
      <td class="row-actions">
        <?= post_button(url('scheduler', array_filter(['f' => $f])), ['action' => $dis ? 'enable' : 'disable', 'id' => $s['.id']], $dis ? 'Activer' : 'Désactiver', 'btn btn-xs') ?>
        <?= post_button(url('scheduler', array_filter(['f' => $f])), ['action' => 'remove', 'id' => $s['.id']], '✕', 'btn btn-xs btn-danger', 'Supprimer cette tâche ?') ?>
      </td></tr>
  <?php endforeach; ?>
  <?php if (!$rows): ?><tr><td colspan="6" class="muted">Aucune tâche.</td></tr><?php endif; ?>
  </tbody>
</table></div>
