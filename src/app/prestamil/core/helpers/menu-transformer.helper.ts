import { NavigationItem } from '../../../theme/layout/admin/navigation/navigation';
import { OpcionMenu } from '../models/auth-response.model';

function normalizeMenuUrl(url: string): string {
  const normalizedUrl = url.replace('/default', '').replace(/\/$/, '');
  return normalizedUrl === '/avaluos/mock' ? '/avaluos' : normalizedUrl;
}

function normalizeNavigationItem(item: NavigationItem): NavigationItem {
  const children = item.children
    ?.filter(child => !['Parametros prestamo', 'Parámetros Préstamo'].includes(child.title ?? ''))
    .map(child => normalizeNavigationItem(child));
  const normalizedItem: NavigationItem = {
    ...item,
    title: item.url === '/avaluos' ? 'Avaluos' : item.title,
    children
  };

  if (!children) {
    return normalizedItem;
  }

  const hasAvaluos = new Set<string>();
  normalizedItem.children = children.filter(child => {
    if (child.url !== '/avaluos') {
      return true;
    }

    if (hasAvaluos.has(child.url)) {
      return false;
    }

    hasAvaluos.add(child.url);
    return true;
  });

  return normalizedItem;
}

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
    url = normalizeMenuUrl(opcion.url) || undefined;
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
      'Avaluos': '/avaluos',
      'Avaluos Prendarios': '/avaluos',
      'Prendas': '/catalogos/prendas',
      'Descuentos': '/catalogos/descuentos',
      'Sucursal': '/configuracion/sucursal',
      'Empresas': '/configuracion/empresas',
      'Empresa': '/configuracion/empresas',
      'Parametros Generales': '/configuracion/parametros-generales',
      'Parámetros Generales': '/configuracion/parametros-generales',
      'Plazos y Periodos': '/configuracion/plazos-periodos',
      'Configuración del Oro': '/configuracion/configuracion-oro',
      // Agregar más mapeos según sea necesario
    };
    
    const mappedUrl = opcionToUrlMap[opcion.opcion];
    if (mappedUrl) {
      url = mappedUrl;
    }
  }
  
  return {
    id: opcion.id.toString(),
    title: url === '/avaluos' ? 'Avaluos' : opcion.opcion,
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
  const items = opciones.map(opcion => normalizeNavigationItem(transformOpcion(opcion)));
  
  // Agrupar todas las opciones en un grupo principal
  return [
    normalizeNavigationItem({
      id: 'main-menu',
      title: '',
      type: 'group',
      icon: 'icon-navigation',
      children: items
    })
  ];
}

