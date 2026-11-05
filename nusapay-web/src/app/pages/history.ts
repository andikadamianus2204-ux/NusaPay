import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Tx, WalletApi } from '../core/core';
import { PageHead } from './page-head';
import { TxList } from './tx-list';

type Filter = 'All' | 'In' | 'Out';

@Component({
  selector: 'app-history',
  imports: [TxList, PageHead],
  template: `
    <app-page-head title="Riwayat Transaksi" subtitle="Semua pemasukan dan pengeluaran Anda" />

    <section class="card">
      <div class="tabs">
        @for (f of filters; track f.value) {
          <button class="tab" [class.active]="filter() === f.value" (click)="setFilter(f.value)">{{ f.label }}</button>
        }
      </div>

      <app-tx-list [items]="items()" />

      @if (total() > 0) {
        <div class="pager">
          <button class="btn ghost" [disabled]="page() <= 1" (click)="go(page() - 1)">Sebelumnya</button>
          <span>Halaman {{ page() }} dari {{ totalPages() }}</span>
          <button class="btn ghost" [disabled]="page() >= totalPages()" (click)="go(page() + 1)">Berikutnya</button>
        </div>
      }
    </section>
  `,
})
export class HistoryPage implements OnInit {
  private api = inject(WalletApi);
  filters: { value: Filter; label: string }[] = [
    { value: 'All', label: 'Semua' },
    { value: 'In', label: 'Masuk' },
    { value: 'Out', label: 'Keluar' },
  ];
  pageSize = 10;

  filter = signal<Filter>('All');
  items = signal<Tx[]>([]);
  page = signal(1);
  total = signal(0);
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  ngOnInit() { this.load(); }

  setFilter(f: Filter) { this.filter.set(f); this.page.set(1); this.load(); }
  go(p: number) { this.page.set(p); this.load(); }

  private load() {
    const dir = this.filter() === 'All' ? undefined : (this.filter() as 'In' | 'Out');
    this.api.history(this.page(), this.pageSize, dir).subscribe(r => {
      this.items.set(r.items);
      this.total.set(r.totalCount);
    });
  }
}