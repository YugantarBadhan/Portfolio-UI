// src/app/services/html-sanitizer.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class HtmlSanitizerService {
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
  
  /**
   * Sanitizes HTML content to prevent XSS attacks while preserving Quill editor formatting
   * @param html - The HTML content to sanitize
   * @returns Sanitized HTML string
   */
  sanitizeHtml(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    try {
      // Use different sanitization methods based on environment
      if (this.isBrowser && typeof document !== 'undefined') {
        return this.browserSanitize(html);
      } else {
        return this.serverSanitize(html);
      }
    } catch (error) {
      console.error('Error sanitizing HTML:', error);
      // Fallback: strip all HTML tags if sanitization fails
      return this.stripHtmlTags(html);
    }
  }

  /**
   * Browser-based sanitization using DOM manipulation
   */
  private browserSanitize(html: string): string {
    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove any script tags and event handlers
    this.removeScriptsAndEvents(tempDiv);

    // Clean up any potentially dangerous attributes
    this.cleanAttributes(tempDiv);

    return tempDiv.innerHTML;
  }

  /**
   * Server-side sanitization using regex patterns
   */
  private serverSanitize(html: string): string {
    let cleaned = html;
    
    // Remove script tags
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
    
    // Remove dangerous event attributes
    cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove dangerous protocols
    cleaned = cleaned.replace(/javascript:/gi, '');
    cleaned = cleaned.replace(/vbscript:/gi, '');
    cleaned = cleaned.replace(/data:/gi, '');
    
    // Remove dangerous tags
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button'];
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gis');
      cleaned = cleaned.replace(regex, '');
      const selfClosingRegex = new RegExp(`<${tag}[^>]*\/?>`, 'gi');
      cleaned = cleaned.replace(selfClosingRegex, '');
    });

    return cleaned;
  }

  /**
   * Removes script tags and event handler attributes (browser only)
   * @param element - The DOM element to clean
   */
  private removeScriptsAndEvents(element: Element): void {
    if (!this.isBrowser) return;

    // Remove script tags
    const scripts = element.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Remove elements with event handlers and dangerous attributes
    const allElements = element.querySelectorAll('*');
    allElements.forEach((el) => {
      // Remove event handler attributes
      const attributes = Array.from(el.attributes);
      attributes.forEach(attr => {
        const attrName = attr.name.toLowerCase();
        
        // Remove event handlers (onclick, onload, etc.)
        if (attrName.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        
        // Remove dangerous attributes
        const dangerousAttrs = ['javascript:', 'vbscript:', 'data:', 'mocha:', 'livescript:'];
        if (dangerousAttrs.some(dangerous => attr.value.toLowerCase().includes(dangerous))) {
          el.removeAttribute(attr.name);
        }
      });

      // Remove elements that are potentially dangerous
      const tagName = el.tagName.toLowerCase();
      const dangerousTags = ['script', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button'];
      if (dangerousTags.includes(tagName)) {
        el.remove();
      }
    });
  }

  /**
   * Cleans dangerous attributes while preserving safe formatting (browser only)
   * @param element - The DOM element to clean
   */
  private cleanAttributes(element: Element): void {
    if (!this.isBrowser) return;

    const allowedTags = new Set([
      'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ol', 'ul', 'li', 'blockquote', 'a'
    ]);

    const allowedAttributes = new Set([
      'class', 'style', 'href', 'target', 'rel'
    ]);

    const allElements = element.querySelectorAll('*');
    allElements.forEach((el) => {
      const tagName = el.tagName.toLowerCase();
      
      // Remove elements that aren't in our allowed list
      if (!allowedTags.has(tagName)) {
        // Replace with span to preserve content
        const span = document.createElement('span');
        span.innerHTML = el.innerHTML;
        el.parentNode?.replaceChild(span, el);
        return;
      }

      // Clean attributes
      const attributes = Array.from(el.attributes);
      attributes.forEach(attr => {
        const attrName = attr.name.toLowerCase();
        
        if (!allowedAttributes.has(attrName)) {
          el.removeAttribute(attr.name);
        } else if (attrName === 'style') {
          // Sanitize inline styles
          el.setAttribute('style', this.sanitizeStyle(attr.value));
        } else if (attrName === 'href') {
          // Sanitize links
          if (!this.isSafeUrl(attr.value)) {
            el.removeAttribute('href');
          }
        }
      });
    });
  }

  /**
   * Sanitizes CSS style attribute
   * @param style - The CSS style string
   * @returns Sanitized CSS style string
   */
  private sanitizeStyle(style: string): string {
    if (!style) return '';

    const allowedProperties = new Set([
      'color', 'background-color', 'font-size', 'font-weight', 'font-style',
      'text-decoration', 'text-align', 'margin-left', 'text-indent', 'padding'
    ]);

    const cleanedRules: string[] = [];
    const rules = style.split(';');

    rules.forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim());
      if (property && value && allowedProperties.has(property.toLowerCase())) {
        if (this.isSafeCSSValue(value)) {
          cleanedRules.push(`${property}: ${value}`);
        }
      }
    });

    return cleanedRules.join('; ');
  }

  /**
   * Checks if a CSS value is safe
   * @param value - The CSS value to check
   * @returns True if the value is safe
   */
  private isSafeCSSValue(value: string): boolean {
    if (!value) return false;
    
    const dangerousPatterns = [
      /javascript:/i,
      /expression\(/i,
      /url\(/i,
      /@import/i,
      /behavior:/i,
      /binding:/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Checks if a URL is safe
   * @param url - The URL to check
   * @returns True if the URL is safe
   */
  private isSafeUrl(url: string): boolean {
    if (!url) return false;
    
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:', 'ftp:'];
    
    try {
      if (this.isBrowser && typeof URL !== 'undefined') {
        const urlObj = new URL(url, window.location.origin);
        return safeProtocols.includes(urlObj.protocol);
      } else {
        // Server-side URL validation
        return safeProtocols.some(protocol => url.toLowerCase().startsWith(protocol)) ||
               url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || 
               (!url.includes(':') && !url.startsWith('//'));
      }
    } catch {
      // If URL parsing fails, check if it's a relative URL
      return url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || 
             (!url.includes(':') && !url.startsWith('//'));
    }
  }

  /**
   * Strips all HTML tags as a fallback
   * @param html - The HTML string
   * @returns Plain text string
   */
  private stripHtmlTags(html: string): string {
    if (this.isBrowser && typeof document !== 'undefined') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent || tempDiv.innerText || '';
    } else {
      // Server-side HTML tag stripping using regex
      return html.replace(/<[^>]*>/g, '');
    }
  }

  /**
   * Checks if content appears to be safe HTML (no scripts, etc.)
   * @param html - The HTML content to check
   * @returns True if content appears safe
   */
  isSafeContent(html: string): boolean {
    if (!html || typeof html !== 'string') {
      return true; // Empty content is safe
    }

    const dangerousPatterns = [
      /<script[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi, // Event handlers like onclick=
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /<applet/gi,
      /<form/gi
    ];

    return !dangerousPatterns.some(pattern => pattern.test(html));
  }
}