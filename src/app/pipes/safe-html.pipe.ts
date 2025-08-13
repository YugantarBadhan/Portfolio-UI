// src/app/pipes/safe-html.pipe.ts
import { Pipe, PipeTransform, inject, Inject, PLATFORM_ID } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';

@Pipe({
  name: 'safeHtml',
  standalone: true
})
export class SafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  transform(html: string): SafeHtml {
    if (!html) return '';
    
    try {
      // During SSR, skip complex sanitization and use a simple approach
      if (!this.isBrowser) {
        const simpleClean = this.simpleHtmlClean(html);
        return this.sanitizer.bypassSecurityTrustHtml(simpleClean);
      }

      // In browser, use full sanitization
      const cleanHtml = this.sanitizeQuillContent(html);
      return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
    } catch (error) {
      console.error('Error in SafeHtml pipe:', error);
      // Fallback: return the original HTML and let Angular's sanitizer handle it
      return html;
    }
  }

  /**
   * Simple HTML cleaning for SSR environment (without DOM manipulation)
   */
  private simpleHtmlClean(html: string): string {
    if (!html || typeof html !== 'string') return '';

    // Simple regex-based cleaning for SSR
    let cleaned = html;
    
    // Remove script tags
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
    
    // Remove dangerous attributes using regex
    cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, ''); // onclick, onload, etc.
    cleaned = cleaned.replace(/javascript:/gi, ''); // javascript: protocol
    cleaned = cleaned.replace(/vbscript:/gi, ''); // vbscript: protocol
    
    // Remove dangerous tags
    const dangerousTags = ['iframe', 'object', 'embed', 'applet', 'form', 'input', 'button'];
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gis');
      cleaned = cleaned.replace(regex, '');
      const selfClosingRegex = new RegExp(`<${tag}[^>]*\/?>`, 'gi');
      cleaned = cleaned.replace(selfClosingRegex, '');
    });

    return cleaned;
  }

  /**
   * Full DOM-based sanitization for browser environment
   */
  private sanitizeQuillContent(html: string): string {
    if (!html || typeof html !== 'string' || !this.isBrowser) return '';

    try {
      // Create a temporary div to parse and clean HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Define allowed tags that Quill editor produces
      const allowedTags = new Set([
        'p', 'br', 'div', 'span',
        'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ol', 'ul', 'li',
        'blockquote', 'pre', 'code',
        'a'
      ]);

      // Define allowed attributes
      const allowedAttributes = new Set([
        'class', 'style', 'href', 'target', 'rel',
        'data-list', 'data-indent', 'data-align',
        'color', 'background-color'
      ]);

      // Clean the DOM tree
      this.cleanNode(tempDiv, allowedTags, allowedAttributes);

      return tempDiv.innerHTML;
    } catch (error) {
      console.error('Error sanitizing HTML:', error);
      return this.simpleHtmlClean(html); // Fallback to regex-based cleaning
    }
  }

  private cleanNode(node: Node, allowedTags: Set<string>, allowedAttributes: Set<string>): void {
    if (!this.isBrowser || !node) return;

    const children = Array.from(node.childNodes);
    
    children.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element;
        const tagName = element.tagName.toLowerCase();

        if (allowedTags.has(tagName)) {
          // Clean attributes for allowed tags
          const attributes = Array.from(element.attributes);
          attributes.forEach(attr => {
            const attrName = attr.name.toLowerCase();
            
            if (!allowedAttributes.has(attrName)) {
              element.removeAttribute(attr.name);
            } else if (attrName === 'style') {
              // Clean inline styles - allow only safe CSS properties
              element.setAttribute('style', this.sanitizeStyle(attr.value));
            } else if (attrName === 'href') {
              // Clean href attributes - only allow safe protocols
              const href = attr.value;
              if (!this.isSafeUrl(href)) {
                element.removeAttribute('href');
              }
            }
          });

          // Recursively clean child nodes
          this.cleanNode(element, allowedTags, allowedAttributes);
        } else {
          // Remove disallowed tags but keep their content
          const parent = element.parentNode;
          if (parent) {
            // Move all child nodes to parent before removing the element
            while (element.firstChild) {
              parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
          }
        }
      }
      // Keep text nodes and other safe node types as they are
    });
  }

  private sanitizeStyle(style: string): string {
    if (!style) return '';

    // Allow only safe CSS properties that Quill uses
    const allowedProperties = new Set([
      'color', 'background-color', 'font-size', 'font-weight', 'font-style',
      'text-decoration', 'text-align', 'margin-left', 'text-indent'
    ]);

    const cleanedRules: string[] = [];
    const rules = style.split(';');

    rules.forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim());
      if (property && value && allowedProperties.has(property.toLowerCase())) {
        // Basic validation for CSS values
        if (this.isSafeCSSValue(value)) {
          cleanedRules.push(`${property}: ${value}`);
        }
      }
    });

    return cleanedRules.join('; ');
  }

  private isSafeCSSValue(value: string): boolean {
    if (!value) return false;
    
    // Block potentially dangerous CSS values
    const dangerousPatterns = [
      /javascript:/i,
      /expression\(/i,
      /url\(/i,
      /@import/i,
      /behavior:/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(value));
  }

  private isSafeUrl(url: string): boolean {
    if (!url) return false;
    
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    
    try {
      // Only use URL constructor in browser environment
      if (this.isBrowser && typeof URL !== 'undefined') {
        const urlObj = new URL(url, window.location.origin);
        return safeProtocols.includes(urlObj.protocol);
      } else {
        // Fallback for SSR - simple protocol check
        return safeProtocols.some(protocol => url.toLowerCase().startsWith(protocol)) ||
               url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || 
               !url.includes(':'); // Simple relative URL check
      }
    } catch {
      // If URL parsing fails, check if it's a relative URL
      return url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || 
             !url.includes(':'); // Simple relative URL check
    }
  }
}