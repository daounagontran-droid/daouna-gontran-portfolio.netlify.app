import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { ticketsHtml, ticketsText, type PrintOptions, type Ticket } from './vouchers';

export async function printTickets(tickets: Ticket[], o: PrintOptions) {
  await Print.printAsync({ html: ticketsHtml(tickets, o) });
}

export async function shareTicketsPdf(tickets: Ticket[], o: PrintOptions) {
  const { uri } = await Print.printToFileAsync({ html: ticketsHtml(tickets, o) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Partager les tickets' });
}

/** Partage texte : idéal pour envoyer des codes par WhatsApp ou SMS. */
export async function shareTicketsText(tickets: Ticket[], o: PrintOptions) {
  await Share.share({ message: ticketsText(tickets, o) });
}
