// angular import
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-parametros-prestamo',
  imports: [CommonModule, SharedModule],
  templateUrl: './parametros-prestamo.component.html',
  styleUrls: ['./parametros-prestamo.component.scss']
})
export class ParametrosPrestamoComponent {
  constructor() {}
}

