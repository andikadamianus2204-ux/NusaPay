import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Tx, Wallet, WalletApi, errMsg, rupiah } from '../core/core';
import { PageHead } from './page-head';
import { Receipt } from './receipt';

@Component({
  selector: 'app-transfer',
  imports: [FormsModule, RouterLink, Receipt, PageHead],
  template: `
    <app-page-head title="Transfer" subtitle="Kirim saldo ke rekening NusaPay lain" />

    @if (receipt(); as r) {
      <app-receipt [tx]="r" title="Transfer Berhasil">
        <div class="actions">
          <a class="btn" routerLink="/">Selesai</a>
          <button class="btn ghost" (click)="reset()">Transfer lagi</button>
        </div>
      </app-receipt>
    } @else if (step() === 'confirm') {
      <section class="card narrow">
        <h3>Konfirmasi Transfer</h3>
        <p class="muted">Periksa kembali data berikut sebelum mengirim.</p>
        @if (error()) { <div class="alert err">{{ error() }}</div> }

        <dl class="rows">
          <div><dt>Penerima</dt><dd>{{ recipient() }}</dd></div>
          <div><dt>Rekening tujuan</dt><dd>{{ toAcc() }}</dd></div>
          <div><dt>Nominal</dt><dd>{{ rupiah(amount() ?? 0) }}</dd></div>
          @if (note()) { <div><dt>Catatan</dt><dd>{{ note() }}</dd></div> }
        </dl>

        <!-- Nanti: kolom input PIN ditambahkan di sini -->

        <div class="actions row">
          <button class="btn ghost" [disabled]="busy()" (click)="step.set('form')">Kembali</button>
          <button class="btn" [disabled]="busy()" (click)="submit()">{{ busy() ? 'Mengirim...' : 'Ya, Kirim' }}</button>
        </div>
      </section>
    } @else {
      <section class="card narrow">
        <p class="muted">Saldo tersedia: <b>{{ rupiah(wallet()?.balance ?? 0) }}</b></p>
        @if (error()) { <div class="alert err">{{ error() }}</div> }

        <label>Nomor rekening tujuan</label>
        <input [ngModel]="toAcc()" (ngModelChange)="toAcc.set($event)" (blur)="hint()" placeholder="10 digit nomor rekening" />
        @if (hintText()) { <div class="hint">{{ hintText() }}</div> }

        <label>Nominal (Rp)</label>
        <input type="number" min="1000" [ngModel]="amount()" (ngModelChange)="amount.set($event)" placeholder="Minimal 1.000" />

        <label>Catatan (opsional)</label>
        <input [ngModel]="note()" (ngModelChange)="note.set($event)" maxlength="200" placeholder="Contoh: Bayar makan" />

        <button class="btn" [disabled]="busy()" (click)="next()">{{ busy() ? 'Memeriksa...' : 'Lanjut' }}</button>
      </section>
    }
  `,
})
export class TransferPage implements OnInit {
  private api = inject(WalletApi);
  rupiah = rupiah;

  wallet = signal<Wallet | null>(null);
  step = signal<'form' | 'confirm'>('form');
  toAcc = signal('');
  amount = signal<number | null>(null);
  note = signal('');
  recipient = signal('');
  hintText = signal('');
  receipt = signal<Tx | null>(null);
  error = signal('');
  busy = signal(false);

  private key = crypto.randomUUID();

  ngOnInit() { this.api.wallet().subscribe(w => this.wallet.set(w)); }

  hint() {
    const acc = this.toAcc().trim();
    if (acc.length < 5) { this.hintText.set(''); return; }
    this.api.lookup(acc).subscribe({
      next: r => this.hintText.set('Penerima: ' + r.ownerName),
      error: () => this.hintText.set('Nomor rekening tidak ditemukan'),
    });
  }

  next() {
    this.error.set('');
    const acc = this.toAcc().trim();
    const amount = this.amount();

    if (!acc) return this.error.set('Isi nomor rekening tujuan.');
    if (!amount || amount < 1000) return this.error.set('Minimal transfer Rp1.000.');
    if (acc === this.wallet()?.accountNumber) return this.error.set('Tidak bisa transfer ke rekening sendiri.');
    if (amount > (this.wallet()?.balance ?? 0)) return this.error.set('Saldo tidak cukup.');

    this.busy.set(true);
    this.api.lookup(acc).subscribe({
      next: r => { this.recipient.set(r.ownerName); this.busy.set(false); this.step.set('confirm'); },
      error: e => { this.busy.set(false); this.error.set(errMsg(e)); },
    });
  }

  submit() {
    this.error.set('');
    this.busy.set(true);
    this.api.transfer(
      { toAccountNumber: this.toAcc().trim(), amount: this.amount()!, note: this.note() || undefined },
      this.key,
    ).subscribe({
      next: t => { this.key = crypto.randomUUID(); this.busy.set(false); this.receipt.set(t); },
      error: e => { this.busy.set(false); this.error.set(errMsg(e)); },
    });
  }

  reset() {
    this.receipt.set(null);
    this.step.set('form');
    this.toAcc.set(''); this.amount.set(null); this.note.set('');
    this.recipient.set(''); this.hintText.set(''); this.error.set('');
    this.api.wallet().subscribe(w => this.wallet.set(w));
  }
}