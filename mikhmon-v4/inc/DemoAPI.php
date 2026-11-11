<?php
/**
 * Mikhmon V4 - Routeur de démonstration.
 *
 * Simule les menus RouterOS utilisés par Mikhmon (print/add/set/remove) avec un état
 * stocké en session, pour essayer l'interface sans MikroTik.
 */

class DemoAPI
{
    private array $db;

    public function __construct()
    {
        if (!isset($_SESSION['demo_db'])) {
            $_SESSION['demo_db'] = self::seed();
        }
        $this->db = &$_SESSION['demo_db'];
    }

    public function isConnected(): bool
    {
        return true;
    }

    public function disconnect(): void
    {
    }

    public function comm(string $cmd, array $args = []): array
    {
        $cmd = rtrim($cmd, '/');
        $pos = strrpos($cmd, '/');
        $menu = substr($cmd, 0, $pos);
        $action = substr($cmd, $pos + 1);

        switch ($cmd) {
            case '/system/resource/print':
                return [[
                    'uptime' => '3d4h12m5s', 'version' => '7.16.1 (stable)', 'board-name' => 'hAP ac2 (démo)',
                    'cpu-load' => (string)random_int(3, 35), 'free-memory' => '96468992', 'total-memory' => '134217728',
                    'free-hdd-space' => '3510272', 'total-hdd-space' => '16777216', 'architecture-name' => 'arm', 'cpu-count' => '4',
                ]];
            case '/system/clock/print':
                return [['time' => date('H:i:s'), 'date' => date('Y-m-d'), 'time-zone-name' => date_default_timezone_get()]];
            case '/system/identity/print':
                return [['name' => 'MikroTik-Demo']];
            case '/system/routerboard/print':
                return [['model' => 'RBD52G-5HacD2HnD', 'serial-number' => 'DEMO12345', 'current-firmware' => '7.16.1']];
            case '/interface/monitor-traffic':
                return [['name' => $args['interface'] ?? 'ether1', 'rx-bits-per-second' => (string)random_int(2e6, 25e6), 'tx-bits-per-second' => (string)random_int(5e5, 8e6)]];
            case '/system/reboot':
            case '/system/shutdown':
                throw new RouterOSException('Mode démo : action simulée, le routeur n\'a pas redémarré.');
        }

        if (!isset($this->db[$menu])) {
            throw new RouterOSException("no such command prefix ($menu)");
        }
        $table = &$this->db[$menu];

        switch ($action) {
            case 'print':
                $rows = array_values(array_filter($table, fn($r) => self::match($r, $args)));
                if (array_key_exists('count-only', $args)) {
                    return [['ret' => (string)count($rows)]];
                }
                return $rows;
            case 'add':
                $this->ensureUnique($menu, $args);
                $id = '*' . strtoupper(dechex($this->db['_seq']++));
                $row = ['.id' => $id];
                foreach ($args as $k => $v) {
                    $row[$k] = (string)$v;
                }
                $row += self::defaults($menu);
                $table[] = $row;
                return [['ret' => $id]];
            case 'set':
            case 'enable':
            case 'disable':
            case 'remove':
            case 'reset-counters':
            case 'unset':
            case 'make-static':
                $ids = explode(',', $args['.id'] ?? $args['numbers'] ?? '');
                foreach ($table as $i => &$row) {
                    if (!in_array($row['.id'], $ids, true)) {
                        continue;
                    }
                    if ($action === 'remove') {
                        unset($table[$i]);
                    } elseif ($action === 'enable' || $action === 'disable') {
                        $row['disabled'] = $action === 'disable' ? 'true' : 'false';
                    } elseif ($action === 'unset') {
                        $row[$args['value-name'] ?? ''] = '';
                    } elseif ($action === 'make-static') {
                        $row['dynamic'] = 'false';
                    } elseif ($action === 'reset-counters') {
                        $row['uptime'] = '0s';
                        $row['bytes-in'] = $row['bytes-out'] = '0';
                    } else {
                        foreach ($args as $k => $v) {
                            if ($k !== '.id' && $k !== 'numbers') {
                                $row[$k] = (string)$v;
                            }
                        }
                    }
                }
                unset($row);
                $table = array_values($table);
                return [];
            case 'make-binding':
                foreach ($table as $row) {
                    if ($row['.id'] === ($args['.id'] ?? '')) {
                        $this->db['/ip/hotspot/ip-binding'][] = ['.id' => '*' . strtoupper(dechex($this->db['_seq']++)),
                            'mac-address' => $row['mac-address'], 'address' => $row['address'], 'to-address' => $row['to-address'] ?? '',
                            'server' => 'all', 'type' => $args['type'] ?? 'bypassed', 'comment' => '', 'disabled' => 'false'];
                    }
                }
                return [];
        }
        throw new RouterOSException("Mode démo : commande non simulée ($cmd)");
    }

