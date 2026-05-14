import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { SharedModule } from 'src/app/theme/shared/shared.module';

interface PartidaMock {
  id: number;
  tipo: string;
  descripcion: string;
  cantidad: number;
  peso: number;
  avaluoReal: number;
  prestamo: number;
  vencimiento: string;
  estatus: string;
}

@Component({
  selector: 'app-avaluo-mock',
  imports: [CommonModule, SharedModule],
  templateUrl: './avaluo-mock.component.html',
  styleUrls: ['./avaluo-mock.component.scss']
})
export class AvaluoMockComponent {
  readonly sucursal = 'Sucursal Centro';
  readonly usuario = 'cajero.demo';
  readonly rol = 'Cajero';
  readonly fechaAbierta = '22/04/2026';

  operacionAbierta = true;
  mensajeFlujo = 'Pantalla lista para demo con cliente.';

  tiposPrenda = ['Alhajas', 'Plata', 'Varios', 'Autos/Motos'];
  tipoSeleccionado = 'Alhajas';

  clienteDemo = {
    folio: 'CLI-000245',
    identificacion: 'INE',
    nombre: 'Maria Fernanda Lopez',
    beneficiario: 'Jose Luis Perez',
    prestamoAcumulado: 8500
  };

  partidas: PartidaMock[] = [
    {
      id: 1,
      tipo: 'Alhajas',
      descripcion: 'Anillo oro 14k con piedra',
      cantidad: 1,
      peso: 6.5,
      avaluoReal: 5900,
      prestamo: 4130,
      vencimiento: '22/05/2026',
      estatus: 'Capturada'
    },
    {
      id: 2,
      tipo: 'Varios',
      descripcion: 'Laptop 14 pulg. marca demo',
      cantidad: 1,
      peso: 1.4,
      avaluoReal: 4200,
      prestamo: 2520,
      vencimiento: '22/05/2026',
      estatus: 'Capturada'
    }
  ];

  get totalPartidas(): number {
    return this.partidas.length;
  }

  get pesoTotal(): number {
    return this.partidas.reduce((acc, item) => acc + item.peso, 0);
  }

  get avaluoTotal(): number {
    return this.partidas.reduce((acc, item) => acc + item.avaluoReal, 0);
  }

  get prestamoTotal(): number {
    return this.partidas.reduce((acc, item) => acc + item.prestamo, 0);
  }

  seleccionarTipo(tipo: string): void {
    this.tipoSeleccionado = tipo;
    this.mensajeFlujo = 'Tipo seleccionado: ' + tipo;
    console.log('[Avaluo Mock] Tipo de prenda:', tipo);
  }

  simularAccion(nombreAccion: string): void {
    this.mensajeFlujo = 'Accion ejecutada: ' + nombreAccion;
    console.log('[Avaluo Mock] Accion:', nombreAccion);
  }

  simularAgregarPartida(): void {
    const nuevaPartida: PartidaMock = {
      id: this.partidas.length + 1,
      tipo: this.tipoSeleccionado,
      descripcion: 'Partida demo agregada desde boton',
      cantidad: 1,
      peso: 2.1,
      avaluoReal: 2500,
      prestamo: 1500,
      vencimiento: '22/05/2026',
      estatus: 'Capturada'
    };

    this.partidas = [...this.partidas, nuevaPartida];
    this.mensajeFlujo = 'Se agrego una partida demo a la tabla.';
    console.log('[Avaluo Mock] Nueva partida:', nuevaPartida);
  }

  simularGenerarContrato(): void {
    this.mensajeFlujo = 'Contrato generado en modo demo.';
    console.log('[Avaluo Mock] Generar contrato');
    alert('Contrato generado (demo).');
  }
}
