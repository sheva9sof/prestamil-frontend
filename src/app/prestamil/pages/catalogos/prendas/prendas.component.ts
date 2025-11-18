// angular import
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-prendas',
  imports: [CommonModule, SharedModule],
  templateUrl: './prendas.component.html',
  styleUrls: ['./prendas.component.scss']
})
export class PrendasComponent {
  constructor() {}
}

