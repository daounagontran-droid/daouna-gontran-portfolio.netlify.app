<?php
/** Gestion des routeurs (sessions) : ajout, modification, test, sélection. */

$title = 'Routeurs';
$cfg = cfg();

if (is_post()) {
    csrf_check();
    $action = post('action');
    $id = post('id');

    if ($action === 'select' && isset($cfg['routers'][$id])) {
        $_SESSION['rid'] = $id;
        try {
            api_for(router($id))->disconnect();
            flash('ok', 'Connecté à ' . ($cfg['routers'][$id]['name'] ?: $cfg['routers'][$id]['host']) . '.');
            redirect(url('dashboard'));
        } catch (RouterOSException $e) {
            flash('error', 'Connexion impossible : ' . $e->getMessage());
            redirect(url('routers'));
        }
    }

    if ($action === 'delete' && isset($cfg['routers'][$id])) {
        unset($cfg['routers'][$id]);
        cfg_save($cfg);
        if (($_SESSION['rid'] ?? null) === $id) {
            unset($_SESSION['rid'], $_SESSION['demo_db']);
        }
        flash('ok', 'Routeur supprimé.');
        redirect(url('routers'));
    }

    if ($action === 'demo') {
        $id = 'demo';
        $cfg['routers'][$id] = ['name' => 'Routeur de démonstration', 'host' => 'demo', 'demo' => true] + router_defaults();
        cfg_save($cfg);
        unset($_SESSION['demo_db']);
        $_SESSION['rid'] = $id;
        flash('ok', 'Routeur de démonstration ajouté : les données sont fictives.');
        redirect(url('dashboard'));
    }

    if ($action === 'save' || $action === 'test') {
        $old = $cfg['routers'][$id] ?? null;
        $r = [
            'name' => post('name'),
            'host' => post('host'),
            'port' => max(1, min(65535, (int)post('port', '8728'))),
            'ssl' => post('ssl') === '1',
            'user' => post('user'),
            'pass' => post('pass') !== '' ? mk_encrypt(post('pass')) : ($old['pass'] ?? ''),
            'hotspot_name' => post('hotspot_name'),
            'dns_name' => post('dns_name'),
            'currency' => post('currency'),
            'iface' => post('iface', 'ether1'),
            'reload' => max(3, (int)post('reload', '10')),
            'demo' => (bool)($old['demo'] ?? false),
        ];
        $errors = [];
        if ($r['host'] === '' || !preg_match('/^[A-Za-z0-9.:\-\[\]]+$/', $r['host'])) {
            $errors[] = 'Adresse IP / hôte invalide.';
        }
        if ($r['user'] === '') {
            $errors[] = 'Utilisateur API requis.';
        }
        if ($errors) {
            foreach ($errors as $e) {
                flash('error', $e);
            }
        } elseif ($action === 'test') {
            try {
                $api = api_for($r);
                $id_ = $api->comm('/system/identity/print')[0]['name'] ?? '?';
                $res = $api->comm('/system/resource/print')[0] ?? [];
                flash('ok', "Connexion réussie : « $id_ » — RouterOS " . ($res['version'] ?? '?') . ' (' . ($res['board-name'] ?? '') . ').');
            } catch (RouterOSException $e) {
                flash('error', 'Échec : ' . $e->getMessage());
            }
            $_SESSION['router_form'] = $r + ['id' => $id];
            redirect(url('routers', ['edit' => $id ?: 'new']));
        } else {
            if ($id === '' || !isset($cfg['routers'][$id])) {
                $id = 'r' . bin2hex(random_bytes(4));
            }
            if ($r['name'] === '') {
                $r['name'] = $r['host'];
            }
            $cfg['routers'][$id] = $r;
            cfg_save($cfg);
            flash('ok', 'Routeur enregistré.');
            redirect(url('routers'));
        }
        $_SESSION['router_form'] = $r + ['id' => $id];
        redirect(url('routers', ['edit' => $id ?: 'new']));
    }
}

