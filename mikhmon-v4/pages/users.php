<?php
/** Utilisateurs hotspot : liste, filtres, ajout/modification, actions groupées. */

$title = 'Utilisateurs hotspot';
$api = api();
$M = '/ip/hotspot/user';

if (is_post()) {
    csrf_check();
    $action = post('action');
    $back = post('back') ?: url('users');
    $ids = array_filter(array_map('strval', (array)($_POST['ids'] ?? [])), fn($i) => preg_match('/^\*[0-9A-F]+$/i', $i));
    if (post('id') !== '') {
        $ids[] = post('id');
    }
    try {
        switch ($action) {
            case 'remove':
            case 'enable':
            case 'disable':
            case 'reset-counters':
                if ($ids) {
                    $api->comm("$M/$action", ['.id' => implode(',', $ids)]);
                    flash('ok', count($ids) . ' utilisateur(s) : action effectuée.');
                }
                break;
            case 'remove-batch':
                $comment = post('comment');
                if ($comment !== '') {
                    $rows = array_filter($api->comm("$M/print", ['.proplist' => '.id,comment']), fn($u) => mk_batch($u['comment'] ?? '') === $comment);
                    if ($rows) {
                        $api->comm("$M/remove", ['.id' => implode(',', array_column($rows, '.id'))]);
                    }
                    flash('ok', count($rows) . " utilisateur(s) du lot « $comment » supprimé(s).");
                }
                $back = url('users');
                break;
            case 'save':
                $data = [
                    'server' => post('server', 'all') ?: 'all',
                    'name' => post('name'),
                    'password' => post('password'),
                    'profile' => post('profile', 'default'),
                    'mac-address' => post('mac'),
                    'limit-uptime' => post('limit_uptime'),
                    'limit-bytes-total' => mk_parse_size(post('limit_bytes')),
                    'comment' => post('comment'),
                    'disabled' => post('disabled') === '1' ? 'yes' : 'no',
                ];
                if ($data['name'] === '') {
                    throw new RouterOSException('Le nom d\'utilisateur est obligatoire.');
                }
                if ($data['limit-uptime'] !== '' && !mk_valid_duration($data['limit-uptime'])) {
                    throw new RouterOSException('Limite de temps invalide (ex : 1h, 1d, 30m).');
                }
                if ($data['mac-address'] !== '' && !preg_match('/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i', $data['mac-address'])) {
                    throw new RouterOSException('Adresse MAC invalide.');
                }
                $id = post('uid');
                $unset = [];
                foreach (['mac-address', 'limit-uptime', 'limit-bytes-total'] as $k) {
                    if ($data[$k] === '') {
                        unset($data[$k]);
                        $unset[] = $k;
                    }
                }
                if ($id) {
                    $api->comm("$M/set", ['.id' => $id] + $data);
                    foreach ($unset as $k) {
                        $api->comm("$M/unset", ['numbers' => $id, 'value-name' => $k]);
                    }
                    flash('ok', "Utilisateur « {$data['name']} » modifié.");
                } else {
                    $api->comm("$M/add", $data);
                    flash('ok', "Utilisateur « {$data['name']} » créé.");
                }
                $back = url('users');
                break;
        }
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
    }
    redirect($back);
}

$profiles = hs_profile_names();

