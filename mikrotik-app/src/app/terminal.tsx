import { useRef, useState } from 'react';
import { ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { colors } from '@/components/theme';
import { Button, Card, Chips, Field, Screen } from '@/components/ui';
import { useApi } from '@/context/RouterContext';

type Mode = 'cli' | 'rest';
type Entry = { input: string; output: string; error?: boolean };

const EXAMPLES: Record<Mode, string[]> = {
  cli: ['/ip address print', '/ip route print', '/interface print', '/ip hotspot active print', '/ping 8.8.8.8 count=3'],
  rest: ['GET /ip/address', 'GET /ip/firewall/filter', 'GET /queue/simple', 'GET /ip/dns'],
};

export default function TerminalScreen() {
  const api = useApi();
  const [mode, setMode] = useState<Mode>('cli');
  const [input, setInput] = useState('');
  const [body, setBody] = useState('');
  const [history, setHistory] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  async function run(command = input) {
    const cmd = command.trim();
    if (!cmd) return;
    setRunning(true);
    let entry: Entry;
    try {
      if (mode === 'cli') {
        entry = { input: cmd, output: (await api.execute(cmd)).trim() || '(aucune sortie)' };
      } else {
        const [method, path] = cmd.includes(' ') ? cmd.split(/\s+/, 2) : ['GET', cmd];
        const payload = body.trim() ? JSON.parse(body) : undefined;
        const result = await api.request(method.toUpperCase(), path.startsWith('/') ? path : `/${path}`, payload);
        entry = { input: cmd, output: JSON.stringify(result, null, 2) ?? '(vide)' };
      }
    } catch (e: any) {
      entry = { input: cmd, output: e?.message ?? String(e), error: true };
    }
    setHistory((h) => [...h.slice(-20), entry]);
    setInput('');
    setRunning(false);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <Screen>
      <Chips
        options={[
          { value: 'cli', label: 'Commande RouterOS' },
          { value: 'rest', label: 'Requête API REST' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Card style={{ backgroundColor: '#0b1220', borderColor: '#0b1220', minHeight: 220 }}>
        <ScrollView ref={scroll} style={{ maxHeight: 380 }} nestedScrollEnabled>
          {history.length === 0 && (
            <Text style={{ color: '#64748b', fontFamily: 'monospace' }}>
              {mode === 'cli'
                ? 'Tapez une commande comme dans le terminal Winbox.\nAttention : les commandes sont exécutées directement sur le routeur.'
                : 'Format : MÉTHODE /chemin (ex. GET /ip/address).\nCorps JSON optionnel pour PUT, PATCH et POST.'}
            </Text>
          )}
          {history.map((h, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.gold, fontFamily: 'monospace' }}>&gt; {h.input}</Text>
              <Text selectable style={{ color: h.error ? '#f87171' : '#e2e8f0', fontFamily: 'monospace', fontSize: 12 }}>
                {h.output}
              </Text>
            </View>
          ))}
        </ScrollView>
      </Card>
      <Field
        label={mode === 'cli' ? 'Commande' : 'Requête'}
        value={input}
        onChangeText={setInput}
        placeholder={EXAMPLES[mode][0]}
        onSubmitEditing={() => run()}
        returnKeyType="send"
      />
      {mode === 'rest' && (
        <Field label="Corps JSON (optionnel)" value={body} onChangeText={setBody} multiline placeholder='{"comment": "test"}' />
      )}
      <Button title="Exécuter" icon="play" loading={running} onPress={() => run()} />
      <Chips
        options={EXAMPLES[mode].map((e) => ({ value: e, label: e }))}
        value={'' as string}
        onChange={(e) => setInput(e)}
      />
    </Screen>
  );
}
