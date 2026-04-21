// angular import
import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';

interface DireccionResponse {
  id?: number;
  tipoDireccion: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  referencias: string;
  esVerificada: boolean;
  fechaRegistro?: string;
}

interface ClienteResponse {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono: string;
  email: string;
  curp: string;
  nombreCompleto: string;
  rfc: string;
  activo: boolean;
  direccion: DireccionResponse;
}

const MOCK_CLIENTES: ClienteResponse[] = [
  {
    id: 1,
    nombre: 'Juan Carlos',
    apellidoPaterno: 'García',
    apellidoMaterno: 'Ortiz',
    telefono: '5512345678',
    email: 'juan.garcia@email.com',
    curp: 'GAOJ850315HDFRCN05',
    rfc: 'GAOJ850315AB3',
    nombreCompleto: 'Juan Carlos García Ortiz',
    activo: true,
    direccion: {
      id: 1,
      tipoDireccion: 'Casa',
      calle: 'Av. Insurgentes Sur',
      numeroExterior: '123',
      numeroInterior: 'A',
      colonia: 'Del Valle',
      ciudad: 'Ciudad de México',
      estado: 'CDMX',
      codigoPostal: '03100',
      referencias: 'Frente al parque',
      esVerificada: true,
      fechaRegistro: '2025-01-15'
    }
  },
  {
    id: 2,
    nombre: 'María Elena',
    apellidoPaterno: 'Martínez',
    apellidoMaterno: 'Ramos',
    telefono: '3398765432',
    email: 'maria.martinez@email.com',
    curp: 'MARM920820MJCRTL08',
    rfc: 'MARM920820GH5',
    nombreCompleto: 'María Elena Martínez Ramos',
    activo: false,
    direccion: {
      id: 2,
      tipoDireccion: 'Casa',
      calle: 'Calle Madero',
      numeroExterior: '45',
      numeroInterior: '',
      colonia: 'Centro',
      ciudad: 'Guadalajara',
      estado: 'Jalisco',
      codigoPostal: '44100',
      referencias: '',
      esVerificada: false,
      fechaRegistro: '2025-03-20'
    }
  }
];

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss']
})
export class ClientesComponent implements OnInit {
  @ViewChild('clienteModal') clienteModalTemplate!: TemplateRef<any>;

  filtroNombre: string = '';
  filtroTelefono: string = '';
  filtroEmail: string = '';
  filtroSoloActivos: boolean = false;

  clientes: ClienteResponse[] = [...MOCK_CLIENTES];
  clientesFiltrados: ClienteResponse[] = [];

  // Paginación
  paginaActual = 1;
  itemsPorPagina = 10;
  totalPaginas = 0;

  // Modal
  clienteModalRef: NgbModalRef | null = null;
  isEditingCliente = false;
  idEdicion: number | null = null;
  modalError = '';
  isLoadingGuardar = false;
  private nextId = MOCK_CLIENTES.length + 1;

  formData = this.emptyForm();

  Math = Math;

  constructor(private modalService: NgbModal) {}

  ngOnInit(): void {
    this.aplicarFiltros();
  }

  onFiltroChange(): void {
    this.paginaActual = 1;
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    let filtrados = this.clientes;

    if (this.filtroNombre.trim()) {
      const q = this.filtroNombre.toLowerCase().trim();
      filtrados = filtrados.filter(c => c.nombreCompleto.toLowerCase().includes(q));
    }

    if (this.filtroTelefono.trim()) {
      filtrados = filtrados.filter(c => c.telefono.includes(this.filtroTelefono.trim()));
    }

    if (this.filtroEmail.trim()) {
      const q = this.filtroEmail.toLowerCase().trim();
      filtrados = filtrados.filter(c => c.email.toLowerCase().includes(q));
    }

    if (this.filtroSoloActivos) {
      filtrados = filtrados.filter(c => c.activo);
    }

    this.clientesFiltrados = filtrados;
    this.calcularPaginacion();
  }

  calcularPaginacion(): void {
    this.totalPaginas = Math.ceil(this.clientesFiltrados.length / this.itemsPorPagina);
    if (this.paginaActual > this.totalPaginas && this.totalPaginas > 0) {
      this.paginaActual = 1;
    }
  }

