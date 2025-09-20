// src/app/certifications/certifications.ts
import {
  Component,
  OnInit,
  inject,
  signal,
  PLATFORM_ID,
  Inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { CertificationService } from '../services/certification.service';
import { Certification } from '../model/certification.model';
import { ConfigService } from '../services/config.service';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';

// Declare Quill for TypeScript
declare var Quill: any;

@Component({
  selector: 'app-certifications',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SafeHtmlPipe],
  templateUrl: './certifications.html',
  styleUrls: ['./certifications.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationsComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('quillEditor', { static: false }) quillEditorRef!: ElementRef;

  private certificationService = inject(CertificationService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  certifications = signal<Certification[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);

  // Certification Details Modal State
  showCertificationDetails = signal(false);
  selectedCertification = signal<Certification | null>(null);

  // Selection Modal State
  showCertificationSelectionModal = signal(false);
  selectedOperation = signal<string>('');
  selectedCertificationId = signal<number | null>(null);

  private isBrowser: boolean;
  private quillEditor: any = null;
  private quillLoaded = false;
  private quillLoadPromise: Promise<void> | null = null;
  private resizeTimeout: any;
  private intersectionObserver?: IntersectionObserver;
  private animationFrameId?: number;

  certificationForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.certificationForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(1)]],
      description: ['', [Validators.required, Validators.minLength(1)]],
      monthYear: ['', [Validators.required, Validators.minLength(1)]],
      certificationLink: ['', [this.urlValidator]],
    });
  }

  ngOnInit() {
    console.log('CertificationsComponent: Initializing...');
    this.loadCertifications();
    if (this.isBrowser) {
      this.setupIntersectionObserver();
      this.optimizeForAnimations();
    }
    this.checkAdminStatus();
  }

  ngAfterViewInit() {
    console.log('CertificationsComponent: After view init');
    if (this.isBrowser && this.showForm() && this.quillLoaded) {
      setTimeout(() => this.initializeQuillEditor(), 100);
    }

    // Apply optimized styles after view init
    if (this.isBrowser) {
      setTimeout(() => {
        this.observeCertificationCards();
        this.applyOptimizedStyles();
      }, 500);
    }
  }

  ngOnDestroy() {
    console.log('CertificationsComponent: Destroying...');
    // Cleanup
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.destroyQuillEditor();

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  // Public methods for admin functionality
  enableAdminMode() {
    console.log('CertificationsComponent: Enabling admin mode');
    this.isAdmin.set(true);
    this.checkAdminStatus();
    this.cdr.markForCheck();
  }

  disableAdminMode() {
    console.log('CertificationsComponent: Disabling admin mode');
    this.isAdmin.set(false);
    this.closeForm();
    this.closeCertificationSelectionModal();
    this.cdr.markForCheck();
  }

  async handleCreateOperation() {
    console.log('CertificationsComponent: Handle create operation');
    try {
      await this.openForm();
    } catch (error) {
      console.error('Error opening create form:', error);
      alert('Failed to open create form. Please try again.');
    }
  }

  async handleUpdateOperation() {
    console.log('CertificationsComponent: Handle update operation');
    if (this.certifications().length === 0) {
      alert('No certifications available to update');
      return false;
    }
    this.selectedOperation.set('update');
    this.showCertificationSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleDeleteOperation() {
    console.log('CertificationsComponent: Handle delete operation');
    if (this.certifications().length === 0) {
      alert('No certifications available to delete');
      return false;
    }
    this.selectedOperation.set('delete');
    this.showCertificationSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleCertificationSelection(
    certificationId: number,
    operation: 'update' | 'delete'
  ) {
    console.log(
      'CertificationsComponent: Handle certification selection',
      certificationId,
      operation
    );

    const certification = this.certifications().find(
      (c) => c.id === certificationId
    );
    if (!certification) {
      alert('Certification not found');
      return;
    }

    try {
      if (operation === 'update') {
        await this.openForm(certification);
      } else if (operation === 'delete') {
        await this.deleteCertification(certificationId, certification.title);
      }
    } catch (error) {
      console.error(`Error handling ${operation} operation:`, error);
      alert(`Failed to ${operation} certification. Please try again.`);
    }
  }

  async refreshCertifications() {
    console.log('CertificationsComponent: Refreshing certifications...');
    await this.loadCertifications();
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any) {
    if (this.isBrowser) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.applyOptimizedStyles();
        this.cdr.markForCheck();
      }, 150);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.showCertificationDetails()) {
      if (event.key === 'Escape') {
        this.closeCertificationDetails();
        event.preventDefault();
      }
    }

    if (this.showCertificationSelectionModal()) {
      if (event.key === 'Escape') {
        this.closeCertificationSelectionModal();
        event.preventDefault();
      }
    }

    if (this.showForm()) {
      if (event.key === 'Escape') {
        this.closeForm();
        event.preventDefault();
      }
    }
  }

  private checkAdminStatus() {
    if (!this.isBrowser) {
      return;
    }

    try {
      const adminToken = localStorage.getItem('adminToken');
      const adminSession = localStorage.getItem('adminSession');

      let isAuthenticated = false;

      if (adminSession) {
        const session = JSON.parse(adminSession);
        const now = Date.now();
        const SESSION_TIMEOUT = 30 * 60 * 1000;

        if (
          now - session.timestamp <= SESSION_TIMEOUT &&
          session.token === this.configService.adminToken
        ) {
          isAuthenticated = true;
        }
      } else if (adminToken === this.configService.adminToken) {
        isAuthenticated = true;
      }

      console.log(
        'CertificationsComponent: Admin authentication status:',
        isAuthenticated
      );
      this.isAdmin.set(isAuthenticated);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.isAdmin.set(false);
    }
  }

  // Form Management
  async openForm(certification?: Certification) {
    console.log(
      'CertificationsComponent: Opening form',
      certification ? 'for editing' : 'for creation'
    );

    try {
      this.resetForm();

      if (this.isBrowser && !this.quillLoaded) {
        try {
          await this.loadQuillEditor();
        } catch (error) {
          console.error('Failed to load Quill, using fallback textarea');
          this.showQuillFallback();
        }
      }

      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
      }

      if (certification) {
        this.editingId.set(certification.id);

        this.certificationForm.patchValue({
          title: certification.title,
          description: certification.description,
          monthYear: certification.monthYear,
          certificationLink: certification.certificationLink || '',
        });
      } else {
        this.editingId.set(null);
      }

      this.showForm.set(true);
      this.cdr.markForCheck();

      if (this.quillLoaded) {
        setTimeout(() => {
          this.initializeQuillEditor();
          if (certification && certification.description) {
            setTimeout(() => {
              if (this.quillEditor) {
                this.quillEditor.root.innerHTML = certification.description;
                this.forceWhiteBackgroundBlackText();
              }
            }, 100);
          }
        }, 250);
      }
    } catch (error) {
      console.error('Error opening form:', error);
      if (this.isBrowser) {
        document.body.style.overflow = 'auto';
      }
      throw error;
    }
  }

  closeForm() {
    console.log('CertificationsComponent: Closing form');
    this.destroyQuillEditor();
    this.showForm.set(false);
    this.resetForm();

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  resetForm() {
    this.certificationForm.reset();
    this.certificationForm.patchValue({
      title: '',
      description: '',
      monthYear: '',
      certificationLink: '',
    });
    this.editingId.set(null);
  }

  // Load certifications
  async loadCertifications() {
    console.log('CertificationsComponent: Loading certifications...');
    this.isLoading.set(true);
    try {
      const certifications =
        await this.certificationService.getAllCertifications();
      certifications.sort((a, b) => b.id - a.id);
      this.certifications.set(certifications);

      if (this.isBrowser) {
        setTimeout(() => {
          this.observeCertificationCards();
          this.applyOptimizedStyles();
        }, 300);
      }
      console.log(
        'CertificationsComponent: Certifications loaded successfully',
        certifications.length,
        'certifications'
      );
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading certifications:', error);
      this.certifications.set([]);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  get isFormValid(): boolean {
    if (!this.certificationForm) {
      return false;
    }

    const titleValid = this.certificationForm.get('title')?.valid;
    const descriptionValid = this.certificationForm.get('description')?.valid;
    const monthYearValid = this.certificationForm.get('monthYear')?.valid;
    const linkValid = this.certificationForm.get('certificationLink')?.valid;

    if (this.quillEditor) {
      const text = this.quillEditor.getText().trim();
      if (text.length === 0) {
        return false;
      }
    }

    return !!(titleValid && descriptionValid && monthYearValid && linkValid);
  }

  async onSubmit() {
    console.log('CertificationsComponent: Submitting form...');

    if (this.isBrowser && this.quillEditor) {
      const html = this.quillEditor.root.innerHTML;
      const text = this.quillEditor.getText().trim();
      if (text.length > 0 && html !== '<p><br></p>') {
        this.certificationForm.get('description')?.setValue(html);
      }
    }

    if (!this.isFormValid) {
      this.markAllFieldsAsTouched();
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.certificationForm.value;

      // FIXED: Handle certification link properly - convert null/undefined to empty string
      const certificationData = {
        title: formValue.title.trim(),
        description: formValue.description,
        monthYear: formValue.monthYear.trim(),
        // FIXED: Ensure certificationLink is always a string (empty if not provided)
        certificationLink: formValue.certificationLink?.trim() || '',
      };

      console.log('Submitting certification data:', certificationData);

      if (this.editingId()) {
        await this.certificationService.updateCertification(
          this.editingId()!,
          certificationData
        );
        console.log('Certification updated successfully');
      } else {
        await this.certificationService.createCertification(certificationData);
        console.log('Certification created successfully');
      }

      await this.loadCertifications();
      this.closeForm();

      const message = this.editingId()
        ? 'Certification updated successfully!'
        : 'Certification created successfully!';
      alert(message);
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage =
        error.message ||
        'An error occurred while saving the certification. Please try again.';
      alert(errorMessage);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  async deleteCertification(id: number, title: string) {
    const confirmMessage = `Are you sure you want to delete the certification "${title}"?\n\nThis action cannot be undone.`;
    if (confirm(confirmMessage)) {
      this.isLoading.set(true);
      try {
        await this.certificationService.deleteCertification(id);
        await this.loadCertifications();
        alert('Certification deleted successfully!');
      } catch (error: any) {
        console.error('Delete error:', error);
        const errorMessage =
          error.message || 'Failed to delete certification. Please try again.';
        alert(errorMessage);
      } finally {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    }
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.certificationForm.controls).forEach((key) => {
      const control = this.certificationForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    this.cdr.markForCheck();
  }

  // URL Validator
  private urlValidator(control: any) {
    const value = control.value;
    if (!value || value.trim() === '') {
      return null;
    }

    try {
      const url = new URL(value.trim());
      if (!url.protocol.startsWith('http')) {
        return { invalidUrl: true };
      }
      return null;
    } catch {
      return { invalidUrl: true };
    }
  }

  // Selection Modal Management
  closeCertificationSelectionModal() {
    this.showCertificationSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedCertificationId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  selectCertification(certificationId: number) {
    this.selectedCertificationId.set(certificationId);
    const operation = this.selectedOperation();

    this.closeCertificationSelectionModal();

    const certification = this.certifications().find(
      (c) => c.id === certificationId
    );
    if (!certification) {
      alert('Certification not found');
      return;
    }

    if (operation === 'update') {
      this.openForm(certification);
    } else if (operation === 'delete') {
      this.deleteCertification(certificationId, certification.title);
    }
  }

  // Certification Details Modal
  openCertificationDetails(certification: Certification): void {
    this.selectedCertification.set(certification);
    this.showCertificationDetails.set(true);

    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        const closeButton = document.querySelector(
          '.modal-close-btn'
        ) as HTMLElement;
        if (closeButton) {
          closeButton.focus();
        }
      }, 100);
    }
    this.cdr.markForCheck();
  }

  closeCertificationDetails(): void {
    this.showCertificationDetails.set(false);
    this.selectedCertification.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  getDescriptionPreview(description: string | null | undefined): string {
    if (!description) return '';

    let plainText = '';

    if (this.isBrowser && typeof document !== 'undefined') {
      try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = description;
        plainText = tempDiv.textContent || tempDiv.innerText || '';
      } catch (error) {
        plainText = this.stripHtmlWithRegex(description);
      }
    } else {
      plainText = this.stripHtmlWithRegex(description);
    }

    const maxChars = 320;

    if (plainText.length <= maxChars) {
      return plainText;
    }

    const truncated = plainText.substring(0, maxChars);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastSentenceEnd > maxChars * 0.7) {
      return plainText.substring(0, lastSentenceEnd + 1);
    } else {
      const lastSpace = truncated.lastIndexOf(' ');
      return lastSpace > 0
        ? plainText.substring(0, lastSpace) + '...'
        : truncated + '...';
    }
  }

  private stripHtmlWithRegex(html: string): string {
    if (!html || typeof html !== 'string') return '';

    let text = html.replace(/<[^>]*>/g, '');

    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&hellip;/g, '...');

    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  trackByCertificationId(index: number, certification: Certification): number {
    return certification.id;
  }

  // Quill Editor Methods (same as projects)
  private async loadQuillEditor(): Promise<void> {
    if (!this.isBrowser || this.quillLoaded) {
      return;
    }

    if (this.quillLoadPromise) {
      return this.quillLoadPromise;
    }

    this.quillLoadPromise = new Promise<void>((resolve, reject) => {
      if (typeof (window as any).Quill !== 'undefined') {
        this.quillLoaded = true;
        resolve();
        return;
      }

      const existingQuillScript = document.querySelector(
        'script[src*="quill.min.js"]'
      );
      if (existingQuillScript) {
        existingQuillScript.addEventListener('load', () => {
          this.quillLoaded = true;
          resolve();
        });
        return;
      }

      const existingQuillCSS = document.querySelector(
        'link[href*="quill.snow.min.css"]'
      );
      if (!existingQuillCSS) {
        const quillCSS = document.createElement('link');
        quillCSS.rel = 'stylesheet';
        quillCSS.href =
          'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css';
        quillCSS.media = 'print';
        quillCSS.onload = () => {
          quillCSS.media = 'all';
        };
        document.head.appendChild(quillCSS);
      }

      const quillJS = document.createElement('script');
      quillJS.src =
        'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js';
      quillJS.async = true;
      quillJS.defer = true;

      quillJS.onload = () => {
        this.quillLoaded = true;
        resolve();
      };

      quillJS.onerror = (error) => {
        console.error('Failed to load Quill editor:', error);
        this.quillLoadPromise = null;
        reject(error);
      };

      document.head.appendChild(quillJS);
    });

    return this.quillLoadPromise;
  }

  private initializeQuillEditor() {
    if (
      !this.quillLoaded ||
      !this.quillEditorRef?.nativeElement ||
      this.quillEditor
    ) {
      return;
    }

    try {
      if (typeof Quill === 'undefined') {
        console.warn('Quill is not loaded, falling back to textarea');
        this.showQuillFallback();
        return;
      }

      const toolbarOptions = [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ['link'],
        ['clean'],
      ];

      this.quillEditor = new Quill(this.quillEditorRef.nativeElement, {
        theme: 'snow',
        modules: {
          toolbar: toolbarOptions,
        },
        placeholder:
          'Describe your certification, its significance, and what you learned...',
        formats: [
          'header',
          'bold',
          'italic',
          'underline',
          'strike',
          'list',
          'bullet',
          'indent',
          'color',
          'background',
          'align',
          'link',
        ],
      });

      const forceStyles = () => {
        this.forceWhiteBackgroundBlackText();
        setTimeout(() => this.forceWhiteBackgroundBlackText(), 50);
      };

      setTimeout(forceStyles, 50);

      const currentDescription =
        this.certificationForm.get('description')?.value;
      if (currentDescription) {
        this.quillEditor.root.innerHTML = currentDescription;
        setTimeout(forceStyles, 100);
      }

      this.quillEditor.on('text-change', () => {
        const html = this.quillEditor.root.innerHTML;
        const text = this.quillEditor.getText().trim();

        this.certificationForm.get('description')?.setValue(html);

        if (text.length === 0 || html === '<p><br></p>') {
          this.certificationForm
            .get('description')
            ?.setErrors({ required: true });
        } else {
          this.certificationForm.get('description')?.setErrors(null);
        }

        setTimeout(forceStyles, 10);
        this.cdr.markForCheck();
      });

      this.quillEditor.on('selection-change', (range: any) => {
        if (range) {
          const container = this.quillEditorRef.nativeElement.closest(
            '.quill-editor-container'
          );
          if (container) {
            container.style.borderColor = '#6c757d';
            container.style.boxShadow = '0 0 0 2px rgba(108, 117, 125, 0.25)';
          }
        } else {
          const container = this.quillEditorRef.nativeElement.closest(
            '.quill-editor-container'
          );
          if (container) {
            container.style.borderColor = '#ddd';
            container.style.boxShadow = 'none';
          }
        }
        setTimeout(forceStyles, 10);
      });
    } catch (error) {
      console.error('Error initializing Quill editor:', error);
      this.showQuillFallback();
    }
  }

  private forceWhiteBackgroundBlackText() {
    if (!this.isBrowser || !this.quillEditor || !this.quillEditor.root) {
      return;
    }

    const editorElement = this.quillEditor.root;

    const forceStyle = (
      element: HTMLElement,
      styles: Record<string, string>
    ) => {
      Object.entries(styles).forEach(([property, value]) => {
        element.style.setProperty(property, value, 'important');
      });
    };

    forceStyle(editorElement, {
      background: 'white',
      color: '#333333',
      padding: '15px',
      'min-height': '120px',
      'font-family': 'inherit',
    });

    const container = editorElement.parentElement;
    if (container && container.classList.contains('ql-container')) {
      forceStyle(container, {
        background: 'white',
        border: 'none',
      });
    }

    const allElements = editorElement.querySelectorAll('*');
    allElements.forEach((element: Element) => {
      const htmlElement = element as HTMLElement;
      forceStyle(htmlElement, {
        color: '#333333',
        background: 'transparent',
      });
    });
  }

  private showQuillFallback() {
    if (!this.isBrowser) {
      return;
    }

    if (this.quillEditorRef?.nativeElement) {
      this.quillEditorRef.nativeElement.style.display = 'none';
      const fallback = document.getElementById('description-fallback');
      if (fallback) {
        fallback.style.display = 'block';
      }
    }
  }

  private destroyQuillEditor() {
    if (!this.isBrowser || !this.quillEditor) {
      return;
    }

    try {
      const content = this.quillEditor.root.innerHTML;
      this.certificationForm.get('description')?.setValue(content);
      this.quillEditor = null;
    } catch (error) {
      console.error('Error destroying Quill editor:', error);
    }
  }

  // Animation Optimization Methods (similar to projects/education)
  private optimizeForAnimations() {
    if (!this.isBrowser) return;

    const style = document.createElement('style');
    style.textContent = `
      .certification-card {
        -webkit-transform: translateZ(0) !important;
        transform: translateZ(0) !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        backface-visibility: hidden !important;
        perspective: 1000px !important;
      }
    `;
    document.head.appendChild(style);
  }

  private applyOptimizedStyles() {
    if (!this.isBrowser) return;

    const cards = document.querySelectorAll(
      '.certification-card'
    ) as NodeListOf<HTMLElement>;
    cards.forEach((card) => {
      card.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
      card.style.setProperty('transform', 'translateZ(0)', 'important');
      card.style.setProperty(
        '-webkit-font-smoothing',
        'antialiased',
        'important'
      );
      card.style.setProperty(
        '-moz-osx-font-smoothing',
        'grayscale',
        'important'
      );
      card.style.setProperty(
        'text-rendering',
        'optimizeLegibility',
        'important'
      );
      card.style.setProperty('backface-visibility', 'hidden', 'important');
    });
  }

  private setupIntersectionObserver() {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const card = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            card.style.willChange = 'transform';
            this.optimizeCardForAnimation(card);
          } else {
            card.style.willChange = 'auto';
          }
        });
      },
      {
        root: null,
        rootMargin: '50px',
        threshold: 0.1,
      }
    );
  }

  private optimizeCardForAnimation(card: HTMLElement) {
    card.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
    card.style.setProperty('transform', 'translateZ(0)', 'important');
    card.style.setProperty(
      '-webkit-font-smoothing',
      'antialiased',
      'important'
    );
    card.style.setProperty('-moz-osx-font-smoothing', 'grayscale', 'important');
    card.style.setProperty('text-rendering', 'optimizeLegibility', 'important');
    card.style.setProperty('backface-visibility', 'hidden', 'important');
    card.style.setProperty('perspective', '1000px', 'important');
  }

  private observeCertificationCards() {
    if (!this.intersectionObserver || !this.isBrowser) return;

    const cards = document.querySelectorAll('.certification-card');
    cards.forEach((card) => {
      this.intersectionObserver!.observe(card);
      this.optimizeCardForAnimation(card as HTMLElement);
    });
  }
}