$edit = get('edit');
if ($edit !== '') {
    $form = $_SESSION['router_form'] ?? null;
    unset($_SESSION['router_form']);
    $form ??= isset($cfg['routers'][$edit]) ? $cfg['routers'][$edit] + ['id' => $edit] : router_defaults() + ['id' => ''];
    $title = $form['id'] ? 'Modifier le routeur' : 'Ajouter un routeur';
    ?>
<div class="card narrow">
  <form method="post" class="form grid2">
    <?= csrf_field() ?>
    <input type="hidden" name="id" value="<?= h($form['id']) ?>">
    <h3 class="span2">Connexion API</h3>
    <label>Nom de la session<input name="name" value="<?= h($form['name']) ?>" placeholder="Hotspot boutique"></label>
    <label>Adresse IP / hôte<input name="host" required value="<?= h($form['host']) ?>" placeholder="192.168.88.1"></label>
    <label>Port API<input type="number" name="port" value="<?= h($form['port']) ?>"><small>8728 (api) ou 8729 (api-ssl)</small></label>
    <label class="check"><input type="checkbox" name="ssl" value="1" <?= !empty($form['ssl']) ? 'checked' : '' ?>> Utiliser API-SSL</label>
    <label>Utilisateur<input name="user" required value="<?= h($form['user']) ?>" autocomplete="off"></label>
    <label>Mot de passe<input type="password" name="pass" autocomplete="new-password" placeholder="<?= $form['id'] ? 'inchangé si vide' : '' ?>"></label>
    <h3 class="span2">Hotspot</h3>
    <label>Nom du hotspot (vouchers)<input name="hotspot_name" value="<?= h($form['hotspot_name']) ?>"></label>
    <label>Nom DNS du hotspot<input name="dns_name" value="<?= h($form['dns_name']) ?>"><small>Utilisé pour le lien de connexion / QR code</small></label>
    <label>Devise<input name="currency" value="<?= h($form['currency']) ?>" placeholder="FCFA"></label>
    <label>Interface de trafic<input name="iface" value="<?= h($form['iface']) ?>" placeholder="ether1"></label>
    <label>Rafraîchissement (secondes)<input type="number" min="3" name="reload" value="<?= h($form['reload']) ?>"></label>
    <div class="span2 actions">
      <button class="btn btn-primary" name="action" value="save">Enregistrer</button>
      <button class="btn" name="action" value="test" formnovalidate>Tester la connexion</button>
      <a class="btn btn-ghost" href="<?= h(url('routers')) ?>">Annuler</a>
    </div>
  </form>
</div>
<div class="card narrow muted small">
  <strong>Préparer le MikroTik :</strong> activez le service API (<code>/ip service enable api</code>) et créez de préférence
  un utilisateur dédié : <code>/user add name=mikhmon group=full password=...</code>.
</div>
    <?php
    return;
}
?>
<div class="toolbar">
  <a class="btn btn-primary" href="<?= h(url('routers', ['edit' => 'new'])) ?>">+ Ajouter un routeur</a>
  <?php if (!isset($cfg['routers']['demo'])): ?>
    <?= post_button(url('routers'), ['action' => 'demo'], 'Essayer le mode démo', 'btn') ?>
  <?php endif; ?>
</div>
<?php if (!$cfg['routers']): ?>
  <div class="card empty"><p>Aucun routeur configuré. Ajoutez votre MikroTik ou essayez le mode démo.</p></div>
<?php else: ?>
<div class="cards">
  <?php foreach ($cfg['routers'] as $id => $r): $current = ($_SESSION['rid'] ?? null) === $id; ?>
  <div class="card router-card<?= $current ? ' current' : '' ?>">
    <div class="router-head"><strong><?= h($r['name'] ?: $r['host']) ?></strong><?= $current ? '<span class="tag ok">actif</span>' : '' ?><?= !empty($r['demo']) ? '<span class="tag warn">démo</span>' : '' ?></div>
    <div class="muted small"><?= !empty($r['demo']) ? 'Données simulées' : h($r['user'] . '@' . $r['host'] . ':' . $r['port'] . (!empty($r['ssl']) ? ' (SSL)' : '')) ?></div>
    <div class="muted small"><?= h($r['hotspot_name']) ?> · <?= h($r['dns_name']) ?> · <?= h($r['currency']) ?></div>
    <div class="actions">
      <?= post_button(url('routers'), ['action' => 'select', 'id' => $id], 'Ouvrir', 'btn btn-primary btn-sm') ?>
      <a class="btn btn-sm" href="<?= h(url('routers', ['edit' => $id])) ?>">Modifier</a>
      <?= post_button(url('routers'), ['action' => 'delete', 'id' => $id], 'Supprimer', 'btn btn-sm btn-danger', 'Supprimer ce routeur de Mikhmon ?') ?>
    </div>
  </div>
  <?php endforeach; ?>
</div>
<?php endif;
