import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Tx, rupiah } from '../core/core';

@Component({
  selector: 'app-tx-list',
  imports: [DatePipe],
  template: `
    @if (items().length === 0) {
      <p class="muted">Belum ada transaksi.</p>
    } @else {
      <div class="table-wrap">
        <table>
          <thead><tr><th>Waktu</th><th>Keterangan</th><th>Referensi</th><th class="r">Nominal</th></tr></thead>
          <tbody>
            @for (t of items(); track t.id) {
              <tr>
                <td>{{ t.createdAt | date: 'dd MMM yyyy, HH:mm' }}</td>
                <td>
                  @if (t.type === 'TopUp') { Top up saldo }
                  @else if (t.direction === 'Out') { Transfer ke {{ t.counterpartyName }} }
                  @else { Transfer dari {{ t.counterpartyName }} }
                  @if (t.note && t.type !== 'TopUp') { <div class="sub">{{ t.note }}</div> }
                </td>
                <td class="mono">{{ t.reference }}</td>
                <td class="r" [class.pos]="t.direction === 'In'" [class.neg]="t.direction === 'Out'">
                  {{ t.direction === 'In' ? '+' : '-' }}{{ rupiah(t.amount) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class TxList {
  items = input.required<Tx[]>();
  rupiah = rupiah;
}