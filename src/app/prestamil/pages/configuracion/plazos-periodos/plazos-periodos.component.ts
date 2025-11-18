// angular import
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-plazos-periodos',
  imports: [CommonModule, SharedModule],
  templateUrl: './plazos-periodos.component.html',
  styleUrls: ['./plazos-periodos.component.scss']
})
export class PlazosPeriodosComponent {
  constructor() {}
}

