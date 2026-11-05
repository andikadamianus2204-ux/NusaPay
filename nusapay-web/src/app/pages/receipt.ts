import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Tx, rupiah } from '../core/core';

@Component({
  selector: 'app-receipt',
  imports: [DatePipe],
  template: `
    <div class="card receipt">
      <div class="check">✓</div>
      <h2>{{ title() }}</h2>
      <div class="r-amount">{{ rupiah(tx().amount) }}</div>

      <dl class="rows">
        <div><dt>Jenis</dt><dd>{{ tx().type === 'TopUp' ? 'Top Up Saldo' : 'Transfer' }}</dd></div>
        @if (tx().type === 'Transfer') {
          <div><dt>Penerima</dt><dd>{{ tx().counterpartyName }}</dd></div>
          <div><dt>Rekening tujuan</dt><dd>{{ tx().counterpartyAccount }}</dd></div>
          @if (tx().note) { <div><dt>Catatan</dt><dd>{{ tx().note }}</dd></div> }
        }
        <div><dt>No. referensi</dt><dd>{{ tx().reference }}</dd></div>
        <div><dt>Waktu</dt><dd>{{ tx().createdAt | date: 'dd MMM yyyy, HH:mm:ss' }}</dd></div>
      </dl>

      <ng-content />
    </div>
  `,
})
export class Receipt {
  tx = input.required<Tx>();
  title = input('Transaksi Berhasil');
  rupiah = rupiah;
}