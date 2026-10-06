<?php
/** IP bindings hotspot (bypass / blocage / normal). */

$title = 'IP Bindings';
$api = api();
$M = '/ip/hotspot/ip-binding';

if (is_post()) {
    csrf_check();
    try {
        switch (post('action')) {
            case 'add':
                $data = array_filter([
                    'mac-address' => post('mac'), 'address' => post('address'), 'to-address' => post('to'),
                    'server' => post('server', 'all'), 'type' => post('type', 'regular'), 'comment' => post('comment'),
                ], fn($v) => $v !== '');
                if (empty($data['mac-address']) && empty($data['address'])) {
                    throw new RouterOSException('Indiquez une adresse MAC ou une adresse IP.');
                }
                $api->comm("$M/add", $data);
                flash('ok', 'IP binding ajouté.');
                break;
            case 'remove':
            case 'enable':
            case 'disable':
                $api->comm("$M/" . post('action'), ['.id' => post('id')]);
                flash('ok', 'Action effectuée.');
                break;
        }
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect(url('bindings'));
}

$rows = $api->comm("$M/print");
$servers = array_merge(['all'], hs_server_names());
$types = ['regular' => 'Normal', 'bypassed' => 'Bypass (sans connexion)', 'blocked' => 'Bloqué'];
?>
<details class="card"><summary><strong>+ Ajouter un IP binding</strong></summary>
  <form method="post" class="form grid3">
    <?= csrf_field() ?><input type="hidden" name="action" value="add">
    <label>Adresse MAC<input name="mac" placeholder="AA:BB:CC:DD:EE:FF"></label>
    <label>Adresse IP<input name="address" placeholder="10.5.50.20"></label>
    <label>Vers l'adresse<input name="to" placeholder="optionnel"></label>
    <label>Serveur<select name="server"><?= select_options($servers, 'all') ?></select></label>
    <label>Type<select name="type"><?= select_options($types, 'bypassed', true) ?></select></label>
    <label>Commentaire<input name="comment"></label>
    <div class="actions span3"><button class="btn btn-primary">Ajouter</button></div>
  </form>
</details>
<div class="table-wrap"><table class="table" data-sortable>
  <thead><tr><th>MAC</th><th>Adresse</th><th>Vers</th><th>Serveur</th><th>Type</th><th>Commentaire</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $r): $dis = ($r['disabled'] ?? '') === 'true'; ?>
    <tr class="<?= $dis ? 'disabled' : '' ?>">
      <td class="mono"><?= h($r['mac-address'] ?? '') ?></td><td><?= h($r['address'] ?? '') ?></td><td><?= h($r['to-address'] ?? '') ?></td>
      <td><?= h($r['server'] ?? '') ?></td><td><span class="tag <?= ($r['type'] ?? '') === 'blocked' ? 'bad' : (($r['type'] ?? '') === 'bypassed' ? 'ok' : '') ?>"><?= h($types[$r['type'] ?? 'regular'] ?? $r['type']) ?></span></td>
      <td><?= h($r['comment'] ?? '') ?></td>
      <td class="row-actions">
        <?= post_button(url('bindings'), ['action' => $dis ? 'enable' : 'disable', 'id' => $r['.id']], $dis ? 'Activer' : 'Désactiver', 'btn btn-xs') ?>
        <?= post_button(url('bindings'), ['action' => 'remove', 'id' => $r['.id']], '✕', 'btn btn-xs btn-danger', 'Supprimer ce binding ?') ?>
      </td>
    </tr>
  <?php endforeach; ?>
  <?php if (!$rows): ?><tr><td colspan="7" class="muted">Aucun IP binding.</td></tr><?php endif; ?>
  </tbody>
</table></div>