// ------------------------------------------------------------------ formulaire
$edit = get('edit');
if ($edit !== '') {
    $u = ['.id' => '', 'server' => 'all', 'name' => '', 'password' => '', 'profile' => 'default', 'mac-address' => '', 'limit-uptime' => '', 'limit-bytes-total' => '', 'comment' => '', 'disabled' => 'false'];
    if ($edit !== 'new') {
        $u = ($api->comm("$M/print", ['?.id' => $edit])[0] ?? null) ?? $u;
    }
    $title = $u['.id'] ? 'Modifier « ' . $u['name'] . ' »' : 'Ajouter un utilisateur';
    $servers = array_merge(['all'], hs_server_names());
    $lb = $u['limit-bytes-total'] ?? '';
    if ($lb !== '' && (int)$lb > 0) {
        $lb = (int)$lb % (1024 ** 3) === 0 ? ((int)$lb / 1024 ** 3) . 'G' : ((int)$lb % (1024 ** 2) === 0 ? ((int)$lb / 1024 ** 2) . 'M' : $lb);
    }
    ?>
<div class="card narrow">
  <form method="post" class="form grid2">
    <?= csrf_field() ?><input type="hidden" name="action" value="save"><input type="hidden" name="uid" value="<?= h($u['.id']) ?>">
    <label>Serveur<select name="server"><?= select_options($servers, $u['server'] ?? 'all') ?></select></label>
    <label>Profil<select name="profile"><?= select_options($profiles, $u['profile'] ?? 'default') ?></select></label>
    <label>Nom d'utilisateur<input name="name" required value="<?= h($u['name']) ?>"></label>
    <label>Mot de passe<input name="password" value="<?= h($u['password'] ?? '') ?>"></label>
    <label>Limite de temps<input name="limit_uptime" value="<?= h($u['limit-uptime'] ?? '') ?>" placeholder="ex : 2h, 1d"></label>
    <label>Limite de données<input name="limit_bytes" value="<?= h($lb) ?>" placeholder="ex : 500M, 2G"></label>
    <label>Adresse MAC<input name="mac" value="<?= h($u['mac-address'] ?? '') ?>" placeholder="optionnel"></label>
    <label>Commentaire<input name="comment" value="<?= h($u['comment'] ?? '') ?>"></label>
    <label class="check span2"><input type="checkbox" name="disabled" value="1" <?= ($u['disabled'] ?? '') === 'true' ? 'checked' : '' ?>> Désactivé</label>
    <div class="span2 actions">
      <button class="btn btn-primary">Enregistrer</button>
      <a class="btn btn-ghost" href="<?= h(url('users')) ?>">Annuler</a>
      <?php if ($u['.id']): ?><a class="btn" href="<?= h(url('print', ['user' => $u['name']])) ?>" target="_blank">Imprimer le voucher</a><?php endif; ?>
    </div>
  </form>
</div>
    <?php
    return;
}

// ------------------------------------------------------------------ liste
$fProfile = get('profile');
$fComment = get('comment');
$q = mb_strtolower(get('q'));
$query = $fProfile !== '' ? ['?profile' => $fProfile] : [];
$all = $api->comm("$M/print", $query);
$batches = [];
foreach ($all as $row) {
    $b = mk_batch($row['comment'] ?? '');
    if (preg_match('/^(vc|up)-/', $b)) {
        $batches[$b] = ($batches[$b] ?? 0) + 1;
    }
}
krsort($batches);
$users = array_values(array_filter($all, fn($u) => ($fComment === '' || mk_batch($u['comment'] ?? '') === $fComment)
    && ($q === '' || str_contains(mb_strtolower(($u['name'] ?? '') . ' ' . ($u['comment'] ?? '')), $q))));
$active = array_column($api->comm('/ip/hotspot/active/print', ['.proplist' => 'user']), 'user', 'user');
$self = url('users', array_filter(['profile' => $fProfile, 'comment' => $fComment, 'q' => get('q')]));
?>
<form class="toolbar" method="get">
  <input type="hidden" name="p" value="users">
  <input name="q" value="<?= h(get('q')) ?>" placeholder="Rechercher…" class="input-sm">
  <select name="profile" class="input-sm" onchange="this.form.submit()"><option value="">Tous les profils</option><?= select_options($profiles, $fProfile) ?></select>
  <select name="comment" class="input-sm" onchange="this.form.submit()"><option value="">Tous les lots</option>
    <?php foreach ($batches as $c => $n): ?><option value="<?= h($c) ?>" <?= $c === $fComment ? 'selected' : '' ?>><?= h("$c ($n)") ?></option><?php endforeach; ?>
  </select>
  <button class="btn btn-sm">Filtrer</button>
  <span class="spacer"></span>
  <a class="btn btn-primary btn-sm" href="<?= h(url('users', ['edit' => 'new'])) ?>">+ Ajouter</a>
  <a class="btn btn-sm" href="<?= h(url('generate')) ?>">Générer</a>
