<?php
/** Profils utilisateurs hotspot avec options Mikhmon (validité, prix, expiration, ventes). */

$title = 'Profils utilisateurs';
$api = api();
$M = '/ip/hotspot/user/profile';

if (is_post()) {
    csrf_check();
    try {
        if (post('action') === 'remove') {
            $api->comm("$M/remove", ['.id' => post('id')]);
            flash('ok', 'Profil supprimé.');
        } elseif (post('action') === 'save') {
            $name = post('name');
            if ($name === '' || preg_match('/[\s"\\\\]/', $name)) {
                throw new RouterOSException('Nom de profil invalide (pas d\'espaces ni de guillemets).');
            }
            $validity = post('validity');
            $mode = post('mode');
            if ($mode !== 'none' && !mk_valid_duration($validity)) {
                throw new RouterOSException('Une validité est requise pour l\'expiration (ex : 1h, 1d, 30d).');
            }
            $data = [
                'name' => $name,
                'shared-users' => (string)max(1, (int)post('shared', '1')),
                'address-pool' => post('pool', 'none') ?: 'none',
                'on-login' => mk_build_onlogin([
                    'mode' => $mode, 'validity' => $validity, 'price' => post('price', '0'), 'sprice' => post('sprice', '0'),
                    'lock' => post('lock') === '1', 'record' => post('record') === '1',
                ]),
            ];
            if (post('rate') !== '' && !preg_match('#^[0-9kKmMgG/ ]+$#', post('rate'))) {
                throw new RouterOSException('Limite de débit invalide (ex : 1M/2M).');
            }
            $id = post('pid');
            if ($id) {
                $api->comm("$M/set", ['.id' => $id] + $data + (post('rate') !== '' ? ['rate-limit' => post('rate')] : []));
                if (post('rate') === '') {
                    $api->comm("$M/unset", ['numbers' => $id, 'value-name' => 'rate-limit']);
                }
                flash('ok', "Profil « $name » modifié.");
            } else {
                $api->comm("$M/add", $data + (post('rate') !== '' ? ['rate-limit' => post('rate')] : []));
                flash('ok', "Profil « $name » créé.");
            }
        }
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
        redirect(url('profiles', post('action') === 'save' ? ['edit' => post('pid') ?: 'new'] : []));
    }
    redirect(url('profiles'));
}

$edit = get('edit');
if ($edit !== '') {
    $p = ['.id' => '', 'name' => '', 'shared-users' => '1', 'rate-limit' => '', 'address-pool' => 'none', 'on-login' => ''];
    if ($edit !== 'new') {
        $p = $api->comm("$M/print", ['?.id' => $edit])[0] ?? $p;
    }
    $o = mk_parse_onlogin($p['on-login'] ?? '');
    if ($edit === 'new') {
        $o['record'] = true;
        $o['mode'] = 'remove';
    }
    $pools = array_merge(['none'], array_column($api->comm('/ip/pool/print', ['.proplist' => 'name']), 'name'));
    $title = $p['.id'] ? 'Profil « ' . $p['name'] . ' »' : 'Nouveau profil';
    ?>
<?php if (!$o['managed'] && trim($p['on-login'] ?? '') !== ''): ?>
  <div class="alert alert-warn">Ce profil a un script on-login personnalisé : il sera remplacé par le script Mikhmon V4 à l'enregistrement.</div>
<?php elseif (!empty($o['v3'])): ?>
  <div class="alert alert-info">Profil créé par Mikhmon V3 : ses réglages ont été repris et seront convertis au format V4.</div>
<?php endif; ?>
<div class="card narrow">
  <form method="post" class="form grid2">
    <?= csrf_field() ?><input type="hidden" name="action" value="save"><input type="hidden" name="pid" value="<?= h($p['.id']) ?>">
    <h3 class="span2">RouterOS</h3>
    <label>Nom<input name="name" required value="<?= h($p['name']) ?>" placeholder="ex : 1Jour"></label>
    <label>Utilisateurs partagés<input type="number" min="1" name="shared" value="<?= h($p['shared-users'] ?? '1') ?>"><small>Appareils simultanés par compte</small></label>
    <label>Limite de débit (rx/tx)<input name="rate" value="<?= h($p['rate-limit'] ?? '') ?>" placeholder="ex : 1M/2M"></label>
    <label>Pool d'adresses<select name="pool"><?= select_options($pools, $p['address-pool'] ?? 'none') ?></select></label>
    <h3 class="span2">Mikhmon</h3>
    <label>Expiration<select name="mode"><?= select_options(MK_EXPIRE_MODES, $o['mode'], true) ?></select></label>
    <label>Validité<input name="validity" value="<?= h($o['validity']) ?>" placeholder="ex : 1h, 1d, 7d, 30d"><small>Décomptée dès la première connexion</small></label>
    <label>Prix (revenu)<input type="number" step="any" min="0" name="price" value="<?= h($o['price']) ?>"></label>
    <label>Prix affiché sur le voucher<input type="number" step="any" min="0" name="sprice" value="<?= h($o['sprice']) ?>"><small>0 = identique au prix</small></label>
    <label class="check"><input type="checkbox" name="record" value="1" <?= $o['record'] ? 'checked' : '' ?>> Enregistrer les ventes (rapport)</label>
    <label class="check"><input type="checkbox" name="lock" value="1" <?= $o['lock'] ? 'checked' : '' ?>> Verrouiller le compte sur la 1re adresse MAC</label>
    <div class="span2 actions">
      <button class="btn btn-primary">Enregistrer</button>
      <a class="btn btn-ghost" href="<?= h(url('profiles')) ?>">Annuler</a>
    </div>
  </form>
</div>
<details class="card narrow"><summary>Voir le script on-login généré</summary><pre class="code"><?= h($p['on-login'] ?? '') ?></pre></details>
    <?php
    return;
}

