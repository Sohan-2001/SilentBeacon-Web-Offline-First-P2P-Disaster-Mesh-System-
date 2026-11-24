// SilentBeacon Web NFC Tap-to-Sync Service
import { DistressTicket, GossipMessage } from '../types';

export class NFCService {
  private isSupported: boolean = false;
  private reader: any = null;
  private isScanning: boolean = false;
  private onTicketReceived?: (ticket: DistressTicket) => void;

  constructor(onTicketReceived?: (ticket: DistressTicket) => void) {
    this.onTicketReceived = onTicketReceived;
    this.isSupported = typeof window !== 'undefined' && 'NDEFReader' in window;
  }

  public checkSupport(): boolean {
    return this.isSupported;
  }

  /**
   * Starts NFC scanning for Android devices
   */
  public async startScan(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Web NFC not supported in this browser.');
      return false;
    }

    try {
      const NDEFReaderClass = (window as any).NDEFReader;
      this.reader = new NDEFReaderClass();
      await this.reader.scan();
      this.isScanning = true;

      this.reader.addEventListener('reading', ({ message }: any) => {
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding);
            const text = textDecoder.decode(record.data);
            try {
              const data = JSON.parse(text);
              if (data.type === 'DISTRESS_TICKET' && data.ticket && this.onTicketReceived) {
                this.onTicketReceived(data.ticket);
              }
            } catch (e) {
              console.error('Failed to parse NFC text data:', e);
            }
          }
        }
      });

      return true;
    } catch (err) {
      console.error('NFC scan error:', err);
      this.isScanning = false;
      return false;
    }
  }

  /**
   * Writes a ticket to an NFC tag or peer device tap
   */
  public async writeTicket(ticket: DistressTicket): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      const NDEFReaderClass = (window as any).NDEFReader;
      const writer = new NDEFReaderClass();
      const payload = JSON.stringify({
        type: 'DISTRESS_TICKET',
        ticket
      });

      await writer.write({
        records: [{ recordType: 'text', data: payload }]
      });
      return true;
    } catch (err) {
      console.error('NFC write error:', err);
      return false;
    }
  }

  public stop(): void {
    this.isScanning = false;
    this.reader = null;
  }
}
