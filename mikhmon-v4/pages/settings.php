<?php
/** Paramètres de Mikhmon : compte admin, fuseau horaire, thème. */

$title = 'Paramètres';

if (is_post()) {
    csrf_check();
    $cfg = cfg();
    $action = post('action');
    if ($action === 'general') {
        $tz = post('timezone');
        if (in_array($tz, DateTimeZone::listIdentifiers(), true)) {
            $cfg['settings']['timezone'] = $tz;
        }
        $cfg['settings']['theme'] = post('theme') === 'light' ? 'light' : 'dark';
        cfg_save($cfg);
        flash('ok', 'Paramètres enregistrés.');
    } elseif ($action === 'admin') {
        $user = post('user');
        if (!password_verify(post('current'), $cfg['admin']['hash'])) {
            flash('error', 'Mot de passe actuel incorrect.');
        } elseif (!preg_match('/^[\w.@-]{3,32}$/', $user)) {
            flash('error', 'Identifiant invalide.');
        } elseif (post('pass') !== '' && strlen(post('pass')) < 6) {
            flash('error', 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
        } elseif (post('pass') !== post('pass2')) {
            flash('error', 'Les mots de passe ne correspondent pas.');
        } else {
            $cfg['admin']['user'] = $user;
            if (post('pass') !== '') {
                $cfg['admin']['hash'] = password_hash(post('pass'), PASSWORD_DEFAULT);
            }
            cfg_save($cfg);
            $_SESSION['admin'] = $user;
            $_SESSION['admin_fp'] = hash('sha256', $cfg['admin']['hash']);
            flash('ok', 'Compte administrateur mis à jour.');
        }
    }
    redirect(url('settings'));
}
$cfg = cfg();
?>
<div class="grid-2">
  <div class="card">
    <h3>Général</h3>
    <form method="post" class="form">
      <?= csrf_field() ?><input type="hidden" name="action" value="general">
      <label>Fuseau horaire<select name="timezone"><?= select_options(DateTimeZone::listIdentifiers(), $cfg['settings']['timezone']) ?></select></label>
      <label>Thème<select name="theme"><?= select_options(['dark' => 'Sombre', 'light' => 'Clair'], $cfg['settings']['theme'], true) ?></select></label>
      <button class="btn btn-primary">Enregistrer</button>
    </form>
  </div>
  <div class="card">
    <h3>Compte administrateur</h3>
    <form method="post" class="form">
      <?= csrf_field() ?><input type="hidden" name="action" value="admin">
      <label>Identifiant<input name="user" required value="<?= h($cfg['admin']['user']) ?>"></label>
      <label>Nouveau mot de passe<input type="password" name="pass" autocomplete="new-password" placeholder="inchangé si vide"></label>
      <label>Confirmer<input type="password" name="pass2" autocomplete="new-password"></label>
      <label>Mot de passe actuel<input type="password" name="current" required autocomplete="current-password"></label>
      <button class="btn btn-primary">Mettre à jour</button>
    </form>
  </div>
</div>
<div class="card muted small">Mikhmon V4 <?= MK_VERSION ?> · PHP <?= h(PHP_VERSION) ?> · configuration : <code>data/config.php</code></div>
