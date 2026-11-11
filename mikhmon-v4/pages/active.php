<?php
/** Sessions hotspot actives. */

$title = 'Sessions actives';
$api = api();

if (is_post()) {
    csrf_check();
    try {
        $api->comm('/ip/hotspot/active/remove', ['.id' => post('id')]);
        flash('ok', 'Session déconnectée.');
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect(url('active'));
}

$rows = $api->comm('/ip/hotspot/active/print');
?>
<div class="toolbar"><span class="muted"><?= count($rows) ?> session(s) active(s)</span><span class="spacer"></span><a class="btn btn-sm" href="<?= h(url('active')) ?>">↻ Actualiser</a></div>
<div class="table-wrap"><table class="table" data-sortable>
  <thead><tr><th>Serveur</th><th>Utilisateur</th><th>Adresse IP</th><th>MAC</th><th>Uptime</th><th>Temps restant</th><th class="num">Données ↓/↑</th><th>Connexion</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $a): ?>
    <tr>
      <td><?= h($a['server'] ?? '') ?></td>
      <td><strong><?= h($a['user'] ?? '') ?></strong></td>
      <td><?= h($a['address'] ?? '') ?></td>
      <td class="mono"><?= h($a['mac-address'] ?? '') ?></td>
      <td><?= h(mk_duration($a['uptime'] ?? '')) ?></td>
      <td><?= h(mk_duration($a['session-time-left'] ?? '')) ?></td>
      <td class="num"><?= h(mk_bytes($a['bytes-out'] ?? 0)) ?> / <?= h(mk_bytes($a['bytes-in'] ?? 0)) ?></td>
      <td><?= h($a['login-by'] ?? '') ?></td>
      <td><?= post_button(url('active'), ['id' => $a['.id']], 'Déconnecter', 'btn btn-xs btn-danger', 'Déconnecter ' . ($a['user'] ?? '') . ' ?') ?></td>
    </tr>
  <?php endforeach; ?>
  <?php if (!$rows): ?><tr><td colspan="9" class="muted">Aucune session active.</td></tr><?php endif; ?>
  </tbody>
</table></div>
