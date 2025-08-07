// src/app/core/services/config.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly config = environment;

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  get adminToken(): string {
    return this.config.adminToken;
  }

  get version(): string {
    return this.config.version;
  }

  get isProduction(): boolean {
    return this.config.production;
  }

  isFeatureEnabled(feature: keyof typeof environment.features): boolean {
    return this.config.features[feature];
  }

  // Company logos mapping for different companies
  getCompanyLogo(companyName: string): string {
    const logoMap: Record<string, string> = {
      'tata consultancy services': 'tcs',
      'tcs': 'tcs',
      'infosys': 'infosys',
      'wipro': 'wipro',
      'accenture': 'accenture',
      'microsoft': 'microsoft',
      'google': 'google',
      'amazon': 'amazon',
      'meta': 'meta',
      'facebook': 'meta',
      'apple': 'apple',
      'netflix': 'netflix',
      'uber': 'uber',
      'spotify': 'spotify',
      'adobe': 'adobe',
      'oracle': 'oracle',
      'salesforce': 'salesforce',
      'ibm': 'ibm',
      'default': 'building'
    };

    const normalized = companyName.toLowerCase().trim();
    return logoMap[normalized] || logoMap['default'];
  }

  // Get company brand color (for dynamic theming)
  getCompanyBrandColor(companyName: string): { light: string; dark: string } {
    const colorMap: Record<string, { light: string; dark: string }> = {
      'tcs': { light: '#0066cc', dark: '#4d9fff' },
      'infosys': { light: '#007cc3', dark: '#33a9e0' },
      'wipro': { light: '#7b3f98', dark: '#a66bb8' },
      'accenture': { light: '#a100ff', dark: '#c266ff' },
      'microsoft': { light: '#0078d4', dark: '#4da6e8' },
      'google': { light: '#4285f4', dark: '#6fa8f5' },
      'amazon': { light: '#ff9900', dark: '#ffb84d' },
      'meta': { light: '#1877f2', dark: '#5b9df5' },
      'apple': { light: '#000000', dark: '#ffffff' },
      'netflix': { light: '#e50914', dark: '#f14850' },
      'default': { light: '#007bff', dark: '#64b5f6' }
    };

    const normalized = companyName.toLowerCase().trim();
    return colorMap[normalized] || colorMap['default'];
  }
}