<?php
/** Première installation : création de l'administrateur Mikhmon. */

if (cfg()['admin']) {
    redirect(url('login'));
}

$error = '';
if (is_post()) {
    csrf_check();
    $user = post('user');
    $pass = post('pass');
    if (!preg_match('/^[\w.@-]{3,32}$/', $user)) {
        $error = 'Identifiant invalide (3 à 32 caractères : lettres, chiffres, . _ - @).';
    } elseif (strlen($pass) < 6) {
        $error = 'Le mot de passe doit contenir au moins 6 caractères.';
    } elseif ($pass !== post('pass2')) {
        $error = 'Les deux mots de passe ne correspondent pas.';
    } else {
        $cfg = cfg();
        $cfg['admin'] = ['user' => $user, 'hash' => password_hash($pass, PASSWORD_DEFAULT)];
        $cfg['key'] = base64_encode(random_bytes(32));
        $cfg['settings']['timezone'] = post('timezone') ?: 'Africa/Ndjamena';
        try {
            cfg_save($cfg);
            flash('ok', 'Compte administrateur créé. Connectez-vous.');
            redirect(url('login'));
        } catch (RuntimeException $e) {
            $error = $e->getMessage();
        }
    }
}

$zones = DateTimeZone::listIdentifiers();
ob_start(); ?>
<h2>Installation</h2>
<p class="muted">Bienvenue ! Créez le compte administrateur de Mikhmon V4.</p>
<?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>
<form method="post" class="form">
  <?= csrf_field() ?>
  <label>Identifiant admin<input name="user" required value="<?= h(post('user', 'mikhmon')) ?>" autocomplete="username"></label>
  <label>Mot de passe<input type="password" name="pass" required minlength="6" autocomplete="new-password"></label>
  <label>Confirmer le mot de passe<input type="password" name="pass2" required minlength="6" autocomplete="new-password"></label>
  <label>Fuseau horaire<select name="timezone"><?= select_options($zones, post('timezone', 'Africa/Ndjamena')) ?></select></label>
  <button class="btn btn-primary btn-block" type="submit">Créer le compte</button>
</form>
<?php render_auth('Installation', ob_get_clean());
