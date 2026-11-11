<?php
/** Baux DHCP. */

$title = 'Baux DHCP';
$api = api();

if (is_post()) {
    csrf_check();
    try {
        $action = post('action');
        if (in_array($action, ['remove', 'make-static'], true)) {
            $api->comm('/ip/dhcp-server/lease/' . $action, ['.id' => post('id')]);
            flash('ok', $action === 'remove' ? 'Bail supprimé.' : 'Bail rendu statique.');
        }
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect(url('dhcp'));
}
$rows = $api->comm('/ip/dhcp-server/lease/print');
?>
<div class="table-wrap"><table class="table" data-sortable>
  <thead><tr><th>Adresse</th><th>MAC</th><th>Nom d'hôte</th><th>Serveur</th><th>État</th><th>Expire</th><th>Commentaire</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $l): ?>
    <tr><td><?= h($l['address'] ?? '') ?></td><td class="mono"><?= h($l['mac-address'] ?? '') ?></td><td><?= h($l['host-name'] ?? '') ?></td>
      <td><?= h($l['server'] ?? '') ?></td><td><?= h($l['status'] ?? '') ?> <?= ($l['dynamic'] ?? '') === 'true' ? '<span class="tag">dynamique</span>' : '<span class="tag ok">statique</span>' ?></td>
      <td><?= h(mk_duration($l['expires-after'] ?? '')) ?></td><td><?= h($l['comment'] ?? '') ?></td>
      <td class="row-actions">
        <?php if (($l['dynamic'] ?? '') === 'true'): ?><?= post_button(url('dhcp'), ['action' => 'make-static', 'id' => $l['.id']], 'Statique', 'btn btn-xs') ?><?php endif; ?>
        <?= post_button(url('dhcp'), ['action' => 'remove', 'id' => $l['.id']], '✕', 'btn btn-xs btn-danger', 'Supprimer ce bail ?') ?>
      </td></tr>
  <?php endforeach; ?>
  <?php if (!$rows): ?><tr><td colspan="8" class="muted">Aucun bail DHCP.</td></tr><?php endif; ?>
  </tbody>
</table></div>
