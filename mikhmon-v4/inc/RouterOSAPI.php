<?php
/**
 * Mikhmon V4 - Client API RouterOS (protocole binaire, port 8728 / 8729 SSL).
 *
 * Compatible RouterOS v6.43+ et v7 (login en clair), avec repli sur
 * l'ancien login par challenge MD5 pour les versions antérieures.
 */

class RouterOSException extends RuntimeException {}

class RouterOSAPI
{
    /** @var resource|null */
    private $socket = null;
    private int $timeout;

    public function __construct(int $timeout = 5)
    {
        $this->timeout = $timeout;
    }

    public function connect(string $host, string $user, string $pass, int $port = 8728, bool $ssl = false): void
    {
        $scheme = $ssl ? 'ssl' : 'tcp';
        $ctx = stream_context_create(['ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'ciphers' => 'ADH:ALL',
            'security_level' => 0,
        ]]);
        $errno = 0;
        $errstr = '';
        $sock = @stream_socket_client("$scheme://$host:$port", $errno, $errstr, $this->timeout, STREAM_CLIENT_CONNECT, $ctx);
        if (!$sock) {
            throw new RouterOSException("Connexion impossible à $host:$port ($errstr)");
        }
        stream_set_timeout($sock, $this->timeout);
        $this->socket = $sock;

