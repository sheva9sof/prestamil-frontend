import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';
import { PlazoService } from 'src/app/prestamil/core/services/plazo.service';
import { ClienteService } from 'src/app/prestamil/core/services/cliente.service';
import { ContratoService } from 'src/app/prestamil/core/services/contrato.service';
import { PrendaService } from 'src/app/prestamil/core/services/prenda.service';
import { PlazoHechuraAlhajaResponse, PlazoParametroResponse } from 'src/app/prestamil/core/models/plazo.model';
import { CatValorPrendaResponse } from 'src/app/prestamil/core/models/cliente.model';
import { ContratoRequest, ContratoResponse, PartidaContratoRequest } from 'src/app/prestamil/core/models/contrato.model';
import { environment } from 'src/environments/environment';

// ---------------------------------------------------------------------------
// Interfaces locales
// ---------------------------------------------------------------------------

interface PartidaAvaluo {
  id: number;
  idTipoPrenda: number;
  idValorPrenda?: number;
  tipo: string;
  clavePrenda: string;
  descripcion: string;
  cantidad: number;
  peso: number;
  kilataje?: number;
  hechura?: string;
  hechuraCod?: string;
  precioXGramo?: number;
  avaluoReal: number;
  avaluoContrato: number;
  prestamo: number;
  vencimiento: string;
  estatus: string;
  subtipo?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  estadoFisico?: string;
}

interface ClienteLocal {
  id: number;
  folio: string;
  nombre: string;
  identificacion: string;
  telefono: string;
  prestamoAcumulado: number;
}

interface PrendaCatalogo {
  idValorAtributo: number;
  clave: string;
  descripcion: string;
  kilataje: number;
  tipo: string;
}

interface PlazoAvaluo {
  id: number;
  nombre: string;
  diasPorPeriodo: number;
  numeroPeriodos: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-avaluo',
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './avaluo.component.html',
  styleUrls: ['./avaluo.component.scss']
})
export class AvaluoComponent implements OnInit {

  // -------------------------------------------------------------------------
  // Services
  // -------------------------------------------------------------------------
  private authService    = inject(AuthService);
  private plazoService   = inject(PlazoService);
  private clienteService = inject(ClienteService);
  private contratoService = inject(ContratoService);
  private prendaService  = inject(PrendaService);
  private modalService   = inject(NgbModal);

  // -------------------------------------------------------------------------
  // Sesión / encabezado
  // -------------------------------------------------------------------------
  readonly sucursal = 'Sucursal Centro';
  usuario = this.authService.getUser()?.nombre ?? 'Sin sesión';
  rol = this.authService.getUser()?.rolNombre ?? '';
  sucursalId = 1;
  readonly fechaAbierta = new Date().toLocaleDateString('es-MX');
  operacionAbierta = true;
  readonly environment = environment;

  // -------------------------------------------------------------------------
  // Mensajes
  // -------------------------------------------------------------------------
  successMessage = '';
  errorMessage = '';

  private mostrarExito(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';
    setTimeout(() => (this.successMessage = ''), 5000);
  }

