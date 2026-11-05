import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/core';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="topbar">
      <a routerLink="/" class="logo">Nusa<span>Pay</span></a>
      <div class="who">
        <span class="avatar">{{ initial() }}</span>
        <span class="hide-sm">{{ auth.user()?.fullName }}</span>
        <button class="btn ghost" (click)="auth.logout()">Keluar</button>
      </div>
    </header>

    <main class="container"><router-outlet /></main>
  `,
})
export class Shell {
  auth = inject(AuthService);
  initial = () => (this.auth.user()?.fullName ?? '?').charAt(0).toUpperCase();
}