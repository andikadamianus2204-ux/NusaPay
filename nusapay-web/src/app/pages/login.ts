import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, errMsg } from '../core/core';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="logo">Nusa<span>Pay</span></div>
        <p class="muted">{{ mode() === 'login' ? 'Masuk ke dompet digital Anda' : 'Buat akun dan dompet baru' }}</p>

        @if (error()) { <div class="alert err">{{ error() }}</div> }

        @if (mode() === 'register') {
          <label>Nama lengkap</label>
          <input [ngModel]="name()" (ngModelChange)="name.set($event)" placeholder="Nama lengkap" />
        }
        <label>Email</label>
        <input type="email" [ngModel]="email()" (ngModelChange)="email.set($event)" placeholder="email@contoh.com" />
        <label>Password</label>
        <input type="password" [ngModel]="password()" (ngModelChange)="password.set($event)"
               placeholder="Minimal 8 karakter" (keyup.enter)="submit()" />

        <button class="btn" [disabled]="busy()" (click)="submit()">
          {{ busy() ? 'Memproses...' : (mode() === 'login' ? 'Masuk' : 'Daftar') }}
        </button>

        <p class="switch">
          @if (mode() === 'login') {
            Belum punya akun? <a (click)="toggle()">Daftar</a>
          } @else {
            Sudah punya akun? <a (click)="toggle()">Masuk</a>
          }
        </p>
      </div>
    </div>
  `,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<'login' | 'register'>('login');
  name = signal('');
  email = signal('');
  password = signal('');
  error = signal('');
  busy = signal(false);

  toggle() {
    this.mode.update(m => (m === 'login' ? 'register' : 'login'));
    this.error.set('');
  }

  submit() {
    this.error.set('');
    this.busy.set(true);

    const request$ = this.mode() === 'login'
      ? this.auth.login({ email: this.email(), password: this.password() })
      : this.auth.register({ fullName: this.name(), email: this.email(), password: this.password() });

    request$.subscribe({
      next: () => { this.busy.set(false); this.router.navigate(['/']); },
      error: e => { this.busy.set(false); this.error.set(errMsg(e)); },
    });
  }
}