$profiles = $api->comm("$M/print");
$counts = array_count_values(array_column($api->comm('/ip/hotspot/user/print', ['.proplist' => 'profile']), 'profile'));
?>
<div class="toolbar"><a class="btn btn-primary" href="<?= h(url('profiles', ['edit' => 'new'])) ?>">+ Nouveau profil</a></div>
<div class="table-wrap"><table class="table">
  <thead><tr><th>Nom</th><th>Partagés</th><th>Débit</th><th>Validité</th><th class="num">Prix</th><th class="num">Prix voucher</th><th>Expiration</th><th>Options</th><th class="num">Utilisateurs</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($profiles as $p): $o = mk_parse_onlogin($p['on-login'] ?? ''); ?>
    <tr>
      <td><a href="<?= h(url('profiles', ['edit' => $p['.id']])) ?>"><strong><?= h($p['name']) ?></strong></a></td>
      <td><?= h($p['shared-users'] ?? '') ?></td>
      <td><?= h($p['rate-limit'] ?? '') ?></td>
      <td><?= h(mk_duration($o['validity'])) ?></td>
      <td class="num"><?= $o['price'] > 0 ? h(money($o['price'])) : '' ?></td>
      <td class="num"><?= $o['sprice'] > 0 ? h(money($o['sprice'])) : '' ?></td>
      <td><?= $o['mode'] === 'remove' ? '<span class="tag warn">suppression</span>' : ($o['mode'] === 'notice' ? '<span class="tag">blocage</span>' : '') ?></td>
      <td><?= $o['record'] ? '<span class="tag ok">ventes</span>' : '' ?><?= $o['lock'] ? '<span class="tag">MAC</span>' : '' ?><?= !empty($o['v3']) ? '<span class="tag">V3</span>' : '' ?></td>
      <td class="num"><a href="<?= h(url('users', ['profile' => $p['name']])) ?>"><?= (int)($counts[$p['name']] ?? 0) ?></a></td>
      <td class="row-actions">
        <a class="btn btn-xs" href="<?= h(url('profiles', ['edit' => $p['.id']])) ?>">✎</a>
        <?php if ($p['name'] !== 'default'): ?><?= post_button(url('profiles'), ['action' => 'remove', 'id' => $p['.id']], '✕', 'btn btn-xs btn-danger', 'Supprimer le profil ' . $p['name'] . ' ?') ?><?php endif; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
