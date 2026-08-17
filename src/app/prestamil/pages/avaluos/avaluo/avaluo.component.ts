import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, OperatorFunction, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';
import { PlazoService } from 'src/app/prestamil/core/services/plazo.service';
import { ClienteService } from 'src/app/prestamil/core/services/cliente.service';
import { ContratoService } from 'src/app/prestamil/core/services/contrato.service';
import { PrendaService } from 'src/app/prestamil/core/services/prenda.service';
import { PlazoHechuraAlhajaResponse, PlazoParametroResponse } from 'src/app/prestamil/core/models/plazo.model';
import { CatValorPrendaResponse, ClienteResponse } from 'src/app/prestamil/core/models/cliente.model';
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
  ley?: number;
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

// Fila de la tabla de amortización (un vencimiento por periodo), estilo COCAE
interface FilaAmortizacion {
  periodo: number;
  fecha: string;
  interes: number;
  almacen: number;
  gastos: number;
  totalInteres: number;
  iva: number;
  refrendo: number;   // pago para EXTENDER (solo intereses + IVA acumulados)
  desempeno: number;  // pago para RECUPERAR la prenda (préstamo + intereses + IVA)
}

// Preview completo de "Vencimientos de Contrato" (réplica de la pantalla de COCAE)
interface AmortizacionPreview {
  periodoNombre: string;
  diasPorPeriodo: number;
  numeroPeriodos: number;
  porcInteres: number;
  porcAlmacen: number;
  porcInteresTotal: number;
  ivaPorc: number;
  avaluo: number;
  prestamo: number;
  interesPeriodo: number;
  ivaPeriodo: number;
  totalPagoPeriodo: number;
  alVencimiento: number;
  importeAEntregar: number;
  fechaLimiteNormal: string;
  diasGracia: number;
  filas: FilaAmortizacion[];
  fechaLimiteExtemp: string;
  porcSancionSemanal: number;
  sancionSemanal: number;
  porcReposicion: number;
  fechaPaseVenta: string;
  comisionVenta: number;
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
  tiposPrenda?: Array<{ id: number; tipo: string }>;
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
  private sanitizer      = inject(DomSanitizer);

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