  private mostrarError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = '';
  }

  // -------------------------------------------------------------------------
  // Tipos de prenda
  // -------------------------------------------------------------------------
  tiposPrenda = ['Alhajas', 'Plata', 'Varios', 'Autos/Motos'];
  tipoSeleccionado = 'Alhajas';
  puedeAgregarPartida = true;

  private readonly TIPO_PRENDA_ID: Record<string, number> = {
    'Alhajas': 1, 'Plata': 4, 'Varios': 3, 'Autos/Motos': 5
  };

  // idAtributo del catálogo a cargar según tipo (Kilataje para ALHAJA, Tipo para PLATA)
  private readonly ATRIBUTO_CATALOGO: Record<string, number> = {
    'Alhajas': 4, 'Plata': 7
  };

  private hechuraCodigo(h: string): string {
    if (h === 'FUNDIR')   return 'F';
    if (h === 'ESPECIAL') return 'E';
    return 'N';
  }

  // -------------------------------------------------------------------------
  // Plazos
  // -------------------------------------------------------------------------
  plazos: PlazoAvaluo[] = [];
  plazoSeleccionado: PlazoAvaluo | null = null;

  private readonly plazosDemo: PlazoAvaluo[] = [
    { id: 1, nombre: 'ALHAJAS - 12 SEMANAS', diasPorPeriodo: 7,  numeroPeriodos: 12 },
    { id: 2, nombre: 'ALHAJAS - 10 SEMANAS', diasPorPeriodo: 7,  numeroPeriodos: 10 },
    { id: 3, nombre: 'QUINCENAL',            diasPorPeriodo: 15, numeroPeriodos: 6  },
    { id: 4, nombre: 'MENSUAL',              diasPorPeriodo: 30, numeroPeriodos: 6  }
  ];

  // Precios fallback mientras no haya tabla cargada (última tabla real o demo)
  private readonly preciosOro: Record<number, number> = {
    6: 118.84, 8: 384.65, 10: 488.26, 12: 591.38,
    14: 695.74, 18: 900.01, 21: 1052.50, 24: 0
  };

  // -------------------------------------------------------------------------
  // Datos de plazo (cargados cuando se selecciona un plazo)
  // -------------------------------------------------------------------------
  tablaAlhajas: PlazoHechuraAlhajaResponse[] = [];
  // Params indexados por tipo_prenda_id — cargados todos de una vez al seleccionar plazo
  private paramsMap: Record<number, PlazoParametroResponse> = {};

  private getParams(tipoPrendaId: number): PlazoParametroResponse | null {
    return this.paramsMap[tipoPrendaId] ?? null;
  }

  ngOnInit(): void {
    this.plazoService.getAll().subscribe({
      next: (lista) => {
        this.plazos = (lista || []).map(p => ({
          id: p.id,
          nombre: p.nombre,
          diasPorPeriodo: p.diasPorPeriodo ?? 7,
          numeroPeriodos: p.numeroPeriodos ?? 1
        }));
        if (this.plazos.length === 0) this.plazos = this.plazosDemo;
      },
      error: () => { this.plazos = this.plazosDemo; }
    });
  }

  onPlazoChange(plazo: PlazoAvaluo | null): void {
    this.tablaAlhajas = [];
    this.paramsMap = {};
    if (!plazo) return;

    this.plazoService.getTablaAlhajas(plazo.id, this.sucursalId).subscribe({
      next: (tabla) => { this.tablaAlhajas = tabla; this.recalcularAlhajas(); }
    });

    // Carga todos los parámetros del plazo en un solo request y los indexa por tipo
    this.plazoService.getParametrosBySucursal(plazo.id, this.sucursalId).subscribe({
      next: (lista) => {
        this.paramsMap = {};
        (lista ?? []).forEach(p => { this.paramsMap[p.tipoPrendaId] = p; });
        this.recalcularAlhajas();
        this.recalcularVarios();
      }
    });
  }

  labelPlazo(p: PlazoAvaluo): string {
    return `${p.nombre} - ${p.diasPorPeriodo * p.numeroPeriodos} días`;
  }

  // -------------------------------------------------------------------------
  // Catálogos locales (no cambian)
  // -------------------------------------------------------------------------
  readonly tiposIdentificacion = [
    'CREDENCIAL IFE', 'PASAPORTE', 'CÉDULA PROFESIONAL',
    'LICENCIA DE MANEJO', 'CARTILLA S.M.N.'
  ];
  readonly kilatajes = [6, 8, 10, 12, 14, 18, 21, 24];
  readonly hechuras  = ['FUNDIR', 'NORMAL', 'ESPECIAL'];
  readonly subtiposVarios = ['Electrodoméstico', 'Celular', 'Laptop', 'Otro'];
  readonly estadosVarios  = ['Bueno', 'Regular', 'Malo'];

  // -------------------------------------------------------------------------
  // Estado — cliente seleccionado
  // -------------------------------------------------------------------------
  clienteSeleccionado: ClienteLocal | null = null;
  beneficiario = '';
  identificacionSeleccionada = 'CREDENCIAL IFE';
  filtroCliente = '';
  clientesBusqueda: ClienteLocal[] = [];
  isSearchingCliente = false;

  // -------------------------------------------------------------------------
  // Estado — catálogo de prendas
  // -------------------------------------------------------------------------
  prendasCatalogo: PrendaCatalogo[] = [];
  filtroPrenda = '';
  isLoadingPrendas = false;

  // -------------------------------------------------------------------------
  // Estado — contratos del cliente (vencimientos)
  // -------------------------------------------------------------------------
  contratosPorCliente: ContratoResponse[] = [];
  isLoadingContratos = false;

  // -------------------------------------------------------------------------
  // Estado — captura ALHAJAS/PLATA
  // -------------------------------------------------------------------------
  captura = {
    clavePrenda: '',
    descripcion: '',
    hechura: 'NORMAL',
    kilataje: 14,
    cantidad: 1,
    peso: 0,
    color: '',
    claridad: '',
    precioXGramo: 0,
    avaluoReal: 0,
    avaluoContrato: 0,
    prestamo: 0,
    idValorPrenda: undefined as number | undefined
  };

  // -------------------------------------------------------------------------
  // Estado — captura VARIOS
  // -------------------------------------------------------------------------
  capturaVarios = {
    subtipo: 'Celular',
    marca: '',
    modelo: '',
    serie: '',
    estado: 'Bueno',
    prestamo: 0,
    avaluoContrato: 0
  };

  // -------------------------------------------------------------------------
  // Cálculos automáticos
  // -------------------------------------------------------------------------
  recalcularAlhajas(): void {
    const kilataje = +this.captura.kilataje;
    const hechuraCod = this.hechuraCodigo(this.captura.hechura);

    const row = this.tablaAlhajas.find(r => r.kilataje === kilataje && r.hechura === hechuraCod);
    if (row) {
      this.captura.precioXGramo = row.precioBase;
      this.captura.prestamo = +(row.precioPrestamo * this.captura.peso).toFixed(2);
    } else {
      // Fallback a precios demo mientras no haya tabla real
      const precioBase = this.preciosOro[kilataje] ?? 0;
      this.captura.precioXGramo = precioBase;
      this.captura.prestamo = +(precioBase * this.captura.peso * 1.03).toFixed(2);
    }

    this.captura.avaluoReal = this.captura.prestamo;
    const tipoPrendaId = this.TIPO_PRENDA_ID[this.tipoSeleccionado] ?? 1;
    const params = this.getParams(tipoPrendaId);
    const porcInc = params?.porcIncrementoAvaluo ?? 0;
    this.captura.avaluoContrato = +(this.captura.prestamo * (1 + porcInc / 100)).toFixed(2);
  }

  recalcularVarios(): void {
    const params = this.getParams(this.TIPO_PRENDA_ID['Varios']);
    const porcInc = params?.porcIncrementoAvaluo ?? 0;
    this.capturaVarios.avaluoContrato = +(this.capturaVarios.prestamo * (1 + porcInc / 100)).toFixed(2);
  }

  get porcIncrementoVarios(): number {
    const params = this.getParams(this.TIPO_PRENDA_ID['Varios']);
    return params?.porcIncrementoAvaluo ?? 0;
  }

  // -------------------------------------------------------------------------
  // Partidas
  // -------------------------------------------------------------------------
  partidas: PartidaAvaluo[] = [];

  get totalPartidas(): number       { return this.partidas.length; }
  get pesoTotal(): number           { return this.partidas.reduce((a, i) => a + i.peso, 0); }
  get avaluoTotal(): number         { return this.partidas.reduce((a, i) => a + i.avaluoReal, 0); }
  get avaluoContratoTotal(): number { return this.partidas.reduce((a, i) => a + i.avaluoContrato, 0); }
  get prestamoTotal(): number       { return this.partidas.reduce((a, i) => a + i.prestamo, 0); }

  // -------------------------------------------------------------------------
  // Acciones de flujo
  // -------------------------------------------------------------------------
  seleccionarTipo(tipo: string): void {
    this.tipoSeleccionado = tipo;
    this.puedeAgregarPartida = tipo !== 'Autos/Motos';
    this.prendasCatalogo = [];
  }

  agregarPartida(): void {
    if (!this.clienteSeleccionado) {
      this.mostrarError('Selecciona un cliente antes de agregar una partida');
      return;
    }
    if (!this.plazoSeleccionado) {
      this.mostrarError('Selecciona un plazo antes de agregar una partida');
      return;
    }
    if (this.tipoSeleccionado === 'Autos/Motos') {
      this.mostrarError('Autos/Motos no está disponible en esta versión');
      return;
    }

    if (this.tipoSeleccionado === 'Alhajas' || this.tipoSeleccionado === 'Plata') {
      if (this.captura.peso <= 0) {
        this.mostrarError('Captura un peso mayor a 0');
        return;
      }
      const nueva: PartidaAvaluo = {
        id: this.partidas.length + 1,
        idTipoPrenda: this.TIPO_PRENDA_ID[this.tipoSeleccionado] ?? 1,
        idValorPrenda: this.captura.idValorPrenda,
        tipo: this.tipoSeleccionado,
        clavePrenda: this.captura.clavePrenda || '—',
        descripcion: this.captura.descripcion || `${this.tipoSeleccionado} ${this.captura.kilataje}K`,
        cantidad: this.captura.cantidad,
        peso: this.captura.peso,
        kilataje: this.captura.kilataje,
        hechura: this.captura.hechura,
        hechuraCod: this.hechuraCodigo(this.captura.hechura),
        precioXGramo: this.captura.precioXGramo,
        avaluoReal: this.captura.avaluoReal,
        avaluoContrato: this.captura.avaluoContrato,
        prestamo: this.captura.prestamo,
        vencimiento: this.calcularVencimiento(),
        estatus: 'Capturada'
      };
      this.partidas = [...this.partidas, nueva];
      this.resetCapturaAlhajas();
    } else if (this.tipoSeleccionado === 'Varios') {
      if (this.capturaVarios.prestamo <= 0) {
        this.mostrarError('Captura un préstamo mayor a 0');
        return;
      }
      const nueva: PartidaAvaluo = {
        id: this.partidas.length + 1,
        idTipoPrenda: 3,
        tipo: 'Varios',
        clavePrenda: this.capturaVarios.subtipo.substring(0, 3).toUpperCase(),
        descripcion: `${this.capturaVarios.subtipo} ${this.capturaVarios.marca} ${this.capturaVarios.modelo}`.trim(),
        cantidad: 1,
        peso: 0,
        avaluoReal: this.capturaVarios.prestamo,
        avaluoContrato: this.capturaVarios.avaluoContrato,
        prestamo: this.capturaVarios.prestamo,
        vencimiento: this.calcularVencimiento(),
        estatus: 'Capturada',
        subtipo: this.capturaVarios.subtipo,
        marca: this.capturaVarios.marca,
        modelo: this.capturaVarios.modelo,
        serie: this.capturaVarios.serie,
        estadoFisico: this.capturaVarios.estado
      };
      this.partidas = [...this.partidas, nueva];
      this.resetCapturaVarios();
    }

    this.mostrarExito('Partida agregada correctamente');
  }

  eliminarPartida(id: number): void {
    this.partidas = this.partidas.filter(p => p.id !== id);
  }

  private calcularVencimiento(): string {
    if (!this.plazoSeleccionado) return '—';
    const dias = this.plazoSeleccionado.diasPorPeriodo * this.plazoSeleccionado.numeroPeriodos;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return fecha.toLocaleDateString('es-MX');
  }

  private resetCapturaAlhajas(): void {
    this.captura = {
      ...this.captura,
      clavePrenda: '',
      descripcion: '',
      cantidad: 1,
      peso: 0,
      color: '',
      claridad: '',
      precioXGramo: 0,
      avaluoReal: 0,
      avaluoContrato: 0,
      prestamo: 0,
      idValorPrenda: undefined
    };
  }

  private resetCapturaVarios(): void {
    this.capturaVarios = {
      subtipo: 'Celular',
      marca: '',
      modelo: '',
      serie: '',
      estado: 'Bueno',
      prestamo: 0,
      avaluoContrato: 0
    };
  }

  // -------------------------------------------------------------------------
  // Modales — ViewChild + TemplateRef
  // -------------------------------------------------------------------------
  @ViewChild('modalCliente')      modalCliente!: TemplateRef<any>;
  @ViewChild('modalPrenda')       modalPrenda!: TemplateRef<any>;
  @ViewChild('modalContrato')     modalContrato!: TemplateRef<any>;
  @ViewChild('modalVencimientos') modalVencimientos!: TemplateRef<any>;

  // --- Modal de cliente ---
  abrirBuscarCliente(): void {
    this.filtroCliente = '';
    this.clientesBusqueda = [];
    this.modalService.open(this.modalCliente, { size: 'lg' });
  }

  buscarClientes(): void {
    const q = this.filtroCliente.trim();
    if (!q) { this.clientesBusqueda = []; return; }

    this.isSearchingCliente = true;
    this.clienteService.search(q).subscribe({
      next: (lista) => {
        this.clientesBusqueda = lista.map(c => ({
          id: c.id,
          folio: `CLI-${String(c.id).padStart(6, '0')}`,
          nombre: `${c.nombre} ${c.apellidoPaterno} ${c.apellidoMaterno}`.trim(),
          identificacion: 'CREDENCIAL IFE',
          telefono: c.telefono,
          prestamoAcumulado: 0
        }));
        this.isSearchingCliente = false;
      },
      error: () => { this.isSearchingCliente = false; }
    });
  }

  seleccionarCliente(c: ClienteLocal, modal: any): void {
    this.clienteSeleccionado = c;
    this.identificacionSeleccionada = c.identificacion;
    this.cargarContratosPorCliente(c.id);
    modal.close();
  }

  private cargarContratosPorCliente(clienteId: number): void {
    this.isLoadingContratos = true;
    this.contratoService.getByCliente(clienteId).subscribe({
      next: (contratos) => { this.contratosPorCliente = contratos; this.isLoadingContratos = false; },
      error: () => { this.contratosPorCliente = []; this.isLoadingContratos = false; }
    });
  }

  // --- Modal de prenda ---
  abrirBuscarPrenda(): void {
    if (this.tipoSeleccionado !== 'Alhajas' && this.tipoSeleccionado !== 'Plata') return;
    this.filtroPrenda = '';

    const idAtributo = this.ATRIBUTO_CATALOGO[this.tipoSeleccionado];
    if (idAtributo && this.prendasCatalogo.length === 0) {
      this.isLoadingPrendas = true;
      this.prendaService.getValores(idAtributo).subscribe({
        next: (vals) => {
          this.prendasCatalogo = vals.map(v => ({
            idValorAtributo: v.idValorAtributo,
            clave: v.clave ? String(v.clave) : '—',
            descripcion: v.descripcion,
            kilataje: v.kilataje ?? 0,
            tipo: this.tipoSeleccionado
          }));
          this.isLoadingPrendas = false;
        },
        error: () => { this.isLoadingPrendas = false; }
      });
    }

    this.modalService.open(this.modalPrenda, { size: 'lg' });
  }

  seleccionarPrenda(p: PrendaCatalogo, modal: any): void {
    this.captura.clavePrenda = p.clave;
    this.captura.descripcion = p.descripcion;
    if (p.kilataje) this.captura.kilataje = p.kilataje;
    this.captura.idValorPrenda = p.idValorAtributo;
    this.recalcularAlhajas();
    modal.close();
  }

  get prendasFiltradas(): PrendaCatalogo[] {
    const q = this.filtroPrenda.trim().toLowerCase();
    if (!q) return this.prendasCatalogo;
    return this.prendasCatalogo.filter(p =>
      p.clave.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q)
    );
  }

  // --- Modal de contrato ---
  isGuardando = false;

  generarContrato(): void {
    if (this.partidas.length === 0) {
      this.mostrarError('Agrega al menos una partida antes de generar el contrato');
      return;
    }
    if (!this.clienteSeleccionado) {
      this.mostrarError('Selecciona un cliente antes de generar el contrato');
      return;
    }
    this.modalService.open(this.modalContrato, { size: 'md' }).result.then(
      () => {
        this.isGuardando = true;
        const request = this.buildContratoRequest();
        this.contratoService.crear(request).subscribe({
          next: (resp) => {
            this.isGuardando = false;
            this.partidas = [];
            this.clienteSeleccionado = null;
            this.beneficiario = '';
            this.contratosPorCliente = [];
            this.mostrarExito(`Contrato ${resp.folio} registrado exitosamente.`);
          },
          error: (err) => {
            this.isGuardando = false;
            const msg = err?.error?.message || err?.error?.error || 'Error al guardar el contrato.';
            this.mostrarError(msg);
          }
        });
      },
      () => { /* dismissed */ }
    );
  }

  private buildContratoRequest(): ContratoRequest {
    const partidas: PartidaContratoRequest[] = this.partidas.map(p => ({
      idTipoPrenda: p.idTipoPrenda,
      idValorPrenda: p.idValorPrenda,
      clavePrenda: p.clavePrenda !== '—' ? p.clavePrenda : undefined,
      descripcion: p.descripcion,
      cantidad: p.cantidad,
      pesoGramos: p.peso > 0 ? p.peso : undefined,
      kilataje: p.kilataje,
      hechura: p.hechuraCod,
      precioXGramo: p.precioXGramo,
      avaluoReal: p.avaluoReal,
      avaluoContrato: p.avaluoContrato,
      montoPrestamo: p.prestamo,
      subtipo: p.subtipo,
      marca: p.marca,
      modelo: p.modelo,
      serieImei: p.serie,
      estadoFisico: p.estadoFisico
    }));

    return {
      idCliente: this.clienteSeleccionado!.id,
      idPlazo: this.plazoSeleccionado!.id,
      nombreBeneficiario: this.beneficiario || undefined,
      tipoIdentificacion: this.identificacionSeleccionada,
      partidas
    };
  }

  // --- Modal de vencimientos ---
  verVencimientos(): void {
    if (!this.clienteSeleccionado) {
      this.mostrarError('Selecciona un cliente para ver sus vencimientos');
      return;
    }
    this.modalService.open(this.modalVencimientos, { size: 'lg' });
  }

  estatusContratoBadge(estatus: string): string {
    if (estatus === 'VIGENTE')     return 'badge-success';
    if (estatus === 'VENCIDO')     return 'badge-danger';
    if (estatus === 'EN_VENTA')    return 'badge-warning';
    return 'badge-secondary';
  }

  // -------------------------------------------------------------------------
  // Tarjeta de pendientes (solo dev)
  // -------------------------------------------------------------------------
  pendientesAbiertas = false;
  togglePendientes(): void { this.pendientesAbiertas = !this.pendientesAbiertas; }
}
