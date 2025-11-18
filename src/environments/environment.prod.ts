import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'http://localhost:8080' // TODO: Cambiar por la URL de producción cuando esté lista
};
