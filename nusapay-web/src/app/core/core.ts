import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpParams } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';

export const API = 'http://localhost:5129/api';

// ---------- Model ----------
export interface User { id: number; fullName: string; email: string; role: string; accountNumber: string; balance: number; }
export interface AuthResponse { token: string; expiresAt: string; user: User; }
export interface Wallet { ownerName: string; accountNumber: string; balance: number; }
export interface Tx {
  id: number; reference: string; type: string; direction: 'In' | 'Out'; amount: number;
  note?: string; counterpartyName?: string; counterpartyAccount?: string; createdAt: string;
}
export interface Paged<T> { items: T[]; page: number; pageSize: number; totalCount: number; }
export interface DaySummary { date: string; income: number; expense: number; }
export interface Summary { days: DaySummary[]; totalIncome: number; totalExpense: number; }

// ---------- Helper ----------
export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export function errMsg(e: unknown): string {
  const err = e as HttpErrorResponse;
  if (err.status === 0) return 'Tidak bisa terhubung ke server. Pastikan backend berjalan.';
  if (err.error?.message) return err.error.message;
  const first = err.error?.errors ? (Object.values(err.error.errors)[0] as string[])?.[0] : null;
  return first ?? 'Terjadi kesalahan.';
}

// ---------- Auth ----------
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly token = signal<string | null>(localStorage.getItem('token'));
  readonly user = signal<User | null>(JSON.parse(localStorage.getItem('user') ?? 'null'));

  login(body: { email: string; password: string }) {
    return this.http.post<AuthResponse>(`${API}/auth/login`, body).pipe(tap(r => this.save(r)));
  }

  register(body: { fullName: string; email: string; password: string }) {
    return this.http.post<AuthResponse>(`${API}/auth/register`, body).pipe(tap(r => this.save(r)));
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.token.set(null);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  private save(r: AuthResponse) {
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    this.token.set(r.token);
    this.user.set(r.user);
  }
}

// ---------- Wallet API ----------
@Injectable({ providedIn: 'root' })
export class WalletApi {
  private http = inject(HttpClient);

  wallet() { return this.http.get<Wallet>(`${API}/wallet`); }

  lookup(account: string) {
    return this.http.get<{ ownerName: string; accountNumber: string }>(`${API}/wallet/lookup/${account}`);
  }

  topUp(amount: number, key: string) {
    return this.http.post<Tx>(`${API}/wallet/topup`, { amount }, { headers: { 'Idempotency-Key': key } });
  }

  transfer(body: { toAccountNumber: string; amount: number; note?: string }, key: string) {
    return this.http.post<Tx>(`${API}/wallet/transfer`, body, { headers: { 'Idempotency-Key': key } });
  }

  // direction: 'In' (uang masuk), 'Out' (uang keluar), kosong = semua
  history(page: number, pageSize = 8, direction?: 'In' | 'Out') {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (direction) params = params.set('direction', direction);
    return this.http.get<Paged<Tx>>(`${API}/transactions`, { params });
  }

  summary(days = 7) {
    return this.http.get<Summary>(`${API}/transactions/summary`, { params: { days } });
  }
}

// ---------- Interceptor: tempel token, logout kalau 401 ----------
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError(e => {
      if (e.status === 401 && !req.url.includes('/auth/')) auth.logout();
      return throwError(() => e);
    })
  );
};

// ---------- Guard: halaman utama hanya untuk yang sudah login ----------
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.token() ? true : router.createUrlTree(['/login']);
};