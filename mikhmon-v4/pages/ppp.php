<?php
/** PPP : secrets et connexions actives (PPPoE, L2TP…). */

$title = 'PPP';
$api = api();

if (is_post()) {
    csrf_check();
    try {
        switch (post('action')) {
            case 'add':
                if (post('name') === '') {
                    throw new RouterOSException('Nom requis.');
                }
                $api->comm('/ppp/secret/add', array_filter([
                    'name' => post('name'), 'password' => post('password'), 'service' => post('service', 'any'),
                    'profile' => post('profile', 'default'), 'remote-address' => post('remote'), 'comment' => post('comment'),
                ], fn($v) => $v !== ''));
                flash('ok', 'Secret PPP ajouté.');
                break;
            case 'remove':
            case 'enable':
            case 'disable':
                $api->comm('/ppp/secret/' . post('action'), ['.id' => post('id')]);
                flash('ok', 'Action effectuée.');
                break;
            case 'kick':
                $api->comm('/ppp/active/remove', ['.id' => post('id')]);
                flash('ok', 'Connexion PPP coupée.');
                break;
        }
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect(url('ppp'));
}

$secrets = $api->comm('/ppp/secret/print');
$active = $api->comm('/ppp/active/print');
$online = array_column($active, 'name', 'name');
$profiles = array_column($api->comm('/ppp/profile/print', ['.proplist' => 'name']), 'name');
?>
<details class="card"><summary><strong>+ Ajouter un secret PPP</strong></summary>
  <form method="post" class="form grid3">
    <?= csrf_field() ?><input type="hidden" name="action" value="add">
    <label>Nom<input name="name" required></label>
    <label>Mot de passe<input name="password"></label>
    <label>Service<select name="service"><?= select_options(['any', 'pppoe', 'pptp', 'l2tp', 'ovpn', 'sstp'], 'pppoe') ?></select></label>
    <label>Profil<select name="profile"><?= select_options($profiles, 'default') ?></select></label>
    <label>Adresse distante<input name="remote" placeholder="optionnel"></label>
    <label>Commentaire<input name="comment"></label>
    <div class="actions span3"><button class="btn btn-primary">Ajouter</button></div>
  </form>
</details>

<div class="card"><h3>Connexions actives (<?= count($active) ?>)</h3>
<div class="table-wrap"><table class="table">
  <thead><tr><th>Nom</th><th>Service</th><th>Caller ID</th><th>Adresse</th><th>Uptime</th><th></th></tr></thead>
  <tbody><?php foreach ($active as $a): ?>
    <tr><td><strong><?= h($a['name'] ?? '') ?></strong></td><td><?= h($a['service'] ?? '') ?></td><td class="mono"><?= h($a['caller-id'] ?? '') ?></td>
      <td><?= h($a['address'] ?? '') ?></td><td><?= h(mk_duration($a['uptime'] ?? '')) ?></td>
      <td><?= post_button(url('ppp'), ['action' => 'kick', 'id' => $a['.id']], 'Couper', 'btn btn-xs btn-danger', 'Couper la connexion ?') ?></td></tr>
  <?php endforeach; ?>
  <?php if (!$active): ?><tr><td colspan="6" class="muted">Aucune connexion.</td></tr><?php endif; ?></tbody>
</table></div></div>

<div class="card"><h3>Secrets (<?= count($secrets) ?>)</h3>
<div class="table-wrap"><table class="table" data-sortable>
  <thead><tr><th>Nom</th><th>Mot de passe</th><th>Service</th><th>Profil</th><th>Adresse distante</th><th>Commentaire</th><th></th></tr></thead>
  <tbody><?php foreach ($secrets as $s): $dis = ($s['disabled'] ?? '') === 'true'; ?>
    <tr class="<?= $dis ? 'disabled' : '' ?>"><td><strong><?= h($s['name']) ?></strong> <?= isset($online[$s['name']]) ? '<span class="tag ok">en ligne</span>' : '' ?></td>
      <td><span class="secret" data-secret="<?= h($s['password'] ?? '') ?>">••••</span></td><td><?= h($s['service'] ?? '') ?></td>
      <td><?= h($s['profile'] ?? '') ?></td><td><?= h($s['remote-address'] ?? '') ?></td><td><?= h($s['comment'] ?? '') ?></td>
      <td class="row-actions">
        <?= post_button(url('ppp'), ['action' => $dis ? 'enable' : 'disable', 'id' => $s['.id']], $dis ? 'Activer' : 'Désactiver', 'btn btn-xs') ?>
        <?= post_button(url('ppp'), ['action' => 'remove', 'id' => $s['.id']], '✕', 'btn btn-xs btn-danger', 'Supprimer ce secret ?') ?>
      </td></tr>
  <?php endforeach; ?></tbody>
</table></div></div>
