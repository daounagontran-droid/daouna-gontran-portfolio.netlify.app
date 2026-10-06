<?php
/** Hôtes hotspot (appareils détectés). */

$title = 'Hôtes';
$api = api();

if (is_post()) {
    csrf_check();
    try {
        if (post('action') === 'remove') {
            $api->comm('/ip/hotspot/host/remove', ['.id' => post('id')]);
            flash('ok', 'Hôte supprimé.');
        } elseif (in_array(post('action'), ['bypassed', 'blocked', 'regular'], true)) {
            $api->comm('/ip/hotspot/host/make-binding', ['.id' => post('id'), 'type' => post('action')]);
            flash('ok', 'IP binding créé (' . post('action') . ').');
        }
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect(url('hosts', array_filter(['f' => get('f')])));
}

$f = get('f');
$rows = $api->comm('/ip/hotspot/host/print');
$rows = array_filter($rows, fn($r) => $f === '' || ($f === 'auth' ? ($r['authorized'] ?? '') === 'true' : ($r['authorized'] ?? '') !== 'true'));
?>
<div class="toolbar">
  <a class="btn btn-sm <?= $f === '' ? 'btn-primary' : '' ?>" href="<?= h(url('hosts')) ?>">Tous</a>
  <a class="btn btn-sm <?= $f === 'auth' ? 'btn-primary' : '' ?>" href="<?= h(url('hosts', ['f' => 'auth'])) ?>">Authentifiés</a>
  <a class="btn btn-sm <?= $f === 'unauth' ? 'btn-primary' : '' ?>" href="<?= h(url('hosts', ['f' => 'unauth'])) ?>">Non authentifiés</a>
  <span class="spacer"></span><span class="muted"><?= count($rows) ?> hôte(s)</span>
</div>
<div class="table-wrap"><table class="table" data-sortable>
  <thead><tr><th>MAC</th><th>Adresse</th><th>Vers</th><th>Serveur</th><th>Authentifié</th><th>Bypass</th><th>Uptime</th><th>Inactif</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $r): ?>
    <tr>
      <td class="mono"><?= h($r['mac-address'] ?? '') ?></td><td><?= h($r['address'] ?? '') ?></td><td><?= h($r['to-address'] ?? '') ?></td>
      <td><?= h($r['server'] ?? '') ?></td><td><?= yesno($r['authorized'] ?? '') ?></td><td><?= yesno($r['bypassed'] ?? '') ?></td>
      <td><?= h(mk_duration($r['uptime'] ?? '')) ?></td><td><?= h(mk_duration($r['idle-time'] ?? '')) ?></td>
      <td class="row-actions">
        <?= post_button(url('hosts'), ['action' => 'bypassed', 'id' => $r['.id']], 'Bypass', 'btn btn-xs', 'Autoriser cet appareil sans connexion ?') ?>
        <?= post_button(url('hosts'), ['action' => 'blocked', 'id' => $r['.id']], 'Bloquer', 'btn btn-xs', 'Bloquer cet appareil ?') ?>
        <?= post_button(url('hosts'), ['action' => 'remove', 'id' => $r['.id']], '✕', 'btn btn-xs btn-danger', 'Supprimer cet hôte ?') ?>
      </td>
    </tr>
  <?php endforeach; ?>
  <?php if (!$rows): ?><tr><td colspan="9" class="muted">Aucun hôte.</td></tr><?php endif; ?>
  </tbody>
</table></div>
