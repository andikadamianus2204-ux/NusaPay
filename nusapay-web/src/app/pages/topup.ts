import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Tx, WalletApi, errMsg, rupiah } from '../core/core';
import { PageHead } from './page-head';
import { Receipt } from './receipt';

const MIN_TOPUP = 1_000;
const MAX_TOPUP = 2_000_000;

@Component({
  selector: 'app-topup',
  imports: [FormsModule, RouterLink, Receipt, PageHead],
  template: `
    <app-page-head title="Top Up" subtitle="Tambah saldo dompet Anda" />

    @if (receipt(); as r) {
      <app-receipt [tx]="r" title="Top Up Berhasil">
        <div class="actions">
          <a class="btn" routerLink="/">Kembali ke Beranda</a>
          <button class="btn ghost" (click)="reset()">Top up lagi</button>
        </div>
      </app-receipt>
    } @else {
      <section class="card narrow">
        <p class="muted">
          Mode simulasi: tidak ada pembayaran sungguhan. Maksimal {{ rupiah(max) }} per transaksi
          dan Rp5.000.000 per hari.
        </p>

        @if (error()) { <div class="alert err">{{ error() }}</div> }

        <label>Nominal (Rp)</label>
        <input type="number" min="1000" [max]="max" [ngModel]="amount()" (ngModelChange)="amount.set($event)" placeholder="Contoh: 100000" />
        <div class="chips">
          @for (v of quick; track v) { <button class="chip" (click)="amount.set(v)">{{ rupiah(v) }}</button> }
        </div>
        <button class="btn" [disabled]="busy()" (click)="submit()">{{ busy() ? 'Memproses...' : 'Top Up' }}</button>
      </section>
    }
  `,
})
export class TopUpPage {
  private api = inject(WalletApi);
  rupiah = rupiah;
  max = MAX_TOPUP;
  quick = [50_000, 100_000, 500_000, 1_000_000];

  amount = signal<number | null>(null);
  receipt = signal<Tx | null>(null);
  error = signal('');
  busy = signal(false);

  // Idempotency-Key baru dibuat setelah berhasil, jadi kirim ulang tidak membuat transaksi ganda
  private key = crypto.randomUUID();

  submit() {
    const amount = this.amount();
    this.error.set('');
    if (!amount || amount < MIN_TOPUP) return this.error.set('Minimal top up Rp1.000.');
    if (amount > MAX_TOPUP) return this.error.set('Maksimal top up Rp2.000.000 per transaksi.');

    this.busy.set(true);
    this.api.topUp(amount, this.key).subscribe({
      next: t => { this.key = crypto.randomUUID(); this.receipt.set(t); this.busy.set(false); },
      error: e => { this.busy.set(false); this.error.set(errMsg(e)); },
    });
  }

  reset() { this.receipt.set(null); this.amount.set(null); }
}