  // idAtributo del catalogo a cargar segun tipo. Solo ALHAJA tiene catalogo real:
  // cat_valor_prenda no tiene NINGUNA fila para id_atributo=7 (Plata), por eso plata
  // usa el selector de Ley 925/725 en vez de un catalogo (Phase 6, D-10).
  private readonly ATRIBUTO_CATALOGO: Record<string, number> = {
    'Alhajas': 4
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
          numeroPeriodos: p.numeroPeriodos ?? 1,
          tiposPrenda: p.tiposPrenda ?? []
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

    const tiposAsociados = this.tiposPrenda.filter(tipo =>
      (plazo.tiposPrenda ?? []).some(asociado => Number(asociado.id) === this.TIPO_PRENDA_ID[tipo])
    );
    if (tiposAsociados.length > 0 && !tiposAsociados.includes(this.tipoSeleccionado)) {
      this.seleccionarTipo(tiposAsociados[0]);
    }

    this.plazoService.getTablaAlhajas(plazo.id, this.sucursalId).subscribe({
      next: (tabla) => { this.tablaAlhajas = tabla; this.recalcularCaptura(); }
    });

    // Carga todos los parámetros del plazo en un solo request y los indexa por tipo
    this.plazoService.getParametrosBySucursal(plazo.id, this.sucursalId).subscribe({
      next: (lista) => {
        this.paramsMap = {};
        (lista ?? []).forEach(p => { this.paramsMap[p.tipoPrendaId] = p; });
        this.recalcularCaptura();
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
  readonly leyesPlata = [925, 720];
  readonly hechuras  = ['FUNDIR', 'NORMAL', 'ESPECIAL'];
  readonly subtiposVarios = ['Electrodoméstico', 'Celular', 'Laptop', 'Otro'];
  readonly estadosVarios  = ['Bueno', 'Regular', 'Malo'];
  readonly IVA_PORC = 16;   // IVA estándar (México); COCAE lo aplica sobre el interés total

  // Preview de la tabla de amortización del contrato en curso (modal estilo COCAE)
  amortizacion: AmortizacionPreview | null = null;

  // Visor del PDF del contrato generado
  pdfUrl: SafeResourceUrl | null = null;
  private pdfBlobUrl: string | null = null;
  contratoPdfFolio = '';

  // -------------------------------------------------------------------------
  // Estado — cliente seleccionado
  // -------------------------------------------------------------------------
  clienteSeleccionado: ClienteLocal | null = null;
  clienteBusquedaInput: ClienteLocal | string = '';
  beneficiario = '';
  identificacionSeleccionada = 'CREDENCIAL IFE';
  filtroCliente = '';
  clientesBusqueda: ClienteLocal[] = [];
  isSearchingCliente = false;

  readonly buscarClientesAutocomplete: OperatorFunction<string, readonly ClienteLocal[]> = (texto$: Observable<string>) =>
    texto$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((texto) => {
        const q = texto.trim();
        if (q.length < 2) {
          this.isSearchingCliente = false;
          return of([]);
        }

        this.isSearchingCliente = true;
        return this.clienteService.search(q).pipe(
          map((clientes) => clientes
            .filter((cliente) => cliente.activo)
            .slice(0, 10)
            .map((cliente) => this.mapearCliente(cliente))),
          catchError(() => of([])),
          finalize(() => { this.isSearchingCliente = false; })
        );
      })
    );

  readonly formatearClienteInput = (cliente: ClienteLocal | string): string =>
    typeof cliente === 'string' ? cliente : cliente?.nombre ?? '';

  readonly formatearClienteResultado = (cliente: ClienteLocal): string =>
    `${cliente.nombre} · ${cliente.folio} · ${cliente.telefono || 'Sin teléfono'}`;

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
    ley: 925,
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

  /** Prestamo maximo autorizado por el servidor para la captura de plata (avaluo x % / 100). */
  prestamoMaximoPlata = 0;

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

  /** Enruta el recalculo al motor correcto segun el tipo seleccionado. */
  recalcularCaptura(): void {
    if (this.tipoSeleccionado === 'Plata') {
      this.recalcularPlata();
    } else if (this.tipoSeleccionado === 'Alhajas') {
      this.recalcularAlhajas();
    }
  }

  /**
   * Preview de plata (Phase 6 — PLATA-01/PLATA-03, D-01/D-10).
   *   avaluo         = peso x precio por gramo de la ley (ley925 / ley725 de plazo_parametro)
   *   prestamoMaximo = peso x precio (COCAE: el precio por gramo YA es el prestamo; NO se aplica % Prestamo s/Avaluo)
   * NUNCA usa tablaAlhajas ni preciosOro: esos son precios de ORO.
   * El valor persistido lo recalcula el servidor en ContratoService.buildPartida.
   */
  recalcularPlata(): void {
    const params = this.getParams(this.TIPO_PRENDA_ID['Plata']);
    const ley = +this.captura.ley;
    const precioGramo = ley === 925 ? (params?.ley925 ?? 0) : (params?.ley725 ?? 0);
    this.captura.precioXGramo = precioGramo;
    this.captura.avaluoReal = +(precioGramo * this.captura.peso).toFixed(2);
    // El precio por gramo YA es el precio de préstamo (COCAE): préstamo = peso × precio,
    // SIN aplicar "% Préstamo s/Avalúo" (ese recorte no aplica a plata). Igual que el backend y que oro.
    this.prestamoMaximoPlata = this.captura.avaluoReal;

    // Propuesta inicial = el máximo (peso × precio). Al cambiar peso/ley/plazo SIEMPRE se re-propone
    // el máximo, para que el préstamo no se quede pegado en un valor viejo mientras escribes el peso
    // (ej. teclear "20" pasa por "2" → préstamo 13). El ajuste a la baja se hace en el campo Préstamo
    // (ajustarPrestamoPlata). Igual que oro, que también recalcula el préstamo al cambiar el peso.
    this.captura.prestamo = this.prestamoMaximoPlata;
    this.captura.avaluoContrato = this.avaluoContratoDesde(this.captura.prestamo, params);
  }

  /**
   * Ajuste manual del prestamo de plata: solo hacia abajo. Si el usuario escribe un
   * monto por encima del maximo del servidor, se baja al maximo y se avisa (PLATA-03).
   */
  ajustarPrestamoPlata(): void {
    const params = this.getParams(this.TIPO_PRENDA_ID['Plata']);
    let valor = +this.captura.prestamo;
    if (!Number.isFinite(valor) || valor < 0) valor = 0;
    if (valor > this.prestamoMaximoPlata) {
      valor = this.prestamoMaximoPlata;
      this.mostrarError(`El préstamo no puede superar el máximo autorizado ($${this.prestamoMaximoPlata.toFixed(2)}).`);
    }
    this.captura.prestamo = valor;
    this.captura.avaluoContrato = this.avaluoContratoDesde(valor, params);
  }

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
    this.captura.avaluoContrato = this.avaluoContratoDesde(this.captura.prestamo, params);
  }

  recalcularVarios(): void {
    const params = this.getParams(this.TIPO_PRENDA_ID['Varios']);
    this.capturaVarios.avaluoContrato = this.avaluoContratoDesde(this.capturaVarios.prestamo, params);
  }

  get porcIncrementoVarios(): number {
    const params = this.getParams(this.TIPO_PRENDA_ID['Varios']);
    return params?.porcPrestamoSAvaluoReal ?? 0;
  }

  /**
   * Avalúo de contrato = préstamo × (1 + porcPrestamoSAvaluoReal/100) si usaAvaluoReal.
   * Réplica exacta del backend (PlazoService.calcularAvaluoContrato) para que el preview
   * coincida con el valor persistido. Campo canónico: porcPrestamoSAvaluoReal.
   */
  private avaluoContratoDesde(prestamo: number, params: PlazoParametroResponse | null): number {
    const usa = params?.usaAvaluoReal ?? false;
    const porc = params?.porcPrestamoSAvaluoReal ?? 0;
    return (usa && porc > 0)
      ? +(prestamo * (1 + porc / 100)).toFixed(2)
      : +(prestamo).toFixed(2);
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
    this.prestamoMaximoPlata = 0;
    this.captura.prestamo = 0;
    this.recalcularCaptura();
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
      const esPlata = this.tipoSeleccionado === 'Plata';
      if (esPlata && this.captura.precioXGramo <= 0) {
        this.mostrarError(
          `No hay precio por gramo configurado para la ley ${this.captura.ley} en este plazo. ` +
          `Configúralo en Configuración → Plazos y periodos → pestaña Platas.`);
        return;
      }
      if (esPlata && this.captura.prestamo <= 0) {
        this.mostrarError('Captura un préstamo mayor a 0');
        return;
      }
      const nueva: PartidaAvaluo = {
        id: this.partidas.length + 1,
        idTipoPrenda: this.TIPO_PRENDA_ID[this.tipoSeleccionado] ?? 1,
        idValorPrenda: this.captura.idValorPrenda,
        tipo: this.tipoSeleccionado,
        clavePrenda: this.captura.clavePrenda || '—',
        descripcion: this.captura.descripcion || (esPlata
          ? `Plata ley ${this.captura.ley}`
          : `${this.tipoSeleccionado} ${this.captura.kilataje}K`),
        cantidad: this.captura.cantidad,
        peso: this.captura.peso,
        kilataje: esPlata ? undefined : this.captura.kilataje,
        ley: esPlata ? +this.captura.ley : undefined,
        hechura: esPlata ? undefined : this.captura.hechura,
        hechuraCod: esPlata ? undefined : this.hechuraCodigo(this.captura.hechura),
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
  @ViewChild('modalAmortizacion') modalAmortizacion!: TemplateRef<any>;
  @ViewChild('modalPdf')          modalPdf!: TemplateRef<any>;

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
        this.clientesBusqueda = lista
          .filter((cliente) => cliente.activo)
          .map((cliente) => this.mapearCliente(cliente));
        this.isSearchingCliente = false;
      },
      error: () => { this.isSearchingCliente = false; }
    });
  }

