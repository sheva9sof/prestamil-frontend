import { NavigationItem } from '../../../theme/layout/admin/navigation/navigation';
import { OpcionMenu } from '../models/auth-response.model';

/**
 * Transforma una opción del backend a NavigationItem
 */
function transformOpcion(opcion: OpcionMenu): NavigationItem {
  const hasSubmenus = opcion.submenus && opcion.submenus.length > 0;
  
  // Determinar el tipo basado en si tiene submenus
  const type: 'item' | 'collapse' = hasSubmenus ? 'collapse' : 'item';
  
  const icon: string | undefined = opcion.nombreIcono ?? undefined;
  
  // Transformar los submenus recursivamente
  const children: NavigationItem[] | undefined = hasSubmenus
    ? opcion.submenus.map(submenu => transformOpcion(submenu))
    : undefined;
  
  // Validar y limpiar la URL
  let url: string | undefined = undefined;
  if (opcion.url) {
    // Normalizar URLs (remover /default si existe, limpiar barras finales)
    url = opcion.url.replace('/default', '').replace(/\/$/, '') || undefined;
    // Si la URL está vacía después de normalizar, usar undefined
    if (url === '') {
      url = undefined;
    }
  }
  
  // Si no tiene URL y no tiene submenús, asignar URL basada en el nombre de la opción
  if (!url && !hasSubmenus) {
    // Mapeo de nombres de opciones a rutas
    const opcionToUrlMap: { [key: string]: string } = {
      'Turnos': '/turnos',
      'Clientes': '/clientes',
      'Usuarios': '/usuarios',
      'Usuario': '/usuarios',
      'Hardware': '/hardware',
      'Prendas': '/catalogos/prendas',
      'Descuentos': '/catalogos/descuentos',
      'Sucursal': '/configuracion/sucursal',
      'Empresas': '/configuracion/empresas',
      'Empresa': '/configuracion/empresas',
      'Parametros prestamo': '/configuracion/parametros-prestamo',
      'Parámetros Préstamo': '/configuracion/parametros-prestamo',
      'Parametros Generales': '/configuracion/parametros-generales',
      'Parámetros Generales': '/configuracion/parametros-generales',
      'Plazos y Periodos': '/configuracion/plazos-periodos',
      // Agregar más mapeos según sea necesario
    };
    
    const mappedUrl = opcionToUrlMap[opcion.opcion];
    if (mappedUrl) {
      url = mappedUrl;
    }
  }
  
  return {
    id: opcion.id.toString(),
    title: opcion.opcion,
    type: type,
    icon: icon,
    url: url,
    classes: 'nav-item',
    children: children
  };
}

/**
 * Transforma las opciones del backend a NavigationItem[] agrupadas
 */
export function transformOpcionesToNavigationItems(opciones: OpcionMenu[]): NavigationItem[] {
  if (!opciones || opciones.length === 0) {
    return [];
  }
  
  // Transformar cada opción
  const items = opciones.map(opcion => transformOpcion(opcion));
  
  // Agrupar todas las opciones en un grupo principal
  return [
    {
      id: 'main-menu',
      title: '',
      type: 'group',
      icon: 'icon-navigation',
      children: items
    }
  ];
}

