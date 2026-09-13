import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, Observable, OperatorFunction, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';
import { PlazoService } from 'src/app/prestamil/core/services/plazo.service';
import { ClienteService } from 'src/app/prestamil/core/services/cliente.service';
import { ContratoService } from 'src/app/prestamil/core/services/contrato.service';
import { PrendaService } from 'src/app/prestamil/core/services/prenda.service';
import { PlazoHechuraAlhajaResponse, PlazoParametroResponse } from 'src/app/prestamil/core/models/plazo.model';
import { ClienteResponse } from 'src/app/prestamil/core/models/cliente.model';
import { ContratoRequest, PartidaContratoRequest } from 'src/app/prestamil/core/models/contrato.model';
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
  /** Peso del metal precioso (g), del lote completo. Alimenta el cálculo de avalúo y préstamo. */
  pesoNeto: number;
  /** Peso físico total (g) incluyendo piedras y soldadura. Informativo; nunca entra al cálculo. */
  pesoTotal: number;
  kilataje?: number;
  ley?: number;
  hechura?: string;
  hechuraCod?: string;
  precioXGramo?: number;
  avaluoReal: number;
  avaluoContrato: number;
  prestamo: number;
  estatus: string;
  subtipo?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  estadoFisico?: string;
}

/**
 * Salida de los motores de cálculo (alhajas/plata). La comparten la captura en curso y el
 * recálculo de las partidas ya capturadas: una sola fórmula, dos consumidores.
 */
interface CalculoPartida {
  precioXGramo: number;
  avaluoReal: number;
  avaluoContrato: number;
  prestamo: number;
}

/** Todo lo que el servidor aporta para calcular con un plazo: precios de oro + parámetros por tipo. */
interface DatosPlazo {
  tablaAlhajas: PlazoHechuraAlhajaResponse[];
  params: Record<number, PlazoParametroResponse>;
}

/**
 * Un renglón del comparador: el MISMO contrato capturado, visto con otro plazo.
 * Es la vista que el valuador le gira al cliente para negociar.
 */
interface OpcionPlazo {
  plazo: PlazoAvaluo;
  /** Cuánto se lleva hoy el cliente. Cambia con el plazo: el precio por gramo es por plazo. */
  prestamo: number;
  /** Lo que paga cada periodo para mantener vigente el contrato (refrendo: intereses + IVA). */
  pagoPorPeriodo: number;
  /** Lo que paga al final para recuperar la prenda (préstamo + intereses + IVA). */
  desempeno: number;
  /** Lo que le cuesta el crédito: desempeño − préstamo. */
  costo: number;
  fechaVencimiento: string;
  esActual: boolean;
  /** Vacío si el plazo es ofrecible; si no, por qué el sistema lo rechazaría. */
  motivoNoViable: string;
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
  aplicaSancion: boolean;
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
  idAtributo: number;
  categoria: string;
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
  /** Vacío hasta elegir plazo: sin plazo no hay tipo capturable (bloqueo preventivo). */
  tipoSeleccionado = '';

  private readonly TIPO_PRENDA_ID: Record<string, number> = {
    'Alhajas': 1, 'Plata': 4, 'Varios': 3, 'Autos/Motos': 5
  };

  /** Tipos sin flujo de captura implementado: se bloquean aunque el plazo los admita. */
  private readonly TIPOS_NO_IMPLEMENTADOS = ['Autos/Motos'];

  /**
   * Tipos que el plazo seleccionado admite según plazo_prenda. Vacío mientras no haya plazo.
   * Se recalcula en cada cambio de plazo; es la fuente del grisado en el selector.
   */
  tiposPermitidos: string[] = [];

  /**
   * Un tipo es capturable solo si el plazo lo admite (plazo_prenda) Y tiene flujo implementado.
   * Doble candado: la misma condición se revalida al agregar la partida.
   */
  tipoHabilitado(tipo: string): boolean {
    return this.tiposPermitidos.includes(tipo) && !this.TIPOS_NO_IMPLEMENTADOS.includes(tipo);
  }

  /** Explica en el tooltip por qué un tipo aparece grisado. */
  motivoTipoDeshabilitado(tipo: string): string {
    if (tipo === '') {
      return 'Selecciona un tipo de prenda';
    }
    if (this.TIPOS_NO_IMPLEMENTADOS.includes(tipo)) {
      return `${tipo} no está disponible en esta versión`;
    }
    if (!this.plazoSeleccionado) {
      return 'Selecciona un plazo para habilitar los tipos de prenda';
    }
    if (!this.tiposPermitidos.includes(tipo)) {
      return `El plazo "${this.plazoSeleccionado.nombre}" no admite ${tipo}`;
    }
    return '';
  }

  get puedeAgregarPartida(): boolean {
    return this.tipoSeleccionado !== '' && this.tipoHabilitado(this.tipoSeleccionado);
  }

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

  // Los tiposPrenda del demo replican plazo_prenda real (002-initial-data.sql): sin ellos
  // el fallback dejaría los cuatro tipos grisados y la pantalla inservible.
  private readonly plazosDemo: PlazoAvaluo[] = [
    { id: 1, nombre: 'ALHAJAS - 12 SEMANAS', diasPorPeriodo: 7,  numeroPeriodos: 12, tiposPrenda: [{ id: 1, tipo: 'ALHAJA' }] },
    { id: 2, nombre: 'ALHAJAS - 10 SEMANAS', diasPorPeriodo: 7,  numeroPeriodos: 10, tiposPrenda: [{ id: 1, tipo: 'ALHAJA' }] },
    { id: 3, nombre: 'QUINCENAL',            diasPorPeriodo: 15, numeroPeriodos: 6,  tiposPrenda: [{ id: 4, tipo: 'PLATAS' }] },
    { id: 4, nombre: 'MENSUAL',              diasPorPeriodo: 30, numeroPeriodos: 6,  tiposPrenda: [{ id: 3, tipo: 'VARIOS' }] }
  ];

