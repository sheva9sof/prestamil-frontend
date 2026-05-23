import { Component, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ClienteService } from 'src/app/prestamil/core/services/cliente.service';
import { ClienteResponse } from 'src/app/prestamil/core/models/cliente.model';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss']
})
export class ClientesComponent implements OnInit {
  private clienteService = inject(ClienteService);
  private modalService = inject(NgbModal);

  @ViewChild('clienteModal') clienteModalTemplate!: TemplateRef<any>;

  isLoading = false;
  successMessage = '';
  errorMessage = '';

  clientes: ClienteResponse[] = [];
  clientesFiltrados: ClienteResponse[] = [];

  filtroNombre = '';
  filtroTelefono = '';
  filtroSoloActivos = false;

  paginaActual = 1;
  itemsPorPagina = 10;
  totalPaginas = 0;
  Math = Math;

  clienteModalRef: NgbModalRef | null = null;
  isEditingCliente = false;
  idEdicion: number | null = null;
  direccionIdEdicion: number | undefined;
  modalError = '';
  isLoadingGuardar = false;

  formData = this.emptyForm();

  ngOnInit(): void {
    this.cargarClientes();
  }

  cargarClientes(): void {
    this.isLoading = true;
    this.clienteService.getAll().subscribe({
      next: (lista) => {
        this.clientes = lista;
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Error al cargar la lista de clientes.';
        this.isLoading = false;
      }
    });
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
    if (pagina >= 1 && pagina <= this.totalPaginas) this.paginaActual = pagina;
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
    this.direccionIdEdicion = undefined;
    this.modalError = '';
    this.formData = this.emptyForm();
    this.clienteModalRef = this.modalService.open(this.clienteModalTemplate, {
      backdrop: 'static', keyboard: false, centered: true, size: 'xl', windowClass: 'edit-modal'
    });
  }

  editarCliente(c: ClienteResponse): void {
    this.isEditingCliente = true;
    this.idEdicion = c.id;
    this.direccionIdEdicion = c.direccion?.id;
    this.modalError = '';
    this.formData = {
      nombre: c.nombre,
      apellidoPaterno: c.apellidoPaterno,
      apellidoMaterno: c.apellidoMaterno,
      telefono: c.telefono,
      curp: c.curp ?? '',
      rfc: c.rfc ?? '',
      activo: c.activo,
      tipoDireccion: (c.direccion?.tipoDireccion ?? 'Particular') as 'Fiscal' | 'Particular' | 'Laboral',
      calle: c.direccion?.calle ?? '',
      numeroExterior: c.direccion?.numeroExterior ?? '',
      numeroInterior: c.direccion?.numeroInterior ?? '',
      colonia: c.direccion?.colonia ?? '',
      ciudad: c.direccion?.ciudad ?? '',
      estado: c.direccion?.estado ?? '',
      codigoPostal: c.direccion?.codigoPostal ?? '',
      referencias: c.direccion?.referencias ?? '',
      esVerificada: c.direccion?.esVerificada ?? false
    };
    this.clienteModalRef = this.modalService.open(this.clienteModalTemplate, {
      backdrop: 'static', keyboard: false, centered: true, size: 'xl', windowClass: 'edit-modal'
    });
  }

  closeModal(): void {
    this.clienteModalRef?.close();
    this.clienteModalRef = null;
    this.modalError = '';
    this.formData = this.emptyForm();
  }

  guardarCliente(): void {
    const { nombre, apellidoPaterno, telefono, calle, colonia, ciudad, estado, codigoPostal } = this.formData;

    if (!nombre.trim() || !apellidoPaterno.trim() || !telefono.trim()) {
      this.modalError = 'Nombre, apellido paterno y teléfono son obligatorios.';
      return;
    }
    if (!calle.trim() || !colonia.trim() || !ciudad.trim() || !estado.trim() || !codigoPostal.trim()) {
      this.modalError = 'Por favor complete los campos obligatorios de dirección.';
      return;
    }

    const body = {
      nombre: nombre.trim(),
      apellidoPaterno: apellidoPaterno.trim(),
      apellidoMaterno: this.formData.apellidoMaterno.trim(),
      telefono: telefono.trim(),
      curp: this.formData.curp.trim().toUpperCase() || null,
      rfc: this.formData.rfc.trim().toUpperCase() || null,
      activo: this.formData.activo,
      direccion: {
        id: this.isEditingCliente ? this.direccionIdEdicion : undefined,
        tipoDireccion: this.formData.tipoDireccion,
        calle: calle.trim(),
        numeroExterior: this.formData.numeroExterior.trim(),
        numeroInterior: this.formData.numeroInterior.trim() || null,
        colonia: colonia.trim(),
        ciudad: ciudad.trim(),
        estado: estado.trim(),
        codigoPostal: codigoPostal.trim(),
        referencias: this.formData.referencias.trim() || null,
        esVerificada: this.formData.esVerificada
      }
    };

    this.isLoadingGuardar = true;
    this.modalError = '';

    const label = this.isEditingCliente ? 'Cliente actualizado.' : 'Cliente registrado.';
    const op = this.isEditingCliente
      ? this.clienteService.actualizar(this.idEdicion!, body)
      : this.clienteService.crear(body);

    op.subscribe({
      next: () => {
        this.isLoadingGuardar = false;
        this.closeModal();
        this.cargarClientes();
        this.mostrarExito(label);
      },
      error: (err) => {
        this.isLoadingGuardar = false;
        this.modalError = err?.error?.message ?? err?.error?.error ?? 'Error al guardar el cliente.';
      }
    });
  }

  trackById(_: number, item: ClienteResponse): number {
    return item.id;
  }

  private mostrarExito(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';
    setTimeout(() => (this.successMessage = ''), 4000);
  }

  private emptyForm() {
    return {
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      telefono: '',
      curp: '',
      rfc: '',
      activo: true,
      tipoDireccion: 'Particular' as 'Fiscal' | 'Particular' | 'Laboral',
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
