<?php
/** Cookies hotspot (connexions mémorisées). */

$title = 'Cookies';
$api = api();

if (is_post()) {
    csrf_check();
    try {
        $api->comm('/ip/hotspot/cookie/remove', ['.id' => post('id')]);
        flash('ok', 'Cookie supprimé.');
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect(url('cookies'));
}
$rows = $api->comm('/ip/hotspot/cookie/print');
?>
<div class="table-wrap"><table class="table" data-sortable>
  <thead><tr><th>Utilisateur</th><th>MAC</th><th>Domaine</th><th>Expire dans</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $r): ?>
    <tr><td><?= h($r['user'] ?? '') ?></td><td class="mono"><?= h($r['mac-address'] ?? '') ?></td><td><?= h($r['domain'] ?? '') ?></td>
      <td><?= h(mk_duration($r['expires-in'] ?? '')) ?></td>
      <td><?= post_button(url('cookies'), ['id' => $r['.id']], '✕', 'btn btn-xs btn-danger', 'Supprimer ce cookie ?') ?></td></tr>
  <?php endforeach; ?>
  <?php if (!$rows): ?><tr><td colspan="5" class="muted">Aucun cookie.</td></tr><?php endif; ?>
  </tbody>
</table></div>