  // Precios fallback mientras no haya tabla cargada (última tabla real o demo)
  private readonly preciosOro: Record<number, number> = {
    6: 118.84, 8: 384.65, 10: 488.26, 12: 591.38,
    14: 695.74, 18: 900.01, 21: 1052.50, 24: 0
  };

  // -------------------------------------------------------------------------
  // Datos de plazo (precios y parámetros, cacheados por plazo)
  // -------------------------------------------------------------------------

  /**
   * Caché de precios/parámetros por id de plazo. El comparador necesita los datos de VARIOS
   * plazos a la vez, así que se piden una sola vez por plazo y se reusan.
   *
   * Vive lo que dura la pantalla: si un gerente cambia el precio del oro mientras hay una
   * captura abierta, hay que volver a entrar a Avalúos para verlo.
   */
  private datosPorPlazo: Record<number, DatosPlazo> = {};

  private readonly DATOS_PLAZO_VACIO: DatosPlazo = { tablaAlhajas: [], params: {} };

  /** Datos del plazo seleccionado; vacíos mientras no hay plazo o su carga no termina. */
  private get datosPlazoActual(): DatosPlazo {
    return this.plazoSeleccionado
      ? (this.datosPorPlazo[this.plazoSeleccionado.id] ?? this.DATOS_PLAZO_VACIO)
      : this.DATOS_PLAZO_VACIO;
  }

  private getParams(tipoPrendaId: number): PlazoParametroResponse | null {
    return this.paramsDe(this.datosPlazoActual, tipoPrendaId);
  }

  private paramsDe(datos: DatosPlazo, tipoPrendaId: number): PlazoParametroResponse | null {
    return datos.params[tipoPrendaId] ?? null;
  }

