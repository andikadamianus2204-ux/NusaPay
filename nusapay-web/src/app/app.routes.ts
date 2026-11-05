import { Routes } from '@angular/router';
import { authGuard } from './core/core';
import { Login } from './pages/login';
import { Shell } from './pages/shell';
import { Home } from './pages/home';
import { TopUpPage } from './pages/topup';
import { TransferPage } from './pages/transfer';
import { HistoryPage } from './pages/history';
import { InsightPage } from './pages/insight-page';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', component: Home },
      { path: 'topup', component: TopUpPage },
      { path: 'transfer', component: TransferPage },
      { path: 'riwayat', component: HistoryPage },
      { path: 'insight', component: InsightPage },
    ],
  },
  { path: '**', redirectTo: '' },
];