    private function ensureUnique(string $menu, array $args): void
    {
        if (in_array($menu, ['/ip/hotspot/user', '/ip/hotspot/user/profile', '/ppp/secret', '/system/scheduler'], true)) {
            foreach ($this->db[$menu] as $r) {
                if (($r['name'] ?? null) === ($args['name'] ?? '')) {
                    throw new RouterOSException('failure: already have user with this name');
                }
            }
        }
    }

    private static function match(array $row, array $args): bool
    {
        foreach ($args as $k => $v) {
            if (is_string($k) && $k !== '' && $k[0] === '?') {
                $f = substr($k, 1);
                if (($row[$f] ?? '') !== (string)$v) {
                    return false;
                }
            }
        }
        return true;
    }

    private static function defaults(string $menu): array
    {
        return match ($menu) {
            '/ip/hotspot/user' => ['server' => 'all', 'profile' => 'default', 'uptime' => '0s', 'bytes-in' => '0', 'bytes-out' => '0',
                'limit-uptime' => '', 'limit-bytes-total' => '', 'comment' => '', 'disabled' => 'false'],
            '/ip/hotspot/user/profile' => ['shared-users' => '1', 'rate-limit' => '', 'on-login' => '', 'address-pool' => 'none'],
            '/ppp/secret' => ['service' => 'any', 'profile' => 'default', 'disabled' => 'false', 'comment' => ''],
            default => ['disabled' => 'false'],
        };
    }

