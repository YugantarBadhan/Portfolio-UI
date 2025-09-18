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
  apiUrl: 'https://portfolio-api-production-b9dc.up.railway.app/api',
  adminToken: process.env['ADMIN_TOKEN'] || 'yugantarportfoliobadhan',
  version: '1.0.0',
  features: {
    enableAnalytics: true,
    enableLogging: false,
    enableCache: true
  }
};