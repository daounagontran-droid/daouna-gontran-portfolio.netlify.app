<?php
/** Génération de vouchers en lot. */

$title = 'Générer des vouchers';
$api = api();

if (is_post()) {
    csrf_check();
    $qty = (int)post('qty');
    $mode = post('mode') === 'up' ? 'up' : 'vc';
    $len = max(3, min(12, (int)post('len', '6')));
    $plen = max(3, min(12, (int)post('plen', '4')));
    $prefix = preg_replace('/[^A-Za-z0-9_-]/', '', post('prefix'));
    $charset = array_key_exists(post('charset'), MK_CHARSETS) ? post('charset') : 'num';
    $profile = post('profile', 'default');
    $limitUptime = post('limit_uptime');
    $limitBytes = mk_parse_size(post('limit_bytes'));
    $label = preg_replace('/[^A-Za-z0-9_.-]/', '', post('label'));

    try {
        if ($qty < 1 || $qty > 1000) {
            throw new RouterOSException('Quantité invalide (1 à 1000).');
        }
        if ($limitUptime !== '' && !mk_valid_duration($limitUptime)) {
            throw new RouterOSException('Limite de temps invalide (ex : 1h, 1d).');
        }
        $batch = $mode . '-' . date('ymd-His') . ($label !== '' ? '-' . $label : '');
        $existing = array_flip(array_column($api->comm('/ip/hotspot/user/print', ['.proplist' => 'name']), 'name'));
        $created = 0;
        for ($i = 0; $i < $qty; $i++) {
            $tries = 0;
            do {
                $name = $prefix . mk_random_string($len, $charset);
                if (++$tries > 50) {
                    throw new RouterOSException("Plus de combinaisons disponibles : augmentez la longueur. $created utilisateur(s) créé(s).");
                }
            } while (isset($existing[$name]));
            $existing[$name] = true;
            $data = [
                'server' => post('server', 'all') ?: 'all',
                'name' => $name,
                'password' => $mode === 'vc' ? $name : mk_random_string($plen, $charset === 'num' ? 'num' : 'lownum'),
                'profile' => $profile,
                'comment' => $batch,
            ];
            if ($limitUptime !== '') {
                $data['limit-uptime'] = $limitUptime;
            }
            if ($limitBytes !== '') {
                $data['limit-bytes-total'] = $limitBytes;
            }
            $api->comm('/ip/hotspot/user/add', $data);
            $created++;
        }
        flash('ok', "$created voucher(s) générés dans le lot « $batch ».");
        if (post('then') === 'print') {
            redirect(url('print', ['comment' => $batch, 'tpl' => post('tpl', 'default')]));
        }
        redirect(url('users', ['comment' => $batch]));
    } catch (RouterOSException $e) {
        flash('error', $e->getMessage());
        redirect(url(post('then') === 'print' ? 'vouchers' : 'generate'));
    }
}

$profiles = hs_profile_names();
$servers = array_merge(['all'], hs_server_names());
$infos = [];
foreach ($api->comm('/ip/hotspot/user/profile/print') as $p) {
    $o = mk_parse_onlogin($p['on-login'] ?? '');
    $infos[$p['name']] = trim(($o['validity'] ? 'validité ' . mk_duration($o['validity']) : '') . ($o['price'] > 0 ? ' · ' . money($o['price']) : '') . (!empty($p['rate-limit']) ? ' · ' . $p['rate-limit'] : ''), ' ·');
}
?>
<div class="card narrow">
  <form method="post" class="form grid2" id="genForm">
    <?= csrf_field() ?>
    <label>Quantité<input type="number" name="qty" min="1" max="1000" value="10" required></label>
    <label>Serveur<select name="server"><?= select_options($servers, 'all') ?></select></label>
    <label>Type de voucher<select name="mode">
      <option value="vc">Code unique (utilisateur = mot de passe)</option>
      <option value="up">Utilisateur + mot de passe</option></select></label>
    <label>Profil<select name="profile" id="genProfile"><?php foreach ($profiles as $p): ?><option value="<?= h($p) ?>" data-info="<?= h($infos[$p] ?? '') ?>"><?= h($p) ?></option><?php endforeach; ?></select>
      <small id="genProfileInfo"></small></label>
    <label>Préfixe<input name="prefix" maxlength="6" placeholder="optionnel"></label>
    <label>Caractères<select name="charset"><?php foreach (MK_CHARSETS as $k => [$lbl]): ?><option value="<?= h($k) ?>"><?= h($lbl) ?></option><?php endforeach; ?></select></label>
    <label>Longueur du code<input type="number" name="len" min="3" max="12" value="6"></label>
    <label>Longueur du mot de passe<input type="number" name="plen" min="3" max="12" value="4"><small>Type « utilisateur + mot de passe » uniquement</small></label>
    <label>Limite de temps<input name="limit_uptime" placeholder="ex : 3h (vide = selon profil)"></label>
    <label>Limite de données<input name="limit_bytes" placeholder="ex : 1G (vide = illimité)"></label>
    <label class="span2">Étiquette du lot<input name="label" maxlength="20" placeholder="ex : boutique (optionnel)"></label>
    <div class="span2 actions"><button class="btn btn-primary">Générer</button></div>
  </form>
</div>
<div class="card narrow muted small">
  Les vouchers d'un même lot partagent un commentaire (ex : <code>vc-<?= date('ymd-His') ?></code>), ce qui permet de les filtrer,
  les imprimer ou les supprimer ensemble. La validité, le prix et l'enregistrement des ventes se règlent dans le
  <a href="<?= h(url('profiles')) ?>">profil utilisateur</a>.
</div>
