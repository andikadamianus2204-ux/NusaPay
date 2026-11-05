import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, Summary, Tx, Wallet, WalletApi, rupiah } from '../core/core';
import { Insights } from './insights';

interface Service { label: string; icon: string; color: string; link?: string; }
interface Notif { icon: string; tone: 'in' | 'out' | 'info'; title: string; text: string; time?: string; }

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'Baru saja';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, Insights],
  template: `
    <div class="greet">
      <h2>{{ greeting }}, {{ firstName() }}</h2>
      <p class="muted">{{ today }}</p>
    </div>

    <!-- Kartu saldo -->
    <section class="balance">
      <div>
        <div class="bal-head">
          <span class="muted-light">Saldo Anda</span>
          <button class="icon-btn" (click)="hidden.set(!hidden())"
                  [attr.aria-label]="hidden() ? 'Tampilkan saldo' : 'Sembunyikan saldo'">
            {{ hidden() ? '🙈' : '👁️' }}
          </button>
        </div>
        <div class="amount">{{ hidden() ? 'Rp ••••••' : rupiah(wallet()?.balance ?? 0) }}</div>
      </div>
      <div class="acc">
        <div class="muted-light">Nomor rekening</div>
        <div class="accno">{{ wallet()?.accountNumber }}</div>
        <button class="copy" (click)="copy()">{{ copied() ? 'Tersalin ✓' : 'Salin' }}</button>
      </div>
    </section>

    <!-- Menu layanan: klik ikon untuk pindah halaman -->
    <section class="card">
      <h3>Layanan</h3>
      <div class="services">
        @for (s of services; track s.label) {
          @if (s.link) {
            <a class="service" [routerLink]="s.link">
              <span class="s-ico" [style.background]="s.color">{{ s.icon }}</span>
              <span class="s-label">{{ s.label }}</span>
            </a>
          } @else {
            <div class="service soon">
              <span class="s-ico" [style.background]="s.color">{{ s.icon }}</span>
              <span class="s-label">{{ s.label }}</span>
              <span class="badge">Segera</span>
            </div>
          }
        }
      </div>
    </section>

    <!-- Banner info -->
    <div class="promos">
      @for (p of promos; track p.title) {
        <div class="promo" [style.background]="p.bg">
          <div class="p-ico">{{ p.icon }}</div>
          <div>
            <div class="p-title">{{ p.title }}</div>
            <div class="p-text">{{ p.text }}</div>
          </div>
        </div>
      }
    </div>

    <!-- Insight keuangan (ringkas, 3 teratas) -->
    <app-insights [limit]="3" />

    <div class="two-col">
      <!-- Pemberitahuan -->
      <section class="card">
        <div class="row-between">
          <h3>Pemberitahuan</h3>
          <a class="link" routerLink="/riwayat">Semua riwayat</a>
        </div>
        <ul class="notifs">
          @for (n of notifs(); track $index) {
            <li class="notif">
              <span class="n-ico" [class.in]="n.tone === 'in'" [class.out]="n.tone === 'out'">{{ n.icon }}</span>
              <div class="n-body">
                <div class="n-title">{{ n.title }}</div>
                <div class="n-text">{{ n.text }}</div>
              </div>
              @if (n.time) { <span class="n-time">{{ n.time }}</span> }
            </li>
          }
        </ul>
      </section>

      <!-- Grafik -->
      <section class="card">
        <h3>Ringkasan 7 Hari</h3>
        <div class="legend">
          <i class="dot in first"></i> Masuk {{ rupiah(summary()?.totalIncome ?? 0) }}
          <i class="dot out"></i> Keluar {{ rupiah(summary()?.totalExpense ?? 0) }}
        </div>
        <svg viewBox="0 0 700 210" class="chart" role="img" aria-label="Grafik pemasukan dan pengeluaran 7 hari">
          <line x1="10" y1="170" x2="690" y2="170" stroke="#d5dbe6" />
          @for (b of chart(); track b.label) {
            <rect [attr.x]="b.x" [attr.y]="170 - b.inH" width="26" [attr.height]="b.inH" rx="4" fill="#16a37f" />
            <rect [attr.x]="b.x + 30" [attr.y]="170 - b.outH" width="26" [attr.height]="b.outH" rx="4" fill="#e5484d" />
            <text [attr.x]="b.x + 28" y="192" text-anchor="middle" font-size="12" fill="#6b7686">{{ b.label }}</text>
          }
        </svg>
      </section>
    </div>
  `,
})
export class Home implements OnInit {
  private api = inject(WalletApi);
  private auth = inject(AuthService);
  rupiah = rupiah;