  onClienteInputChange(valor: ClienteLocal | string): void {
    this.clienteBusquedaInput = valor;

    if (typeof valor === 'string' && this.clienteSeleccionado && valor !== this.clienteSeleccionado.nombre) {
      this.clienteSeleccionado = null;
      this.contratosPorCliente = [];
    }
  }

  seleccionarClienteAutocomplete(evento: NgbTypeaheadSelectItemEvent<ClienteLocal>): void {
    this.establecerCliente(evento.item);
  }

  seleccionarCliente(c: ClienteLocal, modal: any): void {
    this.establecerCliente(c);
    modal.close();
  }

  private establecerCliente(cliente: ClienteLocal): void {
    this.clienteSeleccionado = cliente;
    this.clienteBusquedaInput = cliente;
    this.identificacionSeleccionada = cliente.identificacion;
    this.cargarContratosPorCliente(cliente.id);
  }

  private mapearCliente(cliente: ClienteResponse): ClienteLocal {
    return {
      id: cliente.id,
      folio: `CLI-${String(cliente.id).padStart(6, '0')}`,
      nombre: cliente.nombreCompleto ||
        `${cliente.nombre} ${cliente.apellidoPaterno} ${cliente.apellidoMaterno}`.trim(),
      identificacion: 'CREDENCIAL IFE',
      telefono: cliente.telefono,
      prestamoAcumulado: 0
    };
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
    // Plata ya no usa catalogo: cat_valor_prenda no tiene filas para id_atributo=7 (D-10).
    if (this.tipoSeleccionado !== 'Alhajas') return;
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
            this.clienteBusquedaInput = '';
            this.beneficiario = '';
            this.contratosPorCliente = [];
            this.mostrarExito(`Contrato ${resp.folio} registrado exitosamente.`);
            this.abrirPdfContrato(resp.id, resp.folio);
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

  /** Descarga el PDF del contrato recién creado y lo muestra en un visor modal. */
  private abrirPdfContrato(id: number, folio: string): void {
    this.contratoService.getPdf(id).subscribe({
      next: (blob) => {
        if (this.pdfBlobUrl) URL.revokeObjectURL(this.pdfBlobUrl);
        this.pdfBlobUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl);
        this.contratoPdfFolio = folio;
        this.modalService.open(this.modalPdf, { size: 'xl', scrollable: true });
      },
      error: () => this.mostrarError('El contrato se guardó, pero no se pudo generar el PDF.')
    });
  }

