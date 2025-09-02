// Author: Yugantar Badhan

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
import { EducationService } from '../services/education.service';
import { Education } from '../model/education.model';
import { ConfigService } from '../services/config.service';

@Component({
  selector: 'app-educations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './educations.html',
  styleUrls: ['./educations.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EducationsComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('educationsGrid', { static: false })
  educationsGridRef!: ElementRef;

  private educationService = inject(EducationService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  educations = signal<Education[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);

  // Education Details Modal State
  showEducationDetails = signal(false);
  selectedEducation = signal<Education | null>(null);

  // Selection Modal State
  showEducationSelectionModal = signal(false);
  selectedOperation = signal<string>('');
  selectedEducationId = signal<number | null>(null);

  // Carousel state - same as certifications
  currentTranslateX = signal(0);
  currentIndicatorIndex = signal(0);
  cardsPerView = signal(3);
  maxTranslateX = signal(0);
  cardWidth = signal(450);

  private isBrowser: boolean;
  private resizeTimeout: any;
  private intersectionObserver?: IntersectionObserver;
  private animationFrameId?: number;

  educationForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.educationForm = this.fb.group({
      degree: ['', [Validators.required, Validators.minLength(1)]],
      field: ['', [Validators.required, Validators.minLength(1)]],
      university: ['', [Validators.required, Validators.minLength(1)]],
      institute: ['', [Validators.required, Validators.minLength(1)]],
      location: [''],
      startDate: ['', [Validators.required, Validators.minLength(1)]],
      endDate: [''],
      currentStudying: [false],
      grade: ['', [Validators.required, Validators.minLength(1)]],
      educationType: ['', [Validators.required]],
      description: [''],
    });

    // Watch currentStudying changes
    this.educationForm.get('currentStudying')?.valueChanges.subscribe((isCurrentlyStudying) => {
      const endDateControl = this.educationForm.get('endDate');
      if (isCurrentlyStudying) {
        endDateControl?.setValue('');
        endDateControl?.clearValidators();
      } else {
        endDateControl?.setValidators([Validators.required]);
      }
      endDateControl?.updateValueAndValidity();
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    console.log('EducationsComponent: Initializing...');
    this.loadEducations();
    if (this.isBrowser) {
      this.calculateCardsPerView();
      this.setupIntersectionObserver();
      this.optimizeForAnimations();
    }
    this.checkAdminStatus();
  }

  ngAfterViewInit() {
    console.log('EducationsComponent: After view init');

    // Initialize carousel calculations
    if (this.isBrowser) {
      setTimeout(() => {
        this.calculateCardsPerView();
        this.updateCarouselConstraints();
        this.applyOptimizedStyles();
      }, 500);
    }
  }

  ngOnDestroy() {
    console.log('EducationsComponent: Destroying...');
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

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  // Public methods for admin functionality
  enableAdminMode() {
    console.log('EducationsComponent: Enabling admin mode');
    this.isAdmin.set(true);
    this.checkAdminStatus();
    this.cdr.markForCheck();
  }

  disableAdminMode() {
    console.log('EducationsComponent: Disabling admin mode');
    this.isAdmin.set(false);
    this.closeForm();
    this.closeEducationSelectionModal();
    this.cdr.markForCheck();
  }

  async handleCreateOperation() {
    console.log('EducationsComponent: Handle create operation');
    try {
      await this.openForm();
    } catch (error) {
      console.error('Error opening create form:', error);
      alert('Failed to open create form. Please try again.');
    }
  }

  async handleUpdateOperation() {
    console.log('EducationsComponent: Handle update operation');
    if (this.educations().length === 0) {
      alert('No educations available to update');
      return false;
    }
    this.selectedOperation.set('update');
    this.showEducationSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleDeleteOperation() {
    console.log('EducationsComponent: Handle delete operation');
    if (this.educations().length === 0) {
      alert('No educations available to delete');
      return false;
    }
    this.selectedOperation.set('delete');
    this.showEducationSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleEducationSelection(
    educationId: number,
    operation: 'update' | 'delete'
  ) {
    console.log(
      'EducationsComponent: Handle education selection',
      educationId,
      operation
    );

    const education = this.educations().find(
      (e) => e.id === educationId
    );
    if (!education) {
      alert('Education not found');
      return;
    }

    try {
      if (operation === 'update') {
        await this.openForm(education);
      } else if (operation === 'delete') {
        await this.deleteEducation(educationId, education.degree);
      }
    } catch (error) {
      console.error(`Error handling ${operation} operation:`, error);
      alert(`Failed to ${operation} education. Please try again.`);
    }
  }

  async refreshEducations() {
    console.log('EducationsComponent: Refreshing educations...');
    await this.loadEducations();
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any) {
    if (this.isBrowser) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.calculateCardsPerView();
        this.updateCarouselConstraints();
        this.adjustCarouselPosition();
        this.applyOptimizedStyles();
        this.cdr.markForCheck();
      }, 150);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.showEducationDetails()) {
      if (event.key === 'Escape') {
        this.closeEducationDetails();
        event.preventDefault();
      }
    }

    if (this.showEducationSelectionModal()) {
      if (event.key === 'Escape') {
        this.closeEducationSelectionModal();
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
        'EducationsComponent: Admin authentication status:',
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
  async openForm(education?: Education) {
    console.log(
      'EducationsComponent: Opening form',
      education ? 'for editing' : 'for creation'
    );

    try {
      this.resetForm();

      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
      }

      if (education) {
        this.editingId.set(education.id);

        this.educationForm.patchValue({
          degree: education.degree,
          field: education.field,
          university: education.university,
          institute: education.institute,
          location: education.location || '',
          startDate: education.startDate,
          endDate: education.endDate || '',
          currentStudying: education.currentStudying,
          grade: education.grade,
          educationType: education.educationType,
          description: education.description || '',
        });
      } else {
        this.editingId.set(null);
      }

      this.showForm.set(true);
      this.cdr.markForCheck();

    } catch (error) {
      console.error('Error opening form:', error);
      if (this.isBrowser) {
        document.body.style.overflow = 'auto';
      }
      throw error;
    }
  }

  closeForm() {
    console.log('EducationsComponent: Closing form');
    this.showForm.set(false);
    this.resetForm();

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  resetForm() {
    this.educationForm.reset();
    this.educationForm.patchValue({
      degree: '',
      field: '',
      university: '',
      institute: '',
      location: '',
      startDate: '',
      endDate: '',
      currentStudying: false,
      grade: '',
      educationType: '',
      description: '',
    });
    this.editingId.set(null);
  }

  // Load educations
  async loadEducations() {
    console.log('EducationsComponent: Loading educations...');
    this.isLoading.set(true);
    try {
      const educations = await this.educationService.getAllEducations();
      educations.sort((a, b) => b.id - a.id);
      this.educations.set(educations);

      this.currentTranslateX.set(0);
      this.currentIndicatorIndex.set(0);

      if (this.isBrowser) {
        setTimeout(() => {
          this.calculateCardsPerView();
          this.updateCarouselConstraints();
          this.observeEducationCards();
          this.applyOptimizedStyles();
        }, 300);
      }
      console.log(
        'EducationsComponent: Educations loaded successfully',
        educations.length,
        'educations'
      );
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading educations:', error);
      this.educations.set([]);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  get isFormValid(): boolean {
    if (!this.educationForm) {
      return false;
    }

    const isCurrentlyStudying = this.educationForm.get('currentStudying')?.value;
    const endDate = this.educationForm.get('endDate')?.value;

    // Check base validation
    const baseValid = this.educationForm.valid;

    // Additional validation for end date logic
    if (!isCurrentlyStudying && !endDate?.trim()) {
      return false;
    }

    if (isCurrentlyStudying && endDate?.trim()) {
      return false;
    }

    return baseValid;
  }

  async onSubmit() {
    console.log('EducationsComponent: Submitting form...');

    if (!this.isFormValid) {
      this.markAllFieldsAsTouched();
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.educationForm.value;

      const educationData = {
        degree: formValue.degree.trim(),
        field: formValue.field.trim(),
        university: formValue.university.trim(),
        institute: formValue.institute.trim(),
        location: formValue.location?.trim() || null,
        startDate: formValue.startDate.trim(),
        endDate: formValue.currentStudying ? null : (formValue.endDate?.trim() || null),
        currentStudying: Boolean(formValue.currentStudying),
        grade: formValue.grade.trim(),
        educationType: formValue.educationType.trim(),
        description: formValue.description?.trim() || null,
      };

      console.log('Submitting education data:', educationData);

      if (this.editingId()) {
        await this.educationService.updateEducation(
          this.editingId()!,
          educationData
        );
        console.log('Education updated successfully');
      } else {
        await this.educationService.createEducation(educationData);
        console.log('Education created successfully');
      }

      await this.loadEducations();
      this.closeForm();

      const message = this.editingId()
        ? 'Education updated successfully!'
        : 'Education created successfully!';
      alert(message);
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage =
        error.message ||
        'An error occurred while saving the education. Please try again.';
      alert(errorMessage);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  async deleteEducation(id: number, degree: string) {
    const confirmMessage = `Are you sure you want to delete the education "${degree}"?\n\nThis action cannot be undone.`;
    if (confirm(confirmMessage)) {
      this.isLoading.set(true);
      try {
        await this.educationService.deleteEducation(id);
        await this.loadEducations();
        alert('Education deleted successfully!');
      } catch (error: any) {
        console.error('Delete error:', error);
        const errorMessage =
          error.message || 'Failed to delete education. Please try again.';
        alert(errorMessage);
      } finally {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    }
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.educationForm.controls).forEach((key) => {
      const control = this.educationForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    this.cdr.markForCheck();
  }

  // Selection Modal Management
  closeEducationSelectionModal() {
    this.showEducationSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedEducationId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  selectEducation(educationId: number) {
    this.selectedEducationId.set(educationId);
    const operation = this.selectedOperation();

    this.closeEducationSelectionModal();

    const education = this.educations().find(
      (e) => e.id === educationId
    );
    if (!education) {
      alert('Education not found');
      return;
    }

    if (operation === 'update') {
      this.openForm(education);
    } else if (operation === 'delete') {
      this.deleteEducation(educationId, education.degree);
    }
  }

  // Education Details Modal
  openEducationDetails(education: Education): void {
    this.selectedEducation.set(education);
    this.showEducationDetails.set(true);

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

  closeEducationDetails(): void {
    this.showEducationDetails.set(false);
    this.selectedEducation.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  trackByEducationId(index: number, education: Education): number {
    return education.id;
  }

  // Animation Optimization Methods (same as certifications)
  private optimizeForAnimations() {
    if (!this.isBrowser) return;

    const style = document.createElement('style');
    style.textContent = `
      .education-card {
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
      '.education-card'
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

  private observeEducationCards() {
    if (!this.intersectionObserver || !this.isBrowser) return;

    const cards = document.querySelectorAll('.education-card');
    cards.forEach((card) => {
      this.intersectionObserver!.observe(card);
      this.optimizeCardForAnimation(card as HTMLElement);
    });
  }

  // Carousel Methods (same as certifications)
  private calculateCardsPerView() {
    if (!this.isBrowser) return;

    const windowWidth = window.innerWidth;

    if (windowWidth <= 480) {
      this.cardsPerView.set(1);
      this.cardWidth.set(320);
    } else if (windowWidth <= 768) {
      this.cardsPerView.set(1);
      this.cardWidth.set(350);
    } else if (windowWidth <= 1200) {
      this.cardsPerView.set(2);
      this.cardWidth.set(380);
    } else if (windowWidth <= 1400) {
      this.cardsPerView.set(3);
      this.cardWidth.set(400);
    } else {
      this.cardsPerView.set(3);
      this.cardWidth.set(450);
    }

    this.updateCarouselConstraints();
    this.updateCardStyles();
  }

  private updateCardStyles() {
    if (!this.isBrowser) return;

    const cards = document.querySelectorAll(
      '.education-card'
    ) as NodeListOf<HTMLElement>;
    const cardSize = this.cardWidth();

    cards.forEach((card) => {
      card.style.setProperty('width', `${cardSize}px`, 'important');
      card.style.setProperty('height', `${cardSize}px`, 'important');
      card.style.setProperty('min-width', `${cardSize}px`, 'important');
      card.style.setProperty('min-height', `${cardSize}px`, 'important');
      card.style.setProperty('max-width', `${cardSize}px`, 'important');
      card.style.setProperty('max-height', `${cardSize}px`, 'important');

      this.optimizeCardForAnimation(card);
    });
  }

  private updateCarouselConstraints() {
    const totalEducations = this.educations().length;
    const cardsPerView = this.cardsPerView();

    if (totalEducations <= cardsPerView) {
      this.maxTranslateX.set(0);
      this.currentTranslateX.set(0);
      this.currentIndicatorIndex.set(0);
      return;
    }

    const cardWidth = this.cardWidth();
    const gap = 32;
    const scrollDistance = cardWidth + gap;
    const maxScroll = (totalEducations - cardsPerView) * scrollDistance;
    this.maxTranslateX.set(-maxScroll);
  }

  private adjustCarouselPosition() {
    const currentTranslate = this.currentTranslateX();
    const maxTranslate = this.maxTranslateX();

    if (currentTranslate < maxTranslate) {
      const cardWidth = this.cardWidth();
      const gap = 32;
      const scrollDistance = cardWidth + gap;
      const validPosition =
        Math.ceil(Math.abs(currentTranslate) / scrollDistance) * scrollDistance;
      const newPosition = Math.max(maxTranslate, -validPosition);

      this.currentTranslateX.set(newPosition);
      this.updateIndicatorIndex();
    }
  }

  canScrollLeft(): boolean {
    return this.currentTranslateX() < 0;
  }

  canScrollRight(): boolean {
    return this.currentTranslateX() > this.maxTranslateX();
  }

  scrollCarousel(direction: 'left' | 'right') {
    if (!this.isBrowser) return;

    const currentTranslate = this.currentTranslateX();
    const cardWidth = this.cardWidth();
    const gap = 32;
    const scrollAmount = cardWidth + gap;

    let newTranslate = currentTranslate;

    if (direction === 'left' && this.canScrollLeft()) {
      newTranslate = Math.min(0, currentTranslate + scrollAmount);
    } else if (direction === 'right' && this.canScrollRight()) {
      newTranslate = Math.max(
        this.maxTranslateX(),
        currentTranslate - scrollAmount
      );
    }

    this.animateCarousel(newTranslate);
  }

  shouldShowIndicators(): boolean {
    const totalEducations = this.educations().length;
    const cardsPerView = this.cardsPerView();
    return totalEducations > cardsPerView;
  }

  getCarouselIndicators(): number[] {
    const totalEducations = this.educations().length;
    const cardsPerView = this.cardsPerView();

    if (totalEducations <= cardsPerView) return [];

    const totalIndicators = totalEducations - cardsPerView + 1;
    return Array(totalIndicators)
      .fill(0)
      .map((_, index) => index);
  }

  scrollToIndicator(indicatorIndex: number) {
    if (!this.isBrowser) return;

    const cardWidth = this.cardWidth();
    const gap = 32;
    const scrollDistance = cardWidth + gap;
    const newTranslate = -indicatorIndex * scrollDistance;
    const clampedTranslate = Math.max(
      this.maxTranslateX(),
      Math.min(0, newTranslate)
    );

    this.animateCarousel(clampedTranslate);
  }

  private animateCarousel(targetTranslate: number) {
    const startTranslate = this.currentTranslateX();
    const duration = 600;
    const startTime = performance.now();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeOutCubic = 1 - Math.pow(1 - progress, 3);

      const currentTranslate =
        startTranslate + (targetTranslate - startTranslate) * easeOutCubic;
      this.currentTranslateX.set(currentTranslate);

      const grid = document.querySelector(
        '.educations-grid'
      ) as HTMLElement;
      if (grid) {
        grid.style.transform = `translate3d(${currentTranslate}px, 0, 0)`;
        grid.style.webkitTransform = `translate3d(${currentTranslate}px, 0, 0)`;
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.currentTranslateX.set(targetTranslate);
        this.updateIndicatorIndex();
        this.animationFrameId = undefined;

        setTimeout(() => {
          this.applyOptimizedStyles();
        }, 50);
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private updateIndicatorIndex() {
    const cardWidth = this.cardWidth();
    const gap = 32;
    const scrollDistance = cardWidth + gap;
    const currentTranslate = Math.abs(this.currentTranslateX());
    const index = Math.round(currentTranslate / scrollDistance);
    this.currentIndicatorIndex.set(index);
  }
}