  wallet = signal<Wallet | null>(null);
  summary = signal<Summary | null>(null);
  recent = signal<Tx[]>([]);
  hidden = signal(false);
  copied = signal(false);

  firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0]);

  greeting = (() => {
    const h = new Date().getHours();
    return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  })();
  today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  services: Service[] = [
    { label: 'Top Up',   icon: '💰', color: 'linear-gradient(135deg,#1b5cff,#5b8cff)', link: '/topup' },
    { label: 'Transfer', icon: '💸', color: 'linear-gradient(135deg,#16a37f,#4cd1a8)', link: '/transfer' },
    { label: 'Riwayat',  icon: '🧾', color: 'linear-gradient(135deg,#f59f00,#ffc94d)', link: '/riwayat' },
    { label: 'Insight',  icon: '✨', color: 'linear-gradient(135deg,#7048e8,#9775fa)', link: '/insight' },
    { label: 'QRIS',     icon: '📷', color: 'linear-gradient(135deg,#495057,#868e96)' },
    { label: 'Pulsa',    icon: '📱', color: 'linear-gradient(135deg,#e5484d,#ff8787)' },
    { label: 'Listrik',  icon: '⚡', color: 'linear-gradient(135deg,#fab005,#ffd43b)' },
    { label: 'Internet', icon: '🌐', color: 'linear-gradient(135deg,#0c8599,#3bc9db)' },
  ];

  promos = [
    { icon: '⚡', title: 'Transfer antar rekening', text: 'Kirim saldo ke sesama pengguna NusaPay dengan nomor rekening.',
      bg: 'linear-gradient(135deg,#1b5cff,#6a8dff)' },
    { icon: '📊', title: 'Pantau keuangan', text: 'Lihat pemasukan dan pengeluaran 7 hari terakhir di grafik.',
      bg: 'linear-gradient(135deg,#16a37f,#4cd1a8)' },
    { icon: '🛡️', title: 'Akun terlindungi', text: 'Password disimpan terenkripsi dan setiap transfer aman dari saldo ganda.',
      bg: 'linear-gradient(135deg,#7048e8,#9775fa)' },
  ];

  notifs = computed<Notif[]>(() => {
    const list = this.recent().slice(0, 4).map((t): Notif => {
      const time = timeAgo(t.createdAt);
      if (t.type === 'TopUp')
        return { icon: '💰', tone: 'in', title: 'Top up berhasil', text: `Saldo bertambah ${rupiah(t.amount)}`, time };
      if (t.direction === 'In')
        return { icon: '📥', tone: 'in', title: 'Transfer masuk', text: `${rupiah(t.amount)} dari ${t.counterpartyName}`, time };
      return { icon: '📤', tone: 'out', title: 'Transfer terkirim', text: `${rupiah(t.amount)} ke ${t.counterpartyName}`, time };
    });
    if (list.length === 0)
      list.push({ icon: '🎉', tone: 'info', title: 'Selamat datang di NusaPay', text: 'Mulai dengan top up saldo pertama Anda.' });
    list.push({ icon: '🔒', tone: 'info', title: 'Tips keamanan',
      text: 'Jangan bagikan password kepada siapa pun dan selalu periksa nama penerima sebelum transfer.' });
    return list;
  });

  chart = computed(() => {
    const days = this.summary()?.days ?? [];
    const max = Math.max(1, ...days.flatMap(d => [d.income, d.expense]));
    return days.map((d, i) => ({
      label: d.date.slice(5).split('-').reverse().join('/'),
      x: 20 + i * 96,
      inH: (d.income / max) * 150,
      outH: (d.expense / max) * 150,
    }));
  });

  ngOnInit() {
    this.api.wallet().subscribe(w => this.wallet.set(w));
    this.api.summary(7).subscribe(s => this.summary.set(s));
    this.api.history(1, 5).subscribe(r => this.recent.set(r.items));
  }

  copy() {
    const acc = this.wallet()?.accountNumber;
    if (!acc) return;
    navigator.clipboard?.writeText(acc).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }
}