  /** Descarga el PDF actualmente mostrado en el visor. */
  descargarPdfContrato(): void {
    if (!this.pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.pdfBlobUrl;
    a.download = `contrato-${this.contratoPdfFolio || 'sin-folio'}.pdf`;
    a.click();
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
      ley: p.ley,
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

  // --- Modal de amortización (vencimientos del contrato en curso, estilo COCAE) ---
  private nombrePeriodo(dias: number): string {
    if (dias === 1) return 'DIARIO';
    if (dias === 7) return 'SEMANAL';
    if (dias === 15) return 'QUINCENAL';
    if (dias >= 28 && dias <= 31) return 'MENSUAL';
    return `${dias} DÍAS`;
  }

  /**
   * Calcula la tabla de amortización del contrato en curso (préstamo total del contrato) y
   * abre el modal estilo "Vencimientos de Contrato" de COCAE. Cálculo de referencia al vuelo:
   * interés/almacén/IVA acumulativos por periodo, con desempeño = préstamo + acumulado.
   * Réplica de la fórmula verificada contra COCAE (ver Cerebro: flujo-plata).
   */
  verAmortizacion(): void {
    if (this.partidas.length === 0) {
      this.mostrarError('Agrega al menos una partida para calcular los vencimientos');
      return;
    }
    if (!this.plazoSeleccionado) {
      this.mostrarError('Selecciona un plazo');
      return;
    }
    const params = this.getParams(this.TIPO_PRENDA_ID[this.tipoSeleccionado] ?? 1);
    const prestamo = this.prestamoTotal;
    const avaluo = this.avaluoContratoTotal;
    const dias = this.plazoSeleccionado.diasPorPeriodo;
    const nPer = this.plazoSeleccionado.numeroPeriodos;

    const porcInteres = Number(params?.porcInteres ?? 0);
    const porcAlmacen = Number(params?.porcAlmacen ?? 0);
    const porcGastos  = Number(params?.porcGastosAdmin ?? 0);
    // Total interés = interés + almacén + gastos (derivado; el campo porcInteresTotal puede quedar en 0)
    const porcTotal   = porcInteres + porcAlmacen + porcGastos;
    const iva         = this.IVA_PORC;

    const r2 = (x: number) => +x.toFixed(2);
    const interesPer = prestamo * porcInteres / 100;
    const almacenPer = prestamo * porcAlmacen / 100;
    const gastosPer  = prestamo * porcGastos  / 100;
    const totalIntPer = prestamo * porcTotal / 100;
    const trunc2 = (x: number) => Math.floor(x * 100) / 100;   // truncar a 2 decimales (IVA como COCAE)
    const ivaPeriodoVal = trunc2(totalIntPer * iva / 100);

    const hoy = new Date();
    const fechaMas = (d: number): string => {
      const f = new Date(hoy);
      f.setDate(f.getDate() + d);
      return f.toLocaleDateString('es-MX');
    };

    const filas: FilaAmortizacion[] = [];
    for (let n = 1; n <= nPer; n++) {
      const totalIntN = r2(totalIntPer * n);
      const ivaN = trunc2(totalIntPer * n * iva / 100);   // IVA truncado como COCAE
      filas.push({
        periodo: n,
        fecha: fechaMas(dias * n),
        interes: r2(interesPer * n),
        almacen: r2(almacenPer * n),
        gastos: r2(gastosPer * n),
        totalInteres: totalIntN,
        iva: ivaN,
        refrendo: r2(totalIntN + ivaN),
        desempeno: r2(prestamo + totalIntN + ivaN)
      });
    }
    const ult = filas[filas.length - 1];

    this.amortizacion = {
      periodoNombre: this.nombrePeriodo(dias),
      diasPorPeriodo: dias,
      numeroPeriodos: nPer,
      porcInteres, porcAlmacen, porcInteresTotal: porcTotal, ivaPorc: iva,
      avaluo: r2(avaluo),
      prestamo: r2(prestamo),
      interesPeriodo: r2(interesPer),
      ivaPeriodo: ivaPeriodoVal,
      totalPagoPeriodo: r2(r2(totalIntPer) + ivaPeriodoVal),
      alVencimiento: ult ? r2(ult.totalInteres + ult.iva) : 0,
      importeAEntregar: r2(prestamo),
      fechaLimiteNormal: fechaMas(dias * nPer + Number(params?.diasGraciaSinInteres ?? 0)),
      diasGracia: Number(params?.diasGraciaSinInteres ?? 0),
      filas,
      fechaLimiteExtemp: fechaMas(dias * nPer + dias),
      porcSancionSemanal: Number(params?.porcSancionSemanal ?? 0),
      sancionSemanal: r2(prestamo * Number(params?.porcSancionSemanal ?? 0) / 100),
      porcReposicion: Number(params?.porcReposicion ?? 0),
      fechaPaseVenta: fechaMas(dias * nPer + Number(params?.diasAntesPaseVenta ?? 0)),
      comisionVenta: r2(prestamo * Number(params?.comisionPorVentaPrenda ?? 0) / 100)
    };
    this.modalService.open(this.modalAmortizacion, { size: 'xl' });
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
