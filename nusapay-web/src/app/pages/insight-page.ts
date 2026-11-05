import { Component } from '@angular/core';
import { PageHead } from './page-head';
import { Insights } from './insights';

@Component({
  selector: 'app-insight-page',
  imports: [PageHead, Insights],
  template: `
    <app-page-head title="Insight Keuangan" subtitle="Analisis otomatis dari transaksi 14 hari terakhir" />
    <app-insights />
  `,
})
export class InsightPage {}