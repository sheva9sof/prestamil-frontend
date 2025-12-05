// Script para verificar el menú en localStorage
// Ejecutar en la consola del navegador o con Node.js

// Simulación de localStorage para Node.js
if (typeof localStorage === 'undefined') {
  console.log('Este script debe ejecutarse en la consola del navegador después de iniciar sesión');
  console.log('Para verificar el menú, ejecuta en la consola del navegador:');
  console.log('');
  console.log('const menuItems = JSON.parse(localStorage.getItem("menuItems"));');
  console.log('console.log(JSON.stringify(menuItems, null, 2));');
  console.log('');
  console.log('Busca el elemento "Turnos" y verifica si tiene:');
  console.log('- icon: "icon-..." (nombre del icono)');
  console.log('- url: "/turnos"');
  process.exit(0);
}

// Si se ejecuta en el navegador
const menuItems = JSON.parse(localStorage.getItem('menuItems'));
console.log('Menú actual:', JSON.stringify(menuItems, null, 2));

// Buscar el item Turnos
function findTurnos(items) {
  for (const item of items) {
    if (item.title === 'Turnos') {
      return item;
    }
    if (item.children) {
      const found = findTurnos(item.children);
      if (found) return found;
    }
  }
  return null;
}

const turnosItem = findTurnos(menuItems);
if (turnosItem) {
  console.log('\n=== Item Turnos encontrado ===');
  console.log('Título:', turnosItem.title);
  console.log('Icono:', turnosItem.icon || 'NO TIENE ICONO');
  console.log('URL:', turnosItem.url || 'NO TIENE URL');
  console.log('Tipo:', turnosItem.type);
  console.log('\nDatos completos:', JSON.stringify(turnosItem, null, 2));
  
  if (!turnosItem.icon) {
    console.log('\n⚠️ PROBLEMA: El item Turnos no tiene icono definido');
    console.log('Solución: El backend debe enviar icono="true" y nombreIcono="icon-calendar" (o el icono deseado)');
  }
} else {
  console.log('⚠️ No se encontró el item Turnos en el menú');
}
