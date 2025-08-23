import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, withFetch } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(
      routes, 
      withInMemoryScrolling({
        // Always scroll to top on route changes
        scrollPositionRestoration: 'top',
        // Enable anchor scrolling for smooth navigation
        anchorScrolling: 'enabled'
      }),
      withViewTransitions() // Add smooth transitions between views
    ),
    provideHttpClient(withInterceptorsFromDi(), withFetch()),
    provideClientHydration()
  ]
};