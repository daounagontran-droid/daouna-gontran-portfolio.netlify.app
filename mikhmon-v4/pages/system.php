<?php
/** Informations système, redémarrage, arrêt, nettoyage. */

$title = 'Système';
$api = api();

if (is_post()) {
    csrf_check();
    try {
        switch (post('action')) {
            case 'reboot':
                $api->comm('/system/reboot');
                flash('ok', 'Redémarrage du routeur demandé.');
                break;
            case 'shutdown':
                $api->comm('/system/shutdown');
                flash('ok', 'Arrêt du routeur demandé.');
                break;
            case 'clean-expired':
                // Utilisateurs bloqués par le mode "notice" (commentaire terminé par EXPIRE).
                $rows = array_filter($api->comm('/ip/hotspot/user/print', ['.proplist' => '.id,comment']), fn($u) => str_ends_with($u['comment'] ?? '', '| EXPIRE'));
                if ($rows) {
                    $api->comm('/ip/hotspot/user/remove', ['.id' => implode(',', array_column($rows, '.id'))]);
                }
                flash('ok', count($rows) . ' utilisateur(s) expiré(s) supprimé(s).');
                break;
        }
    } catch (RouterOSException $e) {
        // Le routeur coupe la connexion en redémarrant : ce n'est pas une erreur.
        if (in_array(post('action'), ['reboot', 'shutdown'], true) && !str_starts_with($e->getMessage(), 'Mode démo')) {
            flash('ok', 'Commande envoyée au routeur.');
        } else {
            flash('error', $e->getMessage());
        }
    }
    redirect(url('system'));
}

$res = $api->comm('/system/resource/print')[0] ?? [];
$identity = $api->comm('/system/identity/print')[0]['name'] ?? '';
$clock = $api->comm('/system/clock/print')[0] ?? [];
try {
    $rb = $api->comm('/system/routerboard/print')[0] ?? [];
} catch (RouterOSException $e) {
    $rb = [];
}
$hs = $api->comm('/ip/hotspot/print');
?>
<div class="grid-2">
  <div class="card"><h3>Routeur</h3>
    <table class="kv">
      <tr><th>Identité</th><td><?= h($identity) ?></td></tr>
      <tr><th>Carte</th><td><?= h($res['board-name'] ?? '') ?></td></tr>
      <tr><th>Modèle</th><td><?= h($rb['model'] ?? '–') ?></td></tr>
      <tr><th>N° de série</th><td><?= h($rb['serial-number'] ?? '–') ?></td></tr>
      <tr><th>Firmware</th><td><?= h($rb['current-firmware'] ?? '–') ?></td></tr>
      <tr><th>RouterOS</th><td><?= h($res['version'] ?? '') ?></td></tr>
      <tr><th>Architecture</th><td><?= h(($res['architecture-name'] ?? '') . ' · ' . ($res['cpu-count'] ?? '?') . ' cœur(s)') ?></td></tr>
      <tr><th>Uptime</th><td><?= h(mk_duration($res['uptime'] ?? '')) ?></td></tr>
      <tr><th>Horloge</th><td><?= h(($clock['date'] ?? '') . ' ' . ($clock['time'] ?? '') . ' (' . ($clock['time-zone-name'] ?? '') . ')') ?></td></tr>
    </table>
  </div>
  <div class="card"><h3>Serveurs hotspot</h3>
    <table class="table compact"><thead><tr><th>Nom</th><th>Interface</th><th>Pool</th><th>Profil</th></tr></thead><tbody>
    <?php foreach ($hs as $s): ?><tr><td><?= h($s['name'] ?? '') ?></td><td><?= h($s['interface'] ?? '') ?></td><td><?= h($s['address-pool'] ?? '') ?></td><td><?= h($s['profile'] ?? '') ?></td></tr><?php endforeach; ?>
    <?php if (!$hs): ?><tr><td colspan="4" class="muted">Aucun serveur hotspot configuré.</td></tr><?php endif; ?>
    </tbody></table>
    <h3>Maintenance</h3>
    <div class="actions">
      <?= post_button(url('system'), ['action' => 'clean-expired'], 'Supprimer les utilisateurs expirés', 'btn', 'Supprimer tous les utilisateurs marqués EXPIRE ?') ?>
      <?= post_button(url('system'), ['action' => 'reboot'], '↻ Redémarrer', 'btn btn-warn', 'Redémarrer le routeur ? Les clients seront déconnectés.') ?>
      <?= post_button(url('system'), ['action' => 'shutdown'], '⏻ Éteindre', 'btn btn-danger', 'Éteindre le routeur ? Il faudra le rallumer manuellement.') ?>
    </div>
  </div>
</div>
