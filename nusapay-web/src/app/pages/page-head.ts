import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-head',
  imports: [RouterLink],
  template: `
    <div class="page-head">
      <a class="back" routerLink="/" aria-label="Kembali ke Beranda">←</a>
      <div>
        <h2>{{ title() }}</h2>
        @if (subtitle()) { <p class="muted">{{ subtitle() }}</p> }
      </div>
    </div>
  `,
})
export class PageHead {
  title = input.required<string>();
  subtitle = input('');
}