    private static function seed(): array
    {
        require_once __DIR__ . '/hotspot.php';
        $db = ['_seq' => 0x100];
        $mk = function (array $fields) use (&$db) {
            return ['.id' => '*' . strtoupper(dechex($db['_seq']++))] + $fields;
        };

        $profiles = [
            ['1H', 200, 250, '1h', '1M/2M'],
            ['1Jour', 500, 500, '1d', '2M/4M'],
            ['1Semaine', 2500, 3000, '7d', '2M/4M'],
            ['1Mois', 8000, 10000, '30d', '3M/6M'],
        ];
        $db['/ip/hotspot/user/profile'] = [$mk(['name' => 'default', 'shared-users' => '1', 'rate-limit' => '', 'on-login' => '', 'address-pool' => 'none'])];
        foreach ($profiles as [$name, $price, $sprice, $val, $rate]) {
            $db['/ip/hotspot/user/profile'][] = $mk(['name' => $name, 'shared-users' => '1', 'rate-limit' => $rate, 'address-pool' => 'none',
                'on-login' => mk_build_onlogin(['mode' => 'remove', 'price' => $price, 'sprice' => $sprice, 'validity' => $val, 'lock' => false, 'record' => true])]);
        }

        $db['/ip/hotspot/user'] = [$mk(['name' => 'admin-test', 'password' => '1234', 'server' => 'all', 'profile' => 'default', 'uptime' => '5h2m',
            'bytes-in' => '120400000', 'bytes-out' => '1850000000', 'limit-uptime' => '', 'limit-bytes-total' => '', 'comment' => 'compte de test', 'disabled' => 'false'])];
        $batch = 'vc-' . date('md') . '-1J';
        for ($i = 0; $i < 12; $i++) {
            $u = mk_random_string(6, 'num');
            $db['/ip/hotspot/user'][] = $mk(['name' => $u, 'password' => $u, 'server' => 'all', 'profile' => '1Jour', 'uptime' => $i < 4 ? random_int(1, 50) . 'm' : '0s',
                'bytes-in' => (string)($i < 4 ? random_int(1e6, 9e7) : 0), 'bytes-out' => (string)($i < 4 ? random_int(1e7, 9e8) : 0),
                'limit-uptime' => '', 'limit-bytes-total' => '', 'comment' => $batch, 'disabled' => 'false']);
        }

        $db['/ip/hotspot/active'] = [];
        $db['/ip/hotspot/host'] = [];
        foreach (array_slice($db['/ip/hotspot/user'], 1, 4) as $n => $u) {
            $mac = sprintf('A4:5E:60:%02X:%02X:%02X', random_int(0, 255), random_int(0, 255), random_int(0, 255));
            $ip = '10.5.50.' . (10 + $n);
            $db['/ip/hotspot/active'][] = $mk(['server' => 'hotspot1', 'user' => $u['name'], 'address' => $ip, 'mac-address' => $mac,
                'uptime' => $u['uptime'], 'session-time-left' => '', 'idle-time' => '0s', 'bytes-in' => $u['bytes-in'], 'bytes-out' => $u['bytes-out'], 'login-by' => 'http-chap']);
            $db['/ip/hotspot/host'][] = $mk(['mac-address' => $mac, 'address' => $ip, 'to-address' => $ip, 'server' => 'hotspot1',
                'authorized' => 'true', 'bypassed' => 'false', 'uptime' => $u['uptime'], 'idle-time' => '0s', 'comment' => '']);
        }
        $db['/ip/hotspot/host'][] = $mk(['mac-address' => '3C:22:FB:10:AA:01', 'address' => '10.5.50.99', 'to-address' => '10.5.50.99', 'server' => 'hotspot1',
            'authorized' => 'false', 'bypassed' => 'false', 'uptime' => '2m', 'idle-time' => '10s', 'comment' => '']);
        $db['/ip/hotspot/ip-binding'] = [];
        $db['/ip/hotspot/cookie'] = [];
        $db['/ip/hotspot'] = [$mk(['name' => 'hotspot1', 'interface' => 'bridge-hotspot', 'address-pool' => 'hs-pool', 'profile' => 'hsprof1', 'disabled' => 'false'])];
        $db['/ip/hotspot/profile'] = [$mk(['name' => 'hsprof1', 'dns-name' => 'wifi.local', 'hotspot-address' => '10.5.50.1'])];
        $db['/ip/pool'] = [$mk(['name' => 'hs-pool', 'ranges' => '10.5.50.2-10.5.50.254'])];
        $db['/interface'] = [
            $mk(['name' => 'ether1', 'type' => 'ether', 'running' => 'true', 'disabled' => 'false']),
            $mk(['name' => 'bridge-hotspot', 'type' => 'bridge', 'running' => 'true', 'disabled' => 'false']),
            $mk(['name' => 'wlan1', 'type' => 'wlan', 'running' => 'true', 'disabled' => 'false']),
        ];

        // Ventes des 40 derniers jours, au format des scripts "mikhmon".
        $db['/system/script'] = [];
        $prices = ['1H' => [250, '1h'], '1Jour' => [500, '1d'], '1Semaine' => [3000, '7d'], '1Mois' => [10000, '30d']];
        for ($d = 40; $d >= 0; $d--) {
            $n = random_int(3, 14);
            for ($i = 0; $i < $n; $i++) {
                $p = array_rand($prices);
                $ts = strtotime("-$d days") - random_int(0, 36000);
                if ($ts > time()) {
                    $ts = time();
                }
                $date = date('Y-m-d', $ts);
                $u = mk_random_string(6, 'num');
                $db['/system/script'][] = $mk([
                    'name' => "$date-|-" . date('H:i:s', $ts) . "-|-$u-|-{$prices[$p][0]}-|-10.5.50." . random_int(2, 250) . "-|-A4:5E:60:00:00:" . sprintf('%02X', random_int(0, 255)) . "-|-{$prices[$p][1]}-|-$p-|-vc-demo",
                    'owner' => date('MY', $ts), 'source' => $date, 'comment' => 'mikhmon', 'policy' => 'read,write',
                ]);
            }
        }
        $db['/system/scheduler'] = [$mk(['name' => 'exp-' . $db['/ip/hotspot/user'][1]['name'], 'interval' => '1d', 'next-run' => date('Y-m-d H:i:s', time() + 70000),
            'on-event' => '...', 'comment' => 'mikhmon', 'disabled' => 'false', 'run-count' => '0'])];

        $db['/ip/dhcp-server/lease'] = [
            $mk(['address' => '192.168.88.10', 'mac-address' => 'DC:A6:32:01:02:03', 'host-name' => 'raspberrypi', 'server' => 'dhcp1', 'status' => 'bound', 'dynamic' => 'true', 'expires-after' => '8m', 'comment' => '']),
            $mk(['address' => '192.168.88.20', 'mac-address' => '00:0C:29:AA:BB:CC', 'host-name' => 'PC-Bureau', 'server' => 'dhcp1', 'status' => 'bound', 'dynamic' => 'false', 'expires-after' => '', 'comment' => 'poste fixe']),
        ];
        $db['/ppp/secret'] = [$mk(['name' => 'client-pppoe1', 'password' => 'secret', 'service' => 'pppoe', 'profile' => 'default', 'remote-address' => '172.16.0.10', 'disabled' => 'false', 'comment' => ''])];
        $db['/ppp/active'] = [$mk(['name' => 'client-pppoe1', 'service' => 'pppoe', 'caller-id' => 'E4:8D:8C:11:22:33', 'address' => '172.16.0.10', 'uptime' => '1d2h'])];
        $db['/ppp/profile'] = [$mk(['name' => 'default']), $mk(['name' => 'default-encryption'])];

        $db['/log'] = [];
        foreach ($db['/ip/hotspot/active'] as $a) {
            $db['/log'][] = $mk(['time' => date('H:i:s', time() - random_int(60, 3000)), 'topics' => 'hotspot,info,debug', 'message' => "{$a['user']} ({$a['address']}): logged in"]);
        }
        $db['/log'][] = $mk(['time' => date('H:i:s', time() - 30), 'topics' => 'hotspot,info,debug', 'message' => '123456 (10.5.50.99): login failed: invalid username or password']);
        $db['/log'][] = $mk(['time' => date('H:i:s', time() - 20), 'topics' => 'system,info,account', 'message' => 'user admin logged in via api']);
        return $db;
    }
}