</form>

<?php if ($fComment !== ''): ?>
<div class="card batch-bar">
  <span>Lot <strong><?= h($fComment) ?></strong> — <?= count($users) ?> utilisateur(s)</span>
  <a class="btn btn-sm btn-primary" target="_blank" href="<?= h(url('print', ['comment' => $fComment])) ?>">⎙ Imprimer</a>
  <a class="btn btn-sm" target="_blank" href="<?= h(url('print', ['comment' => $fComment, 'tpl' => 'small'])) ?>">⎙ Petit format</a>
  <a class="btn btn-sm" target="_blank" href="<?= h(url('print', ['comment' => $fComment, 'tpl' => 'thermal'])) ?>">⎙ Ticket thermique</a>
  <?= post_button(url('users'), ['action' => 'remove-batch', 'comment' => $fComment], 'Supprimer le lot', 'btn btn-sm btn-danger', "Supprimer tous les utilisateurs du lot $fComment ?") ?>
</div>
<?php endif; ?>

<form method="post" id="bulk" data-confirm-remove="Supprimer les utilisateurs sélectionnés ?">
  <?= csrf_field() ?><input type="hidden" name="back" value="<?= h($self) ?>">
  <div class="toolbar">
    <span class="muted small"><?= count($users) ?> utilisateur(s)</span><span class="spacer"></span>
    <button class="btn btn-sm" name="action" value="enable">Activer</button>
    <button class="btn btn-sm" name="action" value="disable">Désactiver</button>
    <button class="btn btn-sm" name="action" value="reset-counters">Réinitialiser compteurs</button>
    <button class="btn btn-sm btn-danger" name="action" value="remove">Supprimer</button>
  </div>
  <div class="table-wrap"><table class="table" data-sortable>
    <thead><tr><th><input type="checkbox" data-check-all></th><th>Nom</th><th>Mot de passe</th><th>Profil</th><th>Uptime</th><th class="num">Données ↓/↑</th><th>Limites</th><th>Commentaire</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($users as $u):
        $dis = ($u['disabled'] ?? '') === 'true'; ?>
      <tr class="<?= $dis ? 'disabled' : '' ?>">
        <td><input type="checkbox" name="ids[]" value="<?= h($u['.id']) ?>"></td>
        <td><a href="<?= h(url('users', ['edit' => $u['.id']])) ?>"><strong><?= h($u['name']) ?></strong></a>
          <?= isset($active[$u['name']]) ? '<span class="tag ok">en ligne</span>' : '' ?><?= $dis ? '<span class="tag">désactivé</span>' : '' ?></td>
        <td><span class="secret" data-secret="<?= h($u['password'] ?? '') ?>">••••</span></td>
        <td><?= h($u['profile'] ?? '') ?></td>
        <td><?= h(mk_duration($u['uptime'] ?? '')) ?></td>
        <td class="num"><?= h(mk_bytes($u['bytes-out'] ?? 0)) ?> / <?= h(mk_bytes($u['bytes-in'] ?? 0)) ?></td>
        <td class="small"><?= h(mk_duration($u['limit-uptime'] ?? '')) ?><?= !empty($u['limit-bytes-total']) ? ' ' . h(mk_bytes($u['limit-bytes-total'])) : '' ?></td>
        <td class="small"><?= h($u['comment'] ?? '') ?></td>
        <td class="row-actions">
          <a class="btn btn-xs" title="Imprimer" target="_blank" href="<?= h(url('print', ['user' => $u['name']])) ?>">⎙</a>
          <a class="btn btn-xs" title="Modifier" href="<?= h(url('users', ['edit' => $u['.id']])) ?>">✎</a>
        </td>
      </tr>
    <?php endforeach; ?>
    <?php if (!$users): ?><tr><td colspan="9" class="muted">Aucun utilisateur.</td></tr><?php endif; ?>
    </tbody>
  </table></div>
</form>
