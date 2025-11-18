// angular import
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-parametros-generales',
  imports: [CommonModule, SharedModule],
  templateUrl: './parametros-generales.component.html',
  styleUrls: ['./parametros-generales.component.scss']
})
export class ParametrosGeneralesComponent {
  constructor() {}
}

