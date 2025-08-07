// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: '/api',
  adminToken: process.env['ADMIN_TOKEN'] || 'default-secure-token',
  version: '1.0.0',
  features: {
    enableAnalytics: true,
    enableLogging: false,
    enableCache: true
  }
};