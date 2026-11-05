import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Summary, Tx, Wallet, WalletApi, rupiah } from '../core/core';

interface Insight { icon: string; tone: 'good' | 'warn' | 'info'; title: string; text: string; }

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

@Component({
  selector: 'app-insights',
  imports: [RouterLink],
  template: `
    <section class="card insights">
      <div class="row-between">
        <h3>✨ Insight Keuangan</h3>
        @if (limit() > 0) { <a class="link" routerLink="/insight">Lihat semua</a> }
      </div>

      @if (loading()) {
        <p class="muted">Menganalisis transaksi Anda...</p>
      } @else if (failed()) {
        <p class="muted">Insight belum bisa dimuat. Coba muat ulang halaman.</p>
      } @else {
        @if (stats(); as s) {
          <div class="stats">
            <div class="stat">
              <div class="s-lab">Pengeluaran 7 hari</div>
              <div class="s-val neg">{{ rupiah(s.curExp) }}</div>
              @if (s.trend !== null) {
                <div class="s-trend" [class.up]="s.trend > 0" [class.down]="s.trend < 0">
                  {{ s.trend > 0 ? '▲' : s.trend < 0 ? '▼' : '●' }} {{ s.trendAbs }}% vs minggu lalu
                </div>
              }
            </div>
            <div class="stat">
              <div class="s-lab">Pemasukan 7 hari</div>
              <div class="s-val pos">{{ rupiah(s.curInc) }}</div>
            </div>
            <div class="stat">
              <div class="s-lab">Rata-rata pengeluaran/hari</div>
              <div class="s-val">{{ rupiah(s.avg) }}</div>
            </div>
          </div>

          @if (s.ratio !== null) {
            <div class="ratio">
              <div class="row-between"><span class="s-lab">Rasio sisa dana minggu ini</span><b>{{ s.ratio }}%</b></div>
              <div class="bar"><div class="fill" [style.width.%]="s.ratio"></div></div>
            </div>
          }
        }

        <ul class="insight-list">
          @for (i of insights(); track $index) {
            <li class="insight" [class.good]="i.tone === 'good'" [class.warn]="i.tone === 'warn'">
              <span class="i-ico">{{ i.icon }}</span>
              <div>
                <div class="i-title">{{ i.title }}</div>
                <div class="i-text">{{ i.text }}</div>
              </div>
            </li>
          }
        </ul>

        <p class="foot">Dihitung otomatis dari transaksi 14 hari terakhir dengan aturan sederhana.</p>
      }
    </section>
  `,
})
export class Insights implements OnInit {
  private api = inject(WalletApi);
  rupiah = rupiah;

  // 0 = tampilkan semua insight, angka lain = batasi jumlahnya
  limit = input(0);

  loading = signal(true);
  failed = signal(false);
  wallet = signal<Wallet | null>(null);
  summary = signal<Summary | null>(null);
  txs = signal<Tx[]>([]);

  stats = computed(() => {
    const days = this.summary()?.days ?? [];
    if (days.length < 14) return null;

    const prev = days.slice(0, 7);
    const cur = days.slice(7);
    const curExp = sum(cur.map(d => d.expense));
    const prevExp = sum(prev.map(d => d.expense));
    const curInc = sum(cur.map(d => d.income));
    const trend = prevExp > 0 ? Math.round(((curExp - prevExp) / prevExp) * 100) : null;
    const ratio = curInc > 0 ? Math.max(0, Math.min(100, Math.round(((curInc - curExp) / curInc) * 100))) : null;

    return {
      cur, curExp, prevExp, curInc,
      avg: curExp / 7,
      trend,
      trendAbs: trend === null ? 0 : Math.abs(trend),
      ratio,
    };
  });