        // Login RouterOS >= 6.43
        $this->write(['/login', '=name=' . $user, '=password=' . $pass]);
        $reply = $this->readSentences();
        $this->checkLogin($reply);
        $done = end($reply);
        // Ancien login par challenge (RouterOS < 6.43)
        if (isset($done['attrs']['ret'])) {
            $challenge = pack('H*', $done['attrs']['ret']);
            $this->write(['/login', '=name=' . $user, '=response=00' . md5(chr(0) . $pass . $challenge)]);
            $this->checkLogin($this->readSentences());
        }
    }

    /** Un refus arrive sous forme de !trap (suivi de !done) ou de !fatal. */
    private function checkLogin(array $reply): void
    {
        foreach ($reply as $s) {
            if ($s['type'] === '!trap' || $s['type'] === '!fatal') {
                $this->disconnect();
                throw new RouterOSException('Identifiants invalides : ' . ($s['attrs']['message'] ?? 'accès refusé'));
            }
        }
    }

    public function isConnected(): bool
    {
        return is_resource($this->socket);
    }

    public function disconnect(): void
    {
        if (is_resource($this->socket)) {
            @fclose($this->socket);
        }
        $this->socket = null;
    }

    public function __destruct()
    {
        $this->disconnect();
    }

    /**
     * Exécute une commande et renvoie les lignes (!re) sous forme de tableaux associatifs.
     *
     * $args : ['name' => 'x'] => =name=x ; ['?name' => 'x'] => requête ;
     *         ['.proplist' => 'a,b'] => =.proplist=a,b ; ['count-only' => ''].
     * Si la réponse !done porte =ret=, elle est renvoyée sous la clé 'ret' de la 1re ligne
     * quand il n'y a aucune ligne (cas de "add" et "count-only").
     */
    public function comm(string $cmd, array $args = []): array
    {
        if (!$this->isConnected()) {
            throw new RouterOSException('Non connecté au routeur');
        }
        $words = [$cmd];
        foreach ($args as $k => $v) {
            $k = (string)$k;
            if ($k !== '' && ($k[0] === '?' || $k[0] === '~')) {
                $words[] = $k . '=' . $v;
            } elseif (is_int($k)) {
                $words[] = (string)$v; // mot brut (ex: '?#|')
            } else {
                $words[] = '=' . $k . '=' . $v;
            }
        }
        $this->write($words);
        $rows = [];
        $ret = null;
        foreach ($this->readSentences() as $s) {
            switch ($s['type']) {
                case '!re':
                    $rows[] = $s['attrs'];
                    break;
                case '!trap':
                    // Le !done suit toujours le !trap : on lit tout avant de lever l'erreur.
                    $trap = $s['attrs']['message'] ?? 'Erreur inconnue';
                    break;
                case '!fatal':
                    $this->disconnect();
                    throw new RouterOSException('Erreur fatale : ' . implode(' ', $s['attrs']));
                case '!done':
                    $ret = $s['attrs']['ret'] ?? null;
                    break;
            }
        }
        if (isset($trap)) {
            throw new RouterOSException($trap);
        }
        if (!$rows && $ret !== null) {
            return [['ret' => $ret]];
        }
        return $rows;
    }

    // ---------------------------------------------------------------- bas niveau

    private function write(array $words): void
    {
        $buf = '';
        foreach ($words as $w) {
            $buf .= self::encodeLength(strlen($w)) . $w;
        }
        $buf .= "\0";
        $len = strlen($buf);
        for ($written = 0; $written < $len; $written += $n) {
            $n = @fwrite($this->socket, substr($buf, $written));
            if ($n === false || $n === 0) {
                $this->disconnect();
                throw new RouterOSException("Écriture vers le routeur impossible");
            }
        }
    }

    public static function encodeLength(int $len): string
    {
        if ($len < 0x80) {
            return chr($len);
        }
        if ($len < 0x4000) {
            return pack('n', $len | 0x8000);
        }
        if ($len < 0x200000) {
            $v = $len | 0xC00000;
            return chr(($v >> 16) & 0xFF) . chr(($v >> 8) & 0xFF) . chr($v & 0xFF);
        }
        if ($len < 0x10000000) {
            return pack('N', $len | 0xE0000000);
        }
        return chr(0xF0) . pack('N', $len);
    }

    private function readBytes(int $n): string
    {
        $data = '';
        while (strlen($data) < $n) {
            $chunk = fread($this->socket, $n - strlen($data));
            if ($chunk === false || $chunk === '') {
                $meta = stream_get_meta_data($this->socket);
                $this->disconnect();
                throw new RouterOSException($meta['timed_out'] ? 'Délai dépassé (routeur muet)' : 'Connexion fermée par le routeur');
            }
            $data .= $chunk;
        }
        return $data;
    }

    private function readLength(): int
    {
        $b = ord($this->readBytes(1));
        if (($b & 0x80) === 0) {
            return $b;
        }
        if (($b & 0xC0) === 0x80) {
            return (($b & 0x3F) << 8) | ord($this->readBytes(1));
        }
        if (($b & 0xE0) === 0xC0) {
            $r = $this->readBytes(2);
            return (($b & 0x1F) << 16) | (ord($r[0]) << 8) | ord($r[1]);
        }
        if (($b & 0xF0) === 0xE0) {
            $r = $this->readBytes(3);
            return (($b & 0x0F) << 24) | (ord($r[0]) << 16) | (ord($r[1]) << 8) | ord($r[2]);
        }
        return unpack('N', $this->readBytes(4))[1];
    }

    private function readSentence(): array
    {
        $words = [];
        while (($len = $this->readLength()) > 0) {
            $words[] = $this->readBytes($len);
        }
        $type = array_shift($words) ?? '';
        $attrs = [];
        foreach ($words as $w) {
            if ($w !== '' && $w[0] === '=') {
                $pos = strpos($w, '=', 1);
                if ($pos === false) {
                    $attrs[substr($w, 1)] = '';
                } else {
                    $attrs[substr($w, 1, $pos - 1)] = substr($w, $pos + 1);
                }
            } elseif (strncmp($w, '.tag=', 5) === 0) {
                $attrs['.tag'] = substr($w, 5);
            }
        }
        return ['type' => $type, 'attrs' => $attrs];
    }

    /** Lit jusqu'au !done (ou !fatal) inclus. */
    private function readSentences(): array
    {
        $out = [];
        do {
            $s = $this->readSentence();
            $out[] = $s;
        } while ($s['type'] !== '!done' && $s['type'] !== '!fatal');
        return $out;
    }
}
