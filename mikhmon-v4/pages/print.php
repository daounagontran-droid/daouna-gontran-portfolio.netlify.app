<?php
/** Page d'impression des vouchers (autonome, optimisée pour l'impression). */

$api = api();
$r = router();
$tpl = in_array(get('tpl'), ['default', 'small', 'thermal'], true) ? get('tpl') : 'default';
$qr = get('qr', '1') === '1';

if (get('user') !== '') {
    $users = $api->comm('/ip/hotspot/user/print', ['?name' => get('user')]);
} else {
    $batch = get('comment');
    $users = array_values(array_filter($api->comm('/ip/hotspot/user/print'), fn($u) => $batch !== '' && mk_batch($u['comment'] ?? '') === $batch));
    if (get('unused') === '1') {
        $users = array_values(array_filter($users, fn($u) => !str_contains($u['comment'] ?? '', '1st:') && in_array($u['uptime'] ?? '0s', ['0s', '', '00:00:00'], true)));
    }
}
usort($users, fn($a, $b) => strcmp($a['name'], $b['name']));

$profiles = [];
foreach ($api->comm('/ip/hotspot/user/profile/print') as $p) {
    $profiles[$p['name']] = mk_parse_onlogin($p['on-login'] ?? '') + ['rate' => $p['rate-limit'] ?? ''];
}
$dns = $r['dns_name'] ?: '';
$colors = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#db2777'];
?>
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vouchers · <?= h($r['hotspot_name']) ?></title>
<link rel="stylesheet" href="assets/print.css?v=<?= MK_VERSION ?>">
</head>
<body class="tpl-<?= h($tpl) ?>">
<div class="noprint bar">
  <strong><?= count($users) ?> voucher(s)</strong>
  <a href="<?= h(url('print', array_merge($_GET, ['tpl' => 'default', 'p' => null]))) ?>">Standard</a>
  <a href="<?= h(url('print', array_merge($_GET, ['tpl' => 'small', 'p' => null]))) ?>">Petit</a>
  <a href="<?= h(url('print', array_merge($_GET, ['tpl' => 'thermal', 'p' => null]))) ?>">Thermique</a>
  <a href="<?= h(url('print', array_merge($_GET, ['qr' => $qr ? '0' : '1', 'p' => null]))) ?>"><?= $qr ? 'Masquer' : 'Afficher' ?> les QR codes</a>
  <button onclick="window.print()">⎙ Imprimer</button>
</div>
<div class="sheet">
<?php foreach ($users as $i => $u):
    $o = $profiles[$u['profile'] ?? ''] ?? mk_parse_onlogin('');
    $price = (float)$o['sprice'] > 0 ? $o['sprice'] : $o['price'];
    $isCode = ($u['password'] ?? '') === $u['name'];
    $validity = $o['validity'] ?: ($u['limit-uptime'] ?? '');
    $color = $colors[crc32($u['profile'] ?? '') % count($colors)];
    $link = $dns !== '' ? 'http://' . $dns . '/login?username=' . rawurlencode($u['name']) . '&password=' . rawurlencode($u['password'] ?? '') : '';
    ?>
  <div class="voucher" style="--c:<?= h($color) ?>">
    <div class="v-head"><span class="v-name"><?= h($r['hotspot_name']) ?></span><span class="v-num">#<?= $i + 1 ?></span></div>
    <div class="v-body">
      <div class="v-creds">
        <?php if ($isCode): ?>
          <div class="v-label">Code d'accès</div><div class="v-code"><?= h($u['name']) ?></div>
        <?php else: ?>
          <div class="v-label">Utilisateur</div><div class="v-code sm"><?= h($u['name']) ?></div>
          <div class="v-label">Mot de passe</div><div class="v-code sm"><?= h($u['password'] ?? '') ?></div>
        <?php endif; ?>
      </div>
      <?php if ($qr && $link && $tpl !== 'small'): ?><div class="v-qr" data-qr="<?= h($link) ?>"></div><?php endif; ?>
    </div>
    <div class="v-foot">
      <span><?= h($validity ? mk_duration($validity) : ($u['profile'] ?? '')) ?><?= !empty($u['limit-bytes-total']) ? ' · ' . h(mk_bytes($u['limit-bytes-total'])) : '' ?></span>
      <?php if ($price > 0): ?><strong><?= h(money($price)) ?></strong><?php endif; ?>
    </div>
    <?php if ($dns !== '' && $tpl !== 'small'): ?><div class="v-dns">Connexion : http://<?= h($dns) ?></div><?php endif; ?>
  </div>
<?php endforeach; ?>
<?php if (!$users): ?><p class="noprint">Aucun voucher à imprimer.</p><?php endif; ?>
</div>
<?php if ($qr): ?>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
  if (window.QRCode) {
    document.querySelectorAll('[data-qr]').forEach(function (el) {
      new QRCode(el, { text: el.dataset.qr, width: 72, height: 72, correctLevel: QRCode.CorrectLevel.L });
    });
  }
</script>
<?php endif; ?>
</body></html>