  insights = computed<Insight[]>(() => {
    const s = this.stats();
    if (!s) return [];

    if (this.txs().length === 0) {
      return [{ icon: '🌱', tone: 'info', title: 'Belum cukup data',
        text: 'Lakukan top up atau transfer untuk mulai melihat analisis keuangan Anda.' }];
    }

    const list: Insight[] = [];

    // 1. Tren pengeluaran
    if (s.curExp > 0 && s.prevExp === 0) {
      list.push({ icon: '📊', tone: 'info', title: 'Pengeluaran minggu ini',
        text: `Anda mengeluarkan ${rupiah(s.curExp)} dalam 7 hari terakhir. Minggu lalu belum ada pengeluaran sebagai pembanding.` });
    } else if (s.trend !== null) {
      if (s.trend > 10) {
        list.push({ icon: '📈', tone: 'warn', title: `Pengeluaran naik ${s.trendAbs}%`,
          text: `Minggu ini ${rupiah(s.curExp)}, naik dari ${rupiah(s.prevExp)} minggu lalu.` });
      } else if (s.trend < -10) {
        list.push({ icon: '📉', tone: 'good', title: `Pengeluaran turun ${s.trendAbs}%`,
          text: `Minggu ini ${rupiah(s.curExp)}, turun dari ${rupiah(s.prevExp)} minggu lalu. Bagus!` });
      } else {
        list.push({ icon: '⚖️', tone: 'info', title: 'Pengeluaran stabil',
          text: `Pengeluaran minggu ini ${rupiah(s.curExp)}, relatif sama dengan minggu lalu.` });
      }
    }

    // 2. Arus kas
    if (s.curInc > 0 || s.curExp > 0) {
      const net = s.curInc - s.curExp;
      list.push(net >= 0
        ? { icon: '💚', tone: 'good', title: 'Arus kas positif',
            text: `Pemasukan minggu ini melebihi pengeluaran sebesar ${rupiah(net)}.` }
        : { icon: '⚠️', tone: 'warn', title: 'Pengeluaran melebihi pemasukan',
            text: `Minggu ini pengeluaran lebih besar ${rupiah(Math.abs(net))} dari pemasukan.` });
    }

    // 3. Estimasi saldo cukup berapa hari
    const balance = this.wallet()?.balance ?? 0;
    if (s.avg > 0) {
      const runway = Math.floor(balance / s.avg);
      list.push({
        icon: '⏳', tone: runway < 7 ? 'warn' : 'info', title: 'Estimasi saldo',
        text: `Dengan rata-rata pengeluaran ${rupiah(s.avg)} per hari, saldo Anda cukup sekitar ${runway} hari.`,
      });
    }

    // 4. Hari paling boros
    const top = s.cur.filter(d => d.expense > 0).sort((a, b) => b.expense - a.expense)[0];
    if (top) {
      const label = new Date(top.date + 'T00:00:00')
        .toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
      list.push({ icon: '🔥', tone: 'info', title: 'Hari paling boros',
        text: `${label}, dengan pengeluaran ${rupiah(top.expense)}.` });
    }

    // 5. Penerima favorit
    const out = this.txs().filter(t => t.type === 'Transfer' && t.direction === 'Out' && t.counterpartyName);
    if (out.length > 0) {
      const map = new Map<string, { n: number; total: number }>();
      for (const t of out) {
        const m = map.get(t.counterpartyName!) ?? { n: 0, total: 0 };
        m.n++;
        m.total += t.amount;
        map.set(t.counterpartyName!, m);
      }
      const [name, v] = [...map.entries()].sort((a, b) => b[1].n - a[1].n || b[1].total - a[1].total)[0];
      list.push({ icon: '👥', tone: 'info', title: 'Penerima favorit',
        text: `Anda paling sering transfer ke ${name}: ${v.n} kali dengan total ${rupiah(v.total)}.` });
    }

    if (list.length === 0) {
      list.push({ icon: '💤', tone: 'info', title: 'Belum ada aktivitas',
        text: 'Tidak ada transaksi dalam 14 hari terakhir.' });
    }

    const n = this.limit();
    return n > 0 ? list.slice(0, n) : list;
  });

  ngOnInit() {
    forkJoin({
      wallet: this.api.wallet(),
      summary: this.api.summary(14),
      history: this.api.history(1, 50),
    }).subscribe({
      next: r => {
        this.wallet.set(r.wallet);
        this.summary.set(r.summary);
        this.txs.set(r.history.items);
        this.loading.set(false);
      },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }
}