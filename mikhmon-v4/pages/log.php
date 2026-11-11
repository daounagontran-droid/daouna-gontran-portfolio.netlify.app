<?php
/** Journal du routeur (hotspot par défaut). */

$title = 'Journal';
$api = api();
$topic = get('topic', 'hotspot');
$q = mb_strtolower(get('q'));
$logs = array_reverse($api->comm('/log/print'));
$logs = array_filter($logs, fn($l) => ($topic === '' || str_contains($l['topics'] ?? '', $topic))
    && ($q === '' || str_contains(mb_strtolower($l['message'] ?? ''), $q)));
$logs = array_slice($logs, 0, 500);
?>
<form class="toolbar" method="get">
  <input type="hidden" name="p" value="log">
  <select name="topic" class="input-sm" onchange="this.form.submit()"><?= select_options(['hotspot' => 'Hotspot', 'dhcp' => 'DHCP', 'ppp' => 'PPP', 'system' => 'Système', 'error' => 'Erreurs', '' => 'Tout'], $topic, true) ?></select>
  <input name="q" value="<?= h(get('q')) ?>" placeholder="Filtrer…" class="input-sm">
  <button class="btn btn-sm">Filtrer</button>
  <span class="spacer"></span><a class="btn btn-sm" href="<?= h(url('log', ['topic' => $topic])) ?>">↻ Actualiser</a>
</form>
<div class="table-wrap"><table class="table compact">
  <thead><tr><th>Heure</th><th>Sujets</th><th>Message</th></tr></thead>
  <tbody>
  <?php foreach ($logs as $l): $msg = $l['message'] ?? ''; ?>
    <tr class="<?= preg_match('/fail|error|invalid/i', $msg) ? 'row-bad' : (str_contains($msg, 'logged in') ? 'row-ok' : '') ?>">
      <td class="mono nowrap"><?= h($l['time'] ?? '') ?></td><td class="small"><?= h($l['topics'] ?? '') ?></td><td><?= h($msg) ?></td></tr>
  <?php endforeach; ?>
  <?php if (!$logs): ?><tr><td colspan="3" class="muted">Aucune entrée.</td></tr><?php endif; ?>
  </tbody>
</table></div>