  /**
   * Trae precios y parámetros de un plazo en un solo golpe y los cachea. Los errores se
   * absorben en datos vacíos: la pantalla cae a los precios demo en vez de quedarse muerta.
   */
  private cargarDatosPlazo(plazoId: number): Observable<DatosPlazo> {
    const cacheado = this.datosPorPlazo[plazoId];
    if (cacheado) {
      return of(cacheado);
    }

    return forkJoin({
      tabla: this.plazoService.getTablaAlhajas(plazoId, this.sucursalId).pipe(
        catchError(() => of([] as PlazoHechuraAlhajaResponse[]))
      ),
      lista: this.plazoService.getParametrosBySucursal(plazoId, this.sucursalId).pipe(
        catchError(() => of([] as PlazoParametroResponse[]))
      )
    }).pipe(
      map(({ tabla, lista }) => {
        const params: Record<number, PlazoParametroResponse> = {};
        (lista ?? []).forEach(p => { params[p.tipoPrendaId] = p; });
        const datos: DatosPlazo = { tablaAlhajas: tabla ?? [], params };
        this.datosPorPlazo[plazoId] = datos;
        return datos;
      })
    );
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

  /** Plazo vigente antes del cambio en curso: permite revertir el select si se cancela. */
  private plazoPrevio: PlazoAvaluo | null = null;

  /** Partidas que el plazo entrante no admite; alimenta el modal de confirmación. */
  partidasIncompatibles: PartidaAvaluo[] = [];

  /** Nombres de los tipos de prenda (según plazo_prenda) que admite un plazo. */
  private tiposPermitidosDe(plazo: PlazoAvaluo): string[] {
    return this.tiposPrenda.filter(tipo =>
      (plazo.tiposPrenda ?? []).some(asociado => Number(asociado.id) === this.TIPO_PRENDA_ID[tipo])
    );
  }

  /**
   * Al cambiar de plazo se recalculan los tipos capturables. Si ya hay partidas de un tipo
   * que el plazo entrante no admite, se pide confirmación antes de descartarlas: cancelar
   * devuelve el select al plazo anterior y deja las partidas intactas.
   */
  onPlazoChange(plazo: PlazoAvaluo | null): void {
    if (!plazo) {
      this.aplicarPlazo(null);
      return;
    }

    const idsPermitidos = new Set(
      this.tiposPermitidosDe(plazo).map(tipo => this.TIPO_PRENDA_ID[tipo])
    );
    const incompatibles = this.partidas.filter(p => !idsPermitidos.has(p.idTipoPrenda));

    if (incompatibles.length === 0) {
      this.aplicarPlazo(plazo);
      return;
    }

    this.partidasIncompatibles = incompatibles;
    this.modalService.open(this.modalCambioPlazo, { size: 'md' }).result.then(
      () => {
        // No se reindexa: siguienteIdPartida garantiza ids únicos, y el "#" de la tabla
        // es el índice de la fila, así que los huecos no se ven.
        this.partidas = this.partidas.filter(p => idsPermitidos.has(p.idTipoPrenda));
        if (this.partidaEnEdicion !== null && !this.partidas.some(p => p.id === this.partidaEnEdicion)) {
          this.cancelarEdicion();
        }
        this.partidasIncompatibles = [];
        this.aplicarPlazo(plazo);
        this.mostrarExito(`Se descartaron ${incompatibles.length} partida(s) que el plazo "${plazo.nombre}" no admite.`);
      },
      () => {
        // Cancelado: se revierte el select al plazo anterior y no se toca nada más.
        this.partidasIncompatibles = [];
        this.plazoSeleccionado = this.plazoPrevio;
      }
    );
  }

  /** Aplica el plazo: fija los tipos capturables y carga tabla de alhajas + parámetros. */
  private aplicarPlazo(plazo: PlazoAvaluo | null): void {
    this.plazoPrevio = plazo;

    if (!plazo) {
      this.tiposPermitidos = [];
      this.tipoSeleccionado = '';
      return;
    }

    this.tiposPermitidos = this.tiposPermitidosDe(plazo);

    // Si el tipo en curso ya no lo admite el plazo, se deselecciona y se salta al primer
    // tipo capturable (o a ninguno, si el plazo solo admite tipos sin flujo implementado).
    if (!this.tipoHabilitado(this.tipoSeleccionado)) {
      const primerCapturable = this.tiposPermitidos.find(tipo => this.tipoHabilitado(tipo));
      this.seleccionarTipo(primerCapturable ?? '');
    }

    // Precios y parámetros del plazo (del caché si ya se visitó). Al terminar se recalcula
    // la captura en curso y TODAS las partidas ya capturadas: cambiar de plazo no obliga a
    // recapturar. Si el usuario alterna rápido entre plazos no hay carrera: el recálculo lee
    // los datos del plazo vigente por su id, no los de la respuesta que acaba de llegar.
    this.cargarDatosPlazo(plazo.id).subscribe(() => {
      this.recalcularCaptura();
      this.recalcularVarios();
      this.recalcularPartidas();
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
  catalogoPrendasError = '';

  // -------------------------------------------------------------------------
  // Estado — captura ALHAJAS/PLATA
  // -------------------------------------------------------------------------
  captura = {
    clavePrenda: '',
    nombreCatalogo: '',
    descripcion: '',
    hechura: 'NORMAL',
    kilataje: 14,
    ley: 925,
    cantidad: 1,
    // Ambos pesos son del LOTE completo cuando cantidad > 1: nunca se multiplican por cantidad.
    pesoNeto: 0,
    pesoTotal: 0,   // 0 = no capturado; al agregar la partida se iguala al neto
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
    idValorPrenda: undefined as number | undefined,
    clavePrenda: '',
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
   * Motor de cálculo de plata (Phase 6 — PLATA-01/PLATA-03, D-01/D-10).
   *   avaluo   = peso x precio por gramo de la ley (ley925 / ley725 de plazo_parametro)
   *   prestamo = peso x precio (COCAE: el precio por gramo YA es el prestamo; NO se aplica
   *              "% Prestamo s/Avaluo", ese recorte no aplica a plata). Es el máximo autorizado.
   * NUNCA usa tablaAlhajas ni preciosOro: esos son precios de ORO.
   * El valor persistido lo recalcula el servidor en ContratoService.buildPartida.
   *
   * Único lugar donde vive la fórmula: lo usan la captura en curso y el recálculo por
   * cambio de plazo, para que una partida recalculada quede idéntica a recapturarla.
   */
  private calcularPlata(ley: number, pesoNeto: number, datos: DatosPlazo): CalculoPartida {
    const params = this.paramsDe(datos, this.TIPO_PRENDA_ID['Plata']);
    const precioXGramo = +ley === 925 ? (params?.ley925 ?? 0) : (params?.ley725 ?? 0);
    const avaluoReal = +(precioXGramo * pesoNeto).toFixed(2);
    const prestamo = avaluoReal;
    return { precioXGramo, avaluoReal, prestamo, avaluoContrato: this.avaluoContratoDesde(prestamo, params) };
  }

  /** Preview de plata sobre la captura en curso. */
  recalcularPlata(): void {
    const calculo = this.calcularPlata(+this.captura.ley, this.captura.pesoNeto, this.datosPlazoActual);
    this.captura.precioXGramo = calculo.precioXGramo;
    this.captura.avaluoReal = calculo.avaluoReal;
    this.prestamoMaximoPlata = calculo.prestamo;

    // Propuesta inicial = el máximo (peso × precio). Al cambiar peso/ley/plazo SIEMPRE se re-propone
    // el máximo, para que el préstamo no se quede pegado en un valor viejo mientras escribes el peso
    // (ej. teclear "20" pasa por "2" → préstamo 13). El ajuste a la baja se hace en el campo Préstamo
    // (ajustarPrestamoPlata). Igual que oro, que también recalcula el préstamo al cambiar el peso.
    this.captura.prestamo = calculo.prestamo;
    this.captura.avaluoContrato = calculo.avaluoContrato;
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

  /**
   * Motor de cálculo de alhajas: el préstamo sale de la tabla de precios del plazo
   * (kilataje + hechura), así que cambiar de plazo cambia el resultado.
   * Único lugar donde vive la fórmula — ver calcularPlata.
   */
  private calcularAlhaja(
    kilataje: number,
    hechuraCod: string,
    pesoNeto: number,
    idTipoPrenda: number,
    datos: DatosPlazo
  ): CalculoPartida {
    const row = datos.tablaAlhajas.find(r => r.kilataje === +kilataje && r.hechura === hechuraCod);

    let precioXGramo: number;
    let prestamo: number;
    if (row) {
      precioXGramo = row.precioBase;
      prestamo = +(row.precioPrestamo * pesoNeto).toFixed(2);
    } else {
      // Fallback a precios demo mientras no haya tabla real
      const precioBase = this.preciosOro[+kilataje] ?? 0;
      precioXGramo = precioBase;
      prestamo = +(precioBase * pesoNeto * 1.03).toFixed(2);
    }

    const params = this.paramsDe(datos, idTipoPrenda);
    return { precioXGramo, avaluoReal: prestamo, prestamo, avaluoContrato: this.avaluoContratoDesde(prestamo, params) };
  }

  /** Preview de alhajas sobre la captura en curso. */
  recalcularAlhajas(): void {
    const calculo = this.calcularAlhaja(
      +this.captura.kilataje,
      this.hechuraCodigo(this.captura.hechura),
      this.captura.pesoNeto,
      this.TIPO_PRENDA_ID[this.tipoSeleccionado] ?? 1,
      this.datosPlazoActual
    );
    this.captura.precioXGramo = calculo.precioXGramo;
    this.captura.prestamo = calculo.prestamo;
    this.captura.avaluoReal = calculo.avaluoReal;
    this.captura.avaluoContrato = calculo.avaluoContrato;
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

  /**
   * Contador monótono del id de partida: nunca se reutiliza un id, aunque se eliminen filas.
   * Derivarlo de partidas.length reciclaba ids (eliminar la #2 de 3 y agregar otra producía
   * dos filas con id 3, y eliminar borraba ambas). El "#" visible es el índice de la fila.
   */
  private siguienteIdPartida = 1;

  /** Id de la partida que se está modificando; null en modo alta. */
  partidaEnEdicion: number | null = null;

  get enModoEdicion(): boolean {
    return this.partidaEnEdicion !== null;
  }

  /** "#" de la fila en edición (el mismo que muestra la tabla), para rotularlo en el formulario. */
  get numeroPartidaEnEdicion(): number {
    return this.partidas.findIndex(p => p.id === this.partidaEnEdicion) + 1;
  }

  get totalPartidas(): number       { return this.partidas.length; }
  /** Suma del metal precioso de todas las partidas: es el gramaje que se cobra. */
  get sumaPesoNeto(): number        { return this.partidas.reduce((a, i) => a + i.pesoNeto, 0); }
  /** Suma del peso físico de todas las partidas (metal + piedras). Informativo. */
  get sumaPesoTotal(): number       { return this.partidas.reduce((a, i) => a + i.pesoTotal, 0); }
  get avaluoTotal(): number         { return this.partidas.reduce((a, i) => a + i.avaluoReal, 0); }
  get avaluoContratoTotal(): number { return this.partidas.reduce((a, i) => a + i.avaluoContrato, 0); }
  get prestamoTotal(): number       { return this.partidas.reduce((a, i) => a + i.prestamo, 0); }

  /**
   * Recalcula TODAS las partidas ya capturadas con los precios y parámetros del plazo
   * vigente, y refresca la tabla de amortización. El valuador negocia el plazo con el
   * cliente: cambiarlo no debe obligar a recapturar las partidas.
   *
   * Es idempotente — cada partida se re-deriva de sus propios datos de captura (peso,
   * kilataje, ley), nunca de un resultado anterior — así que puede correr varias veces
   * mientras llegan las respuestas de precios y parámetros del plazo.
   */
  private recalcularPartidas(): void {
    if (this.partidas.length > 0) {
      this.partidas = this.partidas.map(partida => this.recalcularPartida(partida, this.datosPlazoActual));
    }
    this.onPartidasCambiaron();
  }

  /**
   * Refresca todo lo que se deriva de las partidas: la tabla de amortización y el comparador
   * de plazos. Se llama al agregar, editar o eliminar una partida, y tras cambiar de plazo.
   */
  private onPartidasCambiaron(): void {
    this.refrescarAmortizacion();
    this.actualizarComparativa();
  }

  /**
   * Re-deriva préstamo y avalúos de una partida con los datos de UN plazo, reusando su motor
   * de cálculo. No muta: devuelve una copia, así que el comparador puede evaluar la partida
   * con plazos alternativos sin tocar la capturada.
   */
  private recalcularPartida(partida: PartidaAvaluo, datos: DatosPlazo): PartidaAvaluo {
    if (partida.tipo === 'Varios') {
      // Varios no tiene fórmula de avalúo: el préstamo lo teclea el valuador y se respeta.
      // Del plazo solo depende el avalúo de contrato (% sobre el préstamo).
      return {
        ...partida,
        avaluoContrato: this.avaluoContratoDesde(partida.prestamo, this.paramsDe(datos, partida.idTipoPrenda))
      };
    }

    // Plata: se re-propone el máximo del plazo nuevo (peso × precio/gramo). Un ajuste a la
    // baja que el valuador hubiera hecho con el plazo anterior se pierde, igual que al
    // recapturar la partida desde cero; el descuento se vuelve a aplicar en el formulario.
    const calculo = partida.tipo === 'Plata'
      ? this.calcularPlata(partida.ley ?? 925, partida.pesoNeto, datos)
      : this.calcularAlhaja(partida.kilataje ?? 0, partida.hechuraCod ?? 'N', partida.pesoNeto, partida.idTipoPrenda, datos);

    return {
      ...partida,
      precioXGramo: calculo.precioXGramo,
      avaluoReal: calculo.avaluoReal,
      avaluoContrato: calculo.avaluoContrato,
      prestamo: calculo.prestamo
    };
  }

  // -------------------------------------------------------------------------
  // Comparador de plazos (negociación con el cliente)
  // -------------------------------------------------------------------------
  comparativaPlazos: OpcionPlazo[] = [];
  isLoadingComparativa = false;

  /**
   * Plazos ofrecibles: los que admiten TODOS los tipos ya capturados. Ofrecer uno que no
   * los admita obligaría a descartar partidas, que es justo lo contrario de negociar.
   */
  private plazosOfrecibles(): PlazoAvaluo[] {
    const tiposCapturados = [...new Set(this.partidas.map(p => p.idTipoPrenda))];
    return this.plazos.filter(plazo => {
      const admitidos = new Set((plazo.tiposPrenda ?? []).map(t => Number(t.id)));
      return tiposCapturados.every(id => admitidos.has(id));
    });
  }

  /**
   * Recalcula el comparador: el mismo contrato capturado, evaluado con cada plazo ofrecible.
   * Los precios de cada plazo se cachean, así que solo pega al servidor la primera vez que
   * se evalúa cada uno; de ahí en adelante es cálculo local.
   */
  private actualizarComparativa(): void {
    const candidatos = this.partidas.length > 0 ? this.plazosOfrecibles() : [];
    if (candidatos.length === 0) {
      this.comparativaPlazos = [];
      return;
    }

    this.isLoadingComparativa = true;
    forkJoin(candidatos.map(plazo => this.cargarDatosPlazo(plazo.id)))
      .pipe(finalize(() => { this.isLoadingComparativa = false; }))
      .subscribe({
        next: (datos) => {
          this.comparativaPlazos = candidatos.map((plazo, i) => this.evaluarPlazo(plazo, datos[i]));
        },
        error: () => { this.comparativaPlazos = []; }
      });
  }

  /** Evalúa el contrato capturado con un plazo alternativo, sin tocar las partidas reales. */
  private evaluarPlazo(plazo: PlazoAvaluo, datos: DatosPlazo): OpcionPlazo {
    const partidas = this.partidas.map(p => this.recalcularPartida(p, datos));
    const prestamo = partidas.reduce((a, p) => a + p.prestamo, 0);
    const amortizacion = this.calcularAmortizacion(plazo, datos, partidas);
    const ultima = amortizacion?.filas[amortizacion.filas.length - 1];
    const desempeno = ultima?.desempeno ?? prestamo;

    return {
      plazo,
      prestamo: +prestamo.toFixed(2),
      pagoPorPeriodo: amortizacion?.totalPagoPeriodo ?? 0,
      desempeno,
      costo: +(desempeno - prestamo).toFixed(2),
      fechaVencimiento: this.fechaVencimientoDe(plazo),
      esActual: this.plazoSeleccionado?.id === plazo.id,
      motivoNoViable: this.motivoPlazoNoViable(partidas, datos)
    };
  }

  /**
   * Réplica de las validaciones que el backend aplica al guardar (ContratoService.buildPartida):
   * si el plazo produciría un contrato rechazado, se marca aquí en vez de ofrecérselo al
   * cliente y fallar al generarlo.
   */
  private motivoPlazoNoViable(partidas: PartidaAvaluo[], datos: DatosPlazo): string {
    const sinPrecio = partidas.find(p => p.prestamo <= 0);
    if (sinPrecio) {
      return `Sin precios configurados para ${sinPrecio.tipo} en este plazo`;
    }

    for (const partida of partidas) {
      const minimo = this.paramsDe(datos, partida.idTipoPrenda)?.importeMinPrestamo ?? 0;
      if (minimo > 0 && partida.prestamo < minimo) {
        return `Una partida queda bajo el préstamo mínimo de $${minimo.toFixed(2)}`;
      }
    }

    return '';
  }

  /** Aplica el plazo elegido en el comparador. Solo lista plazos compatibles: no descarta partidas. */
  seleccionarPlazoComparativa(opcion: OpcionPlazo): void {
    if (opcion.esActual || opcion.motivoNoViable) {
      return;
    }
    this.plazoSeleccionado = opcion.plazo;
    this.onPlazoChange(opcion.plazo);
  }

  /** Diferencia de préstamo contra el plazo vigente: es el argumento de venta ("te doy $X más"). */
  diferenciaPrestamo(opcion: OpcionPlazo): number {
    const actual = this.comparativaPlazos.find(o => o.esActual);
    return actual ? +(opcion.prestamo - actual.prestamo).toFixed(2) : 0;
  }

  // -------------------------------------------------------------------------
  // Acciones de flujo
  // -------------------------------------------------------------------------
  seleccionarTipo(tipo: string): void {
    // Candado preventivo: un tipo que el plazo no admite no se puede ni activar.
    if (tipo !== '' && !this.tipoHabilitado(tipo)) {
      this.mostrarError(this.motivoTipoDeshabilitado(tipo));
      return;
    }
    this.tipoSeleccionado = tipo;
    // Cambiar de tipo vacía la captura: una edición en curso perdería sus datos, así que
    // se abandona el modo edición y la partida original queda intacta.
    this.partidaEnEdicion = null;
    this.prendasCatalogo = [];
    this.prestamoMaximoPlata = 0;
    this.captura.prestamo = 0;
    this.recalcularCaptura();
  }

  /**
   * Valida la captura en curso. Es la única fuente de reglas para alta y edición: si
   * divergieran, se podría guardar editando algo que agregando se rechaza.
   * @return el mensaje de error, o null si la captura es válida.
   */
  private validarCaptura(): string | null {
    if (!this.clienteSeleccionado) {
      return 'Selecciona un cliente antes de capturar una partida';
    }
    if (!this.plazoSeleccionado) {
      return 'Selecciona un plazo antes de capturar una partida';
    }
    // Última línea de defensa: el selector ya bloquea los tipos no admitidos, pero se
    // revalida aquí por si el plazo cambió con una captura a medias.
    if (!this.tipoHabilitado(this.tipoSeleccionado)) {
      return this.motivoTipoDeshabilitado(this.tipoSeleccionado);
    }

    if (this.tipoSeleccionado === 'Alhajas' || this.tipoSeleccionado === 'Plata') {
      if (this.captura.pesoNeto <= 0) {
        return 'Captura un peso neto mayor a 0';
      }
      // El peso total es opcional (0 = no capturado), pero si viene no puede ser menor que el
      // neto: seria fisicamente imposible. El backend valida lo mismo en resolverPesoTotal.
      if (this.captura.pesoTotal > 0 && this.captura.pesoTotal < this.captura.pesoNeto) {
        return 'El peso total no puede ser menor que el peso neto';
      }
      if (this.tipoSeleccionado === 'Plata') {
        if (this.captura.precioXGramo <= 0) {
          return `No hay precio por gramo configurado para la ley ${this.captura.ley} en este plazo. `
            + `Configúralo en Configuración → Plazos y periodos → pestaña Platas.`;
        }
        if (this.captura.prestamo <= 0) {
          return 'Captura un préstamo mayor a 0';
        }
      }
    } else if (this.tipoSeleccionado === 'Varios' && this.capturaVarios.prestamo <= 0) {
      return 'Captura un préstamo mayor a 0';
    }

    return null;
  }

  /**
   * Arma la partida a partir de la captura en curso. Alta y edición la comparten, así que
   * una partida editada queda idéntica a recapturarla desde cero.
   * @param id id de la partida — uno nuevo al agregar, el existente al editar.
   */
  private construirPartida(id: number): PartidaAvaluo {
    if (this.tipoSeleccionado === 'Varios') {
      return {
        id,
        idTipoPrenda: 3,
        idValorPrenda: this.capturaVarios.idValorPrenda,
        tipo: 'Varios',
        clavePrenda: this.capturaVarios.clavePrenda
          || this.capturaVarios.subtipo.substring(0, 3).toUpperCase(),
        descripcion: `${this.capturaVarios.subtipo} ${this.capturaVarios.marca} ${this.capturaVarios.modelo}`.trim(),
        cantidad: 1,
        // Varios no se valua por gramo: ambos pesos quedan en 0 y se omiten al enviar al backend
        pesoNeto: 0,
        pesoTotal: 0,
        avaluoReal: this.capturaVarios.prestamo,
        avaluoContrato: this.capturaVarios.avaluoContrato,
        prestamo: this.capturaVarios.prestamo,
        estatus: 'Capturada',
        subtipo: this.capturaVarios.subtipo,
        marca: this.capturaVarios.marca,
        modelo: this.capturaVarios.modelo,
        serie: this.capturaVarios.serie,
        estadoFisico: this.capturaVarios.estado
      };
    }

    const esPlata = this.tipoSeleccionado === 'Plata';
    return {
      id,
      idTipoPrenda: this.TIPO_PRENDA_ID[this.tipoSeleccionado] ?? 1,
      idValorPrenda: this.captura.idValorPrenda,
      tipo: this.tipoSeleccionado,
      clavePrenda: this.captura.clavePrenda || '—',
      descripcion: this.captura.descripcion || this.captura.nombreCatalogo || (esPlata
        ? `Plata ley ${this.captura.ley}`
        : `${this.tipoSeleccionado} ${this.captura.kilataje}K`),
      cantidad: this.captura.cantidad,
      pesoNeto: this.captura.pesoNeto,
      // Sin peso total capturado se asume que la pieza es 100% metal (mismo criterio que el backend)
      pesoTotal: this.captura.pesoTotal > 0 ? this.captura.pesoTotal : this.captura.pesoNeto,
      kilataje: esPlata ? undefined : this.captura.kilataje,
      ley: esPlata ? +this.captura.ley : undefined,
      hechura: esPlata ? undefined : this.captura.hechura,
      hechuraCod: esPlata ? undefined : this.hechuraCodigo(this.captura.hechura),
      precioXGramo: this.captura.precioXGramo,
      avaluoReal: this.captura.avaluoReal,
      avaluoContrato: this.captura.avaluoContrato,
      prestamo: this.captura.prestamo,
      estatus: 'Capturada'
    };
  }

  /** Botón principal del formulario: da de alta o guarda la edición según el modo. */
  confirmarCaptura(): void {
    if (this.enModoEdicion) {
      this.guardarEdicion();
    } else {
      this.agregarPartida();
    }
  }

  agregarPartida(): void {
    const error = this.validarCaptura();
    if (error) {
      this.mostrarError(error);
      return;
    }

    this.partidas = [...this.partidas, this.construirPartida(this.siguienteIdPartida++)];
    this.onPartidasCambiaron();
    this.resetCaptura();
    this.mostrarExito('Partida agregada correctamente');
  }

  /**
   * Carga una partida ya capturada de vuelta en el formulario para modificarla sin
   * eliminarla. El tipo se conmuta al de la partida; si el plazo vigente no lo admite no
   * se edita, porque guardarla produciría una partida que el plazo rechaza.
   */
  editarPartida(partida: PartidaAvaluo): void {
    if (!this.tipoHabilitado(partida.tipo)) {
      this.mostrarError(`No se puede editar esta partida: ${this.motivoTipoDeshabilitado(partida.tipo)}`);
      return;
    }

    // seleccionarTipo limpia el formulario y sale de modo edición, así que el modo se
    // marca después de conmutar el tipo.
    this.seleccionarTipo(partida.tipo);
    this.partidaEnEdicion = partida.id;

    if (partida.tipo === 'Varios') {
      this.capturaVarios = {
        subtipo: partida.subtipo ?? '',
        idValorPrenda: partida.idValorPrenda,
        clavePrenda: partida.clavePrenda === '—' ? '' : partida.clavePrenda,
        marca: partida.marca ?? '',
        modelo: partida.modelo ?? '',
        serie: partida.serie ?? '',
        estado: partida.estadoFisico ?? 'Bueno',
        prestamo: partida.prestamo,
        avaluoContrato: partida.avaluoContrato
      };
      this.recalcularVarios();
      return;
    }

    this.captura = {
      ...this.captura,
      clavePrenda: partida.clavePrenda === '—' ? '' : partida.clavePrenda,
      // La descripción guardada ya incluye el fallback del catálogo o el generado, así que
      // se edita tal cual se ve en la tabla y nombreCatalogo deja de aportar.
      nombreCatalogo: '',
      descripcion: partida.descripcion,
      hechura: partida.hechura ?? this.captura.hechura,
      kilataje: partida.kilataje ?? this.captura.kilataje,
      ley: partida.ley ?? this.captura.ley,
      cantidad: partida.cantidad,
      pesoNeto: partida.pesoNeto,
      // El total se persiste igualado al neto cuando no se capturó: se reabre vacío para que
      // "= neto" siga siendo el default y no aparezca un dato que el usuario nunca tecleó.
      pesoTotal: partida.pesoTotal > partida.pesoNeto ? partida.pesoTotal : 0,
      // Color y claridad no se guardan en la partida: no hay de dónde reponerlos.
      color: '',
      claridad: '',
      idValorPrenda: partida.idValorPrenda
    };

    // Mismo motor de cálculo que al agregar: el préstamo/avalúo se re-derivan de los campos.
    this.recalcularCaptura();

    if (partida.tipo === 'Plata') {
      // recalcularPlata siempre re-propone el máximo; se restaura el ajuste a la baja
      // que el usuario hubiera hecho, revalidándolo contra el máximo vigente.
      this.captura.prestamo = partida.prestamo;
      this.ajustarPrestamoPlata();
    }
  }

  /** Reemplaza la partida editada en su lugar, conservando id y posición en la tabla. */
  guardarEdicion(): void {
    if (this.partidaEnEdicion === null) return;

    const error = this.validarCaptura();
    if (error) {
      this.mostrarError(error);
      return;
    }

    const id = this.partidaEnEdicion;
    const indice = this.partidas.findIndex(p => p.id === id);
    if (indice === -1) {
      // La partida desapareció mientras se editaba (cambio de plazo): no se reinserta.
      this.cancelarEdicion();
      return;
    }

    const actualizada = this.construirPartida(id);
    this.partidas = this.partidas.map((p, i) => (i === indice ? actualizada : p));
    this.partidaEnEdicion = null;
    this.onPartidasCambiaron();
    this.resetCaptura();
    this.mostrarExito('Partida actualizada correctamente');
  }

  /** Descarta los cambios del formulario; la partida original queda intacta. */
  cancelarEdicion(): void {
    this.partidaEnEdicion = null;
    this.resetCaptura();
  }

  eliminarPartida(id: number): void {
    if (this.partidaEnEdicion === id) {
      this.cancelarEdicion();
    }
    this.partidas = this.partidas.filter(p => p.id !== id);
    this.onPartidasCambiaron();
  }

  /**
   * Fecha de vencimiento del contrato = apertura + diasPorPeriodo × numeroPeriodos.
   * Es un dato del contrato, no de cada partida (antes se repetía igual en cada renglón de
   * la tabla). Al ser un getter, sigue solo al plazo vigente sin recálculo explícito.
   */
  get fechaVencimientoContrato(): string {
    return this.plazoSeleccionado ? this.fechaVencimientoDe(this.plazoSeleccionado) : '—';
  }

  /** La misma fecha para un plazo cualquiera: la usa el comparador en cada opción. */
  private fechaVencimientoDe(plazo: PlazoAvaluo): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + plazo.diasPorPeriodo * plazo.numeroPeriodos);
    return fecha.toLocaleDateString('es-MX');
  }

  /** Limpia el formulario del tipo en curso tras agregar, guardar o cancelar. */
  private resetCaptura(): void {
    if (this.tipoSeleccionado === 'Varios') {
      this.resetCapturaVarios();
    } else {
      this.resetCapturaAlhajas();
    }
  }

  private resetCapturaAlhajas(): void {
    this.captura = {
      ...this.captura,
      clavePrenda: '',
      nombreCatalogo: '',
      descripcion: '',
      cantidad: 1,
      pesoNeto: 0,
      pesoTotal: 0,
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
      idValorPrenda: undefined,
      clavePrenda: '',
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
  @ViewChild('modalCliente')      modalCliente!: TemplateRef<unknown>;
  @ViewChild('modalPrenda')       modalPrenda!: TemplateRef<unknown>;
  @ViewChild('modalContrato')     modalContrato!: TemplateRef<unknown>;
  @ViewChild('modalAmortizacion') modalAmortizacion!: TemplateRef<unknown>;
  @ViewChild('modalPdf')          modalPdf!: TemplateRef<unknown>;
  @ViewChild('modalCambioPlazo')  modalCambioPlazo!: TemplateRef<unknown>;

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
    }
  }

  seleccionarClienteAutocomplete(evento: NgbTypeaheadSelectItemEvent<ClienteLocal>): void {
    this.establecerCliente(evento.item);
  }

  seleccionarCliente(c: ClienteLocal, modal: NgbActiveModal): void {
    this.establecerCliente(c);
    modal.close();
  }

  private establecerCliente(cliente: ClienteLocal): void {
    this.clienteSeleccionado = cliente;
    this.clienteBusquedaInput = cliente;
    this.identificacionSeleccionada = cliente.identificacion;
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

  // --- Modal de prenda ---
  abrirBuscarPrenda(): void {
    // Plata conserva su selector especializado de ley; Autos/Motos aún no está habilitado.
    if (this.tipoSeleccionado !== 'Alhajas' && this.tipoSeleccionado !== 'Varios') return;
    this.filtroPrenda = '';
    this.catalogoPrendasError = '';
    this.prendasCatalogo = [];
    this.isLoadingPrendas = true;
    this.modalService.open(this.modalPrenda, { size: 'lg' });

    const tipoSeleccionado = this.tipoSeleccionado;
    const idTipoPrenda = this.TIPO_PRENDA_ID[tipoSeleccionado];
    this.prendaService.getSubtipos(idTipoPrenda).pipe(
      switchMap(subtipos => {
        if (subtipos.length === 0) return of([] as PrendaCatalogo[][]);
        return forkJoin(subtipos.map(subtipo =>
          this.prendaService.getValores(subtipo.idAtributo).pipe(
            map(valores => valores.map(valor => ({
              idValorAtributo: valor.idValorAtributo,
              idAtributo: subtipo.idAtributo,
              categoria: subtipo.nombreAtributo,
              clave: valor.clave != null ? String(valor.clave) : '—',
              descripcion: valor.descripcion ?? '',
              kilataje: valor.kilataje ?? 0,
              tipo: tipoSeleccionado
            }))),
            catchError(() => of([] as PrendaCatalogo[]))
          )
        ));
      }),
      map(grupos => grupos.flat()),
      finalize(() => { this.isLoadingPrendas = false; })
    ).subscribe({
      next: prendas => { this.prendasCatalogo = prendas; },
      error: () => {
        this.catalogoPrendasError = 'No se pudo cargar el catálogo de prendas.';
      }
    });
  }

  seleccionarPrenda(p: PrendaCatalogo, modal: NgbActiveModal): void {
    const clave = p.clave === '—' ? '' : p.clave;
    if (this.tipoSeleccionado === 'Alhajas') {
      this.captura.clavePrenda = clave;
      this.captura.nombreCatalogo = p.descripcion;
      this.captura.descripcion = '';
      this.captura.idValorPrenda = p.idValorAtributo;
      this.aplicarAtributosCatalogoAlhaja(p);
      this.recalcularAlhajas();
    } else if (this.tipoSeleccionado === 'Varios') {
      this.capturaVarios.clavePrenda = clave;
      this.capturaVarios.subtipo = p.descripcion;
      this.capturaVarios.idValorPrenda = p.idValorAtributo;
      this.recalcularVarios();
    }
    modal.close();
  }

  limpiarSeleccionCatalogoVarios(): void {
    this.capturaVarios.idValorPrenda = undefined;
    this.capturaVarios.clavePrenda = '';
  }

  private aplicarAtributosCatalogoAlhaja(prenda: PrendaCatalogo): void {
    const categoria = prenda.categoria.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    // La clave es el nombre del \u00edtem del cat\u00e1logo (los \u00edtems nuevos ya no traen descripci\u00f3n),
    // as\u00ed que el kilataje/hechura se infieren de clave + descripci\u00f3n hist\u00f3rica.
    const descripcion = `${prenda.clave === '\u2014' ? '' : prenda.clave} ${prenda.descripcion}`.trim().toUpperCase();

    if (prenda.kilataje > 0) {
      this.captura.kilataje = prenda.kilataje;
    } else if (categoria.includes('KILATAJE')) {
      const kilataje = Number(descripcion.match(/\d+/)?.[0]);
      if (this.kilatajes.includes(kilataje)) this.captura.kilataje = kilataje;
    }

    if (categoria.includes('HECHURA')) {
      const hechura = this.hechuras.find(valor => descripcion.includes(valor));
      if (hechura) this.captura.hechura = hechura;
    }
  }

  get prendasFiltradas(): PrendaCatalogo[] {
    const q = this.filtroPrenda.trim().toLowerCase();
    if (!q) return this.prendasCatalogo;
    return this.prendasCatalogo.filter(p =>
      p.clave.toLowerCase().includes(q)
      || p.descripcion.toLowerCase().includes(q)
      || p.categoria.toLowerCase().includes(q)
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
            this.partidaEnEdicion = null;
            this.clienteSeleccionado = null;
            this.clienteBusquedaInput = '';
            this.beneficiario = '';
            // Contrato ya generado y almacenado: el preview y el comparador se vacían.
            this.onPartidasCambiaron();
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
      pesoNeto: p.pesoNeto > 0 ? p.pesoNeto : undefined,
      pesoTotal: p.pesoNeto > 0 ? p.pesoTotal : undefined,
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

  // --- Modal de amortización (vencimientos del contrato en curso, estilo COCAE) ---
  private nombrePeriodo(dias: number): string {
    if (dias === 1) return 'DIARIO';
    if (dias === 7) return 'SEMANAL';
    if (dias === 15) return 'QUINCENAL';
    if (dias >= 28 && dias <= 31) return 'MENSUAL';
    return `${dias} DÍAS`;
  }

  /** Abre el modal estilo "Vencimientos de Contrato" de COCAE con la tabla recién calculada. */
  verAmortizacion(): void {
    if (this.partidas.length === 0) {
      this.mostrarError('Agrega al menos una partida para calcular los vencimientos');
      return;
    }
    if (!this.plazoSeleccionado) {
      this.mostrarError('Selecciona un plazo');
      return;
    }
    this.refrescarAmortizacion();
    this.modalService.open(this.modalAmortizacion, { size: 'xl' });
  }

  /**
   * Regenera la tabla de amortización con el plazo vigente. Se dispara también al cambiar
   * de plazo, para que el preview nunca quede con los vencimientos del plazo anterior.
   */
  private refrescarAmortizacion(): void {
    this.amortizacion = this.plazoSeleccionado
      ? this.calcularAmortizacion(this.plazoSeleccionado, this.datosPlazoActual, this.partidas)
      : null;
  }

  /**
   * Calcula la tabla de amortización de un conjunto de partidas bajo un plazo dado.
   * Cálculo de referencia al vuelo: interés/almacén/IVA acumulativos por periodo, con
   * desempeño = préstamo + acumulado.
   * Réplica de la fórmula verificada contra COCAE (ver Cerebro: flujo-plata).
   *
   * Puro respecto de sus argumentos: el comparador lo usa con plazos que NO son el
   * seleccionado para calcular lo que pagaría el cliente con cada opción.
   */
  private calcularAmortizacion(
    plazo: PlazoAvaluo,
    datos: DatosPlazo,
    partidas: PartidaAvaluo[]
  ): AmortizacionPreview | null {
    if (partidas.length === 0) {
      return null;
    }
    // Los parámetros son por tipo de prenda: se toman los de las partidas capturadas, no los
    // del tipo seleccionado en el formulario (tras un cambio de plazo puede no haber ninguno).
    const params = this.paramsDe(datos, partidas[0].idTipoPrenda);
    const prestamo = partidas.reduce((a, p) => a + p.prestamo, 0);
    const avaluo = partidas.reduce((a, p) => a + p.avaluoContrato, 0);
    const dias = plazo.diasPorPeriodo;
    const nPer = plazo.numeroPeriodos;

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

    const sancionActiva = !!params?.aplicarSancionPorPeriodo;
    const porcSancion = sancionActiva ? Number(params?.porcSancionSemanal ?? 0) : 0;

    return {
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
      // La sanción solo se informa si el plazo la tiene activada, igual que en el backend
      // (MovimientoContratoService.refrendar) y en el PDF del contrato.
      aplicaSancion: sancionActiva,
      porcSancionSemanal: porcSancion,
      sancionSemanal: r2(prestamo * porcSancion / 100),
      porcReposicion: Number(params?.porcReposicion ?? 0),
      fechaPaseVenta: fechaMas(dias * nPer + Number(params?.diasAntesPaseVenta ?? 0)),
      comisionVenta: r2(prestamo * Number(params?.comisionPorVentaPrenda ?? 0) / 100)
    };
  }

  // -------------------------------------------------------------------------
  // Tarjeta de pendientes (solo dev)
  // -------------------------------------------------------------------------
  pendientesAbiertas = false;
  togglePendientes(): void { this.pendientesAbiertas = !this.pendientesAbiertas; }
}
