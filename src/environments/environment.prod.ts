// // src/environments/environment.prod.ts
// export const environment = {
//   production: true,
//   apiUrl: '/api',
//   adminToken: process.env['ADMIN_TOKEN'] || 'yugantarportfoliobadhan',
//   version: '1.0.0',
//   features: {
//     enableAnalytics: true,
//     enableLogging: false,
//     enableCache: true
//   }
// };

export const environment = {
  production: true,
  // Use environment variable if available, otherwise fallback to the Railway URL
  apiUrl: (globalThis as any)?.process?.env?.['API_URL'] || 'https://portfolio-api-production-b9dc.up.railway.app/api',
  adminToken: (globalThis as any)?.process?.env?.['ADMIN_TOKEN'] || 'yugantarportfoliobadhan',
  version: '1.0.0',
  features: {
    enableAnalytics: true,
    enableLogging: false,
    enableCache: true
  }
};