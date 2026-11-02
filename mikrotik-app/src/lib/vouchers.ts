import * as Crypto from 'expo-crypto';

import { formatMoney } from './format';
import type { Row } from './mikrotik';

export type CodeStyle = 'digits' | 'letters' | 'mixed';

// Caractères faciles à lire et à taper : pas de 0/O, 1/I/L.
const ALPHABETS: Record<CodeStyle, string> = {
  digits: '23456789',
  letters: 'ABCDEFGHJKMNPQRSTUVWXYZ',
  mixed: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
};

export function randomCode(length: number, style: CodeStyle): string {
  const alphabet = ALPHABETS[style];
  // Rejet des octets hors plage pour éviter tout biais statistique.
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    for (const byte of Crypto.getRandomBytes(length * 2)) {
      if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}

export type TicketMeta = { lot: string; price: number; plan: string };

/** Le commentaire RouterOS garde la trace du lot et du prix pour le suivi des ventes. */
export function ticketComment(meta: TicketMeta): string {
  return `lot=${meta.lot} prix=${meta.price} forfait=${meta.plan.replace(/\s+/g, '_')}`;
}

export function parseTicketComment(comment?: string): TicketMeta | null {
  const m = comment?.match(/lot=(\S+) prix=(\d+) forfait=(\S+)/);
  if (!m) return null;
  return { lot: m[1], price: Number(m[2]), plan: m[3].replace(/_/g, ' ') };
}

export function isTicketUsed(user: Row): boolean {
  return (user.uptime ?? '0s') !== '0s' || Number(user['bytes-in'] ?? 0) > 0;
}

export type Ticket = { name: string; password: string };

export type PrintOptions = {
  title: string;
  plan: string;
  price: number;
  sameCode: boolean;
  ssid?: string;
  loginUrl?: string;
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Page A4 de tickets à découper (4 colonnes). */
export function ticketsHtml(tickets: Ticket[], o: PrintOptions): string {
  const cards = tickets
    .map(
      (t) => `
      <div class="t">
        <div class="h">${escape(o.title)}</div>
        ${o.ssid ? `<div class="s">Wi-Fi : <b>${escape(o.ssid)}</b></div>` : ''}
        ${
          o.sameCode
            ? `<div class="lbl">Code</div><div class="c">${escape(t.name)}</div>`
            : `<div class="lbl">Utilisateur</div><div class="c sm">${escape(t.name)}</div>
               <div class="lbl">Mot de passe</div><div class="c sm">${escape(t.password)}</div>`
        }
        <div class="f"><span>${escape(o.plan)}</span><span>${o.price ? escape(formatMoney(o.price)) : ''}</span></div>
        ${o.loginUrl ? `<div class="u">${escape(o.loginUrl)}</div>` : ''}
      </div>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: -apple-system, Roboto, Arial, sans-serif; margin: 0; color: #0f172a; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
    .t { border: 1.5px dashed #0b1f3a; border-radius: 6px; padding: 3mm; text-align: center; break-inside: avoid; }
    .h { font-weight: 800; font-size: 11pt; color: #0b1f3a; }
    .s { font-size: 8pt; color: #5b6b82; margin-top: 1mm; }
    .lbl { font-size: 7pt; text-transform: uppercase; letter-spacing: .5px; color: #5b6b82; margin-top: 2mm; }
    .c { font-family: 'Courier New', monospace; font-weight: 800; font-size: 16pt; letter-spacing: 2px; }
    .c.sm { font-size: 12pt; }
    .f { display: flex; justify-content: space-between; font-size: 8pt; margin-top: 2mm; border-top: 1px solid #e4e8ef; padding-top: 1mm; }
    .u { font-size: 7pt; color: #5b6b82; margin-top: 1mm; }
  </style></head><body><div class="grid">${cards}</div></body></html>`;
}

export function ticketsText(tickets: Ticket[], o: PrintOptions): string {
  const lines = tickets.map((t) => (o.sameCode ? t.name : `${t.name} / ${t.password}`));
  const header = `${o.title} — ${o.plan}${o.price ? ` — ${formatMoney(o.price)}` : ''}`;
  return [header, ...(o.ssid ? [`Réseau Wi-Fi : ${o.ssid}`] : []), '', ...lines].join('\n');
}