  get clientesPaginados(): ClienteResponse[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.clientesFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  getPaginas(): number[] {
    const paginas: number[] = [];
    const max = 5;
    if (this.totalPaginas <= max) {
      for (let i = 1; i <= this.totalPaginas; i++) paginas.push(i);
    } else {
      let inicio = Math.max(1, this.paginaActual - 2);
      const fin = Math.min(this.totalPaginas, inicio + max - 1);
      if (fin - inicio < max - 1) inicio = Math.max(1, fin - max + 1);
      for (let i = inicio; i <= fin; i++) paginas.push(i);
    }
    return paginas;
  }

  abrirModalNuevo(): void {
    this.isEditingCliente = false;
    this.idEdicion = null;
    this.modalError = '';
    this.formData = this.emptyForm();
    this.clienteModalRef = this.modalService.open(this.clienteModalTemplate, {
      backdrop: 'static',
      keyboard: false,
      centered: true,
      size: 'xl',
      windowClass: 'edit-modal'
    });
  }

  editarCliente(c: ClienteResponse): void {
    this.isEditingCliente = true;
    this.idEdicion = c.id;
    this.modalError = '';
    this.formData = {
      nombre: c.nombre,
      apellidoPaterno: c.apellidoPaterno,
      apellidoMaterno: c.apellidoMaterno,
      telefono: c.telefono,
      email: c.email,
      curp: c.curp,
      rfc: c.rfc,
      activo: c.activo,
      tipoDireccion: c.direccion.tipoDireccion,
      calle: c.direccion.calle,
      numeroExterior: c.direccion.numeroExterior,
      numeroInterior: c.direccion.numeroInterior,
      colonia: c.direccion.colonia,
      ciudad: c.direccion.ciudad,
      estado: c.direccion.estado,
      codigoPostal: c.direccion.codigoPostal,
      referencias: c.direccion.referencias,
      esVerificada: c.direccion.esVerificada
    };
    this.clienteModalRef = this.modalService.open(this.clienteModalTemplate, {
      backdrop: 'static',
      keyboard: false,
      centered: true,
      size: 'xl',
      windowClass: 'edit-modal'
    });
  }

  closeModal(): void {
    this.clienteModalRef?.close();
    this.clienteModalRef = null;
    this.modalError = '';
    this.formData = this.emptyForm();
  }

  guardarCliente(): void {
    const { nombre, apellidoPaterno, apellidoMaterno, telefono, email, curp, rfc, calle, colonia, ciudad, estado, codigoPostal } = this.formData;

    if (!nombre.trim() || !apellidoPaterno.trim() || !telefono.trim() || !curp.trim() || !rfc.trim()) {
      this.modalError = 'Por favor complete los campos obligatorios de datos personales.';
      return;
    }
    if (!calle.trim() || !colonia.trim() || !ciudad.trim() || !estado.trim() || !codigoPostal.trim()) {
      this.modalError = 'Por favor complete los campos obligatorios de dirección.';
      return;
    }

    const nombreCompleto = `${nombre.trim()} ${apellidoPaterno.trim()} ${apellidoMaterno.trim()}`.trim();

    const direccion: DireccionResponse = {
      tipoDireccion: this.formData.tipoDireccion,
      calle: calle.trim(),
      numeroExterior: this.formData.numeroExterior.trim(),
      numeroInterior: this.formData.numeroInterior.trim(),
      colonia: colonia.trim(),
      ciudad: ciudad.trim(),
      estado: estado.trim(),
      codigoPostal: codigoPostal.trim(),
      referencias: this.formData.referencias.trim(),
      esVerificada: this.formData.esVerificada
    };

    if (this.isEditingCliente && this.idEdicion !== null) {
      const idx = this.clientes.findIndex(c => c.id === this.idEdicion);
      if (idx !== -1) {
        this.clientes[idx] = {
          ...this.clientes[idx],
          nombre: nombre.trim(),
          apellidoPaterno: apellidoPaterno.trim(),
          apellidoMaterno: apellidoMaterno.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
          curp: curp.trim().toUpperCase(),
          rfc: rfc.trim().toUpperCase(),
          nombreCompleto,
          activo: this.formData.activo,
          direccion: { ...this.clientes[idx].direccion, ...direccion }
        };
      }
    } else {
      this.clientes.push({
        id: this.nextId++,
        nombre: nombre.trim(),
        apellidoPaterno: apellidoPaterno.trim(),
        apellidoMaterno: apellidoMaterno.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        curp: curp.trim().toUpperCase(),
        rfc: rfc.trim().toUpperCase(),
        nombreCompleto,
        activo: this.formData.activo,
        direccion: { ...direccion, fechaRegistro: new Date().toISOString().split('T')[0] }
      });
    }

    this.aplicarFiltros();
    this.closeModal();
  }

  trackById(_: number, item: ClienteResponse): number {
    return item.id;
  }

  private emptyForm() {
    return {
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      telefono: '',
      email: '',
      curp: '',
      rfc: '',
      activo: true,
      tipoDireccion: 'Casa',
      calle: '',
      numeroExterior: '',
      numeroInterior: '',
      colonia: '',
      ciudad: '',
      estado: '',
      codigoPostal: '',
      referencias: '',
      esVerificada: false
    };
  }
}
