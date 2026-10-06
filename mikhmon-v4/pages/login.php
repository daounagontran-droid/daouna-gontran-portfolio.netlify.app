<?php
/** Connexion administrateur. */

if (is_logged()) {
    redirect(url('dashboard'));
}

$error = '';
if (is_post()) {
    csrf_check();
    if (login(post('user'), post('pass'))) {
        $routers = cfg()['routers'];
        // Un seul routeur configuré : on le sélectionne directement.
        if (count($routers) === 1) {
            $_SESSION['rid'] = array_key_first($routers);
            redirect(url('dashboard'));
        }
        redirect(url('routers'));
    }
    $error = ($_SESSION['login_fail'] ?? 0) >= 5 ? 'Trop de tentatives. Patientez une minute.' : 'Identifiant ou mot de passe incorrect.';
}

ob_start(); ?>
<?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>
<form method="post" class="form">
  <?= csrf_field() ?>
  <label>Identifiant<input name="user" required autofocus autocomplete="username" value="<?= h(post('user')) ?>"></label>
  <label>Mot de passe<input type="password" name="pass" required autocomplete="current-password"></label>
  <button class="btn btn-primary btn-block" type="submit">Se connecter</button>
</form>
<?php render_auth('Connexion', ob_get_clean());
