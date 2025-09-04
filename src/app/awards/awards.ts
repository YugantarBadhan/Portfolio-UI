// src/app/awards/awards.ts - Complete Fixed Version
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
import { AwardService } from '../services/award.service';
import { Award } from '../model/award.model';
import { ConfigService } from '../services/config.service';

@Component({
  selector: 'app-awards',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './awards.html',
  styleUrls: ['./awards.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AwardsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('awardsGrid', { static: false })
  awardsGridRef!: ElementRef;

  private awardService = inject(AwardService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  // Main component state signals
  awards = signal<Award[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);

  // Award Details Modal State signals - FIXED
  showAwardDetails = signal(false);
  selectedAward = signal<Award | null>(null);

  // Selection Modal State signals
  showAwardSelectionModal = signal(false);
  selectedOperation = signal<string>('');
  selectedAwardId = signal<number | null>(null);

  // Carousel state signals - same as projects
  currentTranslateX = signal(0);
  currentIndicatorIndex = signal(0);
  cardsPerView = signal(3);
  maxTranslateX = signal(0);
  cardWidth = signal(450);

  private isBrowser: boolean;
  private resizeTimeout: any;
  private intersectionObserver?: IntersectionObserver;
  private animationFrameId?: number;

  awardForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.awardForm = this.fb.group({
      awardName: ['', [Validators.required, Validators.minLength(1)]],
      description: ['', [Validators.required, Validators.minLength(1)]],
      awardCompanyName: ['', [Validators.required, Validators.minLength(1)]],
      awardLink: ['', [this.urlValidator]],
      awardYear: [''],
    });
  }

  ngOnInit() {
    console.log('AwardsComponent: Initializing...');
    this.loadAwards();
    if (this.isBrowser) {
      this.calculateCardsPerView();
      this.setupIntersectionObserver();
      this.optimizeForAnimations();
    }
    this.checkAdminStatus();
  }

  ngAfterViewInit() {
    console.log('AwardsComponent: After view init');

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
    console.log('AwardsComponent: Destroying...');
    
    // Cleanup animations
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Cleanup intersection observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    // Cleanup resize timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    // Restore body scroll if any modal was open
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    
    // Reset all modal states
    this.showAwardDetails.set(false);
    this.showForm.set(false);
    this.showAwardSelectionModal.set(false);
    this.selectedAward.set(null);
  }

  // Public methods for admin functionality
  enableAdminMode() {
    console.log('AwardsComponent: Enabling admin mode');
    this.isAdmin.set(true);
    this.checkAdminStatus();
    this.cdr.markForCheck();
  }

  disableAdminMode() {
    console.log('AwardsComponent: Disabling admin mode');
    this.isAdmin.set(false);
    this.closeForm();
    this.closeAwardSelectionModal();
    this.cdr.markForCheck();
  }

  async handleCreateOperation() {
    console.log('AwardsComponent: Handle create operation');
    try {
      await this.openForm();
    } catch (error) {
      console.error('Error opening create form:', error);
      alert('Failed to open create form. Please try again.');
    }
  }

  async handleUpdateOperation() {
    console.log('AwardsComponent: Handle update operation');
    if (this.awards().length === 0) {
      alert('No awards available to update');
      return false;
    }
    this.selectedOperation.set('update');
    this.showAwardSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleDeleteOperation() {
    console.log('AwardsComponent: Handle delete operation');
    if (this.awards().length === 0) {
      alert('No awards available to delete');
      return false;
    }
    this.selectedOperation.set('delete');
    this.showAwardSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleAwardSelection(awardId: number, operation: 'update' | 'delete') {
    console.log('AwardsComponent: Handle award selection', awardId, operation);

    const award = this.awards().find((a) => a.id === awardId);
    if (!award) {
      alert('Award not found');
      return;
    }

    try {
      if (operation === 'update') {
        await this.openForm(award);
      } else if (operation === 'delete') {
        await this.deleteAward(awardId, award.awardName);
      }
    } catch (error) {
      console.error(`Error handling ${operation} operation:`, error);
      alert(`Failed to ${operation} award. Please try again.`);
    }
  }

  async refreshAwards() {
    console.log('AwardsComponent: Refreshing awards...');
    await this.loadAwards();
  }

  // FIXED: Keyboard event handling for modal
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
    // Close award details modal on Escape key
    if (this.showAwardDetails()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeAwardDetails();
        return;
      }
    }

    // Close award selection modal on Escape key
    if (this.showAwardSelectionModal()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeAwardSelectionModal();
        return;
      }
    }

    // Close form modal on Escape key
    if (this.showForm()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeForm();
        return;
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
        'AwardsComponent: Admin authentication status:',
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
  async openForm(award?: Award) {
    console.log(
      'AwardsComponent: Opening form',
      award ? 'for editing' : 'for creation'
    );

    try {
      this.resetForm();

      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
      }

      if (award) {
        this.editingId.set(award.id);

        this.awardForm.patchValue({
          awardName: award.awardName,
          description: award.description,
          awardCompanyName: award.awardCompanyName,
          awardLink: award.awardLink || '',
          awardYear: award.awardYear || '',
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
    console.log('AwardsComponent: Closing form');
    this.showForm.set(false);
    this.resetForm();

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  resetForm() {
    this.awardForm.reset();
    this.awardForm.patchValue({
      awardName: '',
      description: '',
      awardCompanyName: '',
      awardLink: '',
      awardYear: '',
    });
    this.editingId.set(null);
  }

  // Load awards
  async loadAwards() {
    console.log('AwardsComponent: Loading awards...');
    this.isLoading.set(true);
    try {
      const awards = await this.awardService.getAllAwards();
      awards.sort((a, b) => b.id - a.id);
      this.awards.set(awards);

      this.currentTranslateX.set(0);
      this.currentIndicatorIndex.set(0);

      if (this.isBrowser) {
        setTimeout(() => {
          this.calculateCardsPerView();
          this.updateCarouselConstraints();
          this.observeAwardCards();
          this.applyOptimizedStyles();
        }, 300);
      }
      console.log(
        'AwardsComponent: Awards loaded successfully',
        awards.length,
        'awards'
      );
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading awards:', error);
      this.awards.set([]);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  get isFormValid(): boolean {
    if (!this.awardForm) {
      return false;
    }

    const awardNameValid = this.awardForm.get('awardName')?.valid;
    const descriptionValid = this.awardForm.get('description')?.valid;
    const awardCompanyValid = this.awardForm.get('awardCompanyName')?.valid;
    const linkValid = this.awardForm.get('awardLink')?.valid;

    return !!(
      awardNameValid &&
      descriptionValid &&
      awardCompanyValid &&
      linkValid
    );
  }

  async onSubmit() {
    console.log('AwardsComponent: Submitting form...');

    if (!this.isFormValid) {
      this.markAllFieldsAsTouched();
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.awardForm.value;

      const awardData = {
        awardName: formValue.awardName.trim(),
        description: formValue.description.trim(),
        awardCompanyName: formValue.awardCompanyName.trim(),
        awardLink: formValue.awardLink?.trim() || null,
        awardYear: formValue.awardYear?.trim() || null,
      };

      console.log('Submitting award data:', awardData);

      if (this.editingId()) {
        await this.awardService.updateAward(this.editingId()!, awardData);
        console.log('Award updated successfully');
      } else {
        await this.awardService.createAward(awardData);
        console.log('Award created successfully');
      }

      await this.loadAwards();
      this.closeForm();

      const message = this.editingId()
        ? 'Award updated successfully!'
        : 'Award created successfully!';
      alert(message);
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage =
        error.message ||
        'An error occurred while saving the award. Please try again.';
      alert(errorMessage);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  async deleteAward(id: number, awardName: string) {
    const confirmMessage = `Are you sure you want to delete the award "${awardName}"?\n\nThis action cannot be undone.`;
    if (confirm(confirmMessage)) {
      this.isLoading.set(true);
      try {
        await this.awardService.deleteAward(id);
        await this.loadAwards();
        alert('Award deleted successfully!');
      } catch (error: any) {
        console.error('Delete error:', error);
        const errorMessage =
          error.message || 'Failed to delete award. Please try again.';
        alert(errorMessage);
      } finally {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    }
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.awardForm.controls).forEach((key) => {
      const control = this.awardForm.get(key);
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
  closeAwardSelectionModal() {
    this.showAwardSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedAwardId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  selectAward(awardId: number) {
    this.selectedAwardId.set(awardId);
    const operation = this.selectedOperation();

    this.closeAwardSelectionModal();

    const award = this.awards().find((a) => a.id === awardId);
    if (!award) {
      alert('Award not found');
      return;
    }

    if (operation === 'update') {
      this.openForm(award);
    } else if (operation === 'delete') {
      this.deleteAward(awardId, award.awardName);
    }
  }

  // FIXED: Award Details Modal Methods
  openAwardDetails(award: Award): void {
    console.log('Opening award details for:', award.awardName);
    
    // Set the selected award first
    this.selectedAward.set(award);
    
    // Show the modal
    this.showAwardDetails.set(true);

    // Handle body scroll and focus management
    if (this.isBrowser) {
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
      
      // Add modal overlay to DOM if it doesn't exist
      setTimeout(() => {
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
          // Ensure the modal is properly positioned
          (modalOverlay as HTMLElement).style.position = 'fixed';
          (modalOverlay as HTMLElement).style.top = '0';
          (modalOverlay as HTMLElement).style.left = '0';
          (modalOverlay as HTMLElement).style.width = '100%';
          (modalOverlay as HTMLElement).style.height = '100%';
          (modalOverlay as HTMLElement).style.zIndex = '15000';
          (modalOverlay as HTMLElement).style.display = 'flex';
          (modalOverlay as HTMLElement).style.alignItems = 'center';
          (modalOverlay as HTMLElement).style.justifyContent = 'center';
        }
        
        // Focus on close button for accessibility
        const closeButton = document.querySelector('.modal-close-btn') as HTMLElement;
        if (closeButton) {
          closeButton.focus();
        }
      }, 100);
    }
    
    // Trigger change detection
    this.cdr.markForCheck();
  }

  closeAwardDetails(): void {
    console.log('Closing award details modal');
    
    // Hide the modal
    this.showAwardDetails.set(false);
    this.selectedAward.set(null);

    // Restore body scrolling
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    
    // Trigger change detection
    this.cdr.markForCheck();
  }

  // OPTIONAL: Add method to handle click outside modal
  onModalOverlayClick(event: MouseEvent): void {
    // Only close if clicking on the overlay itself, not the modal content
    if (event.target === event.currentTarget) {
      this.closeAwardDetails();
    }
  }

  // FIXED: shouldShowKnowMore method - more reliable threshold
  shouldShowKnowMore(description: string | null | undefined): boolean {
    if (!description) return false;
    
    // More reliable character count - trim whitespace first
    const trimmedDescription = description.trim();
    const maxChars = 120; // Slightly increased threshold
    
    console.log(`Description length: ${trimmedDescription.length}, threshold: ${maxChars}`);
    
    return trimmedDescription.length > maxChars;
  }

  // FIXED: getDescriptionPreview method - consistent with shouldShowKnowMore
  getDescriptionPreview(description: string | null | undefined): string {
    if (!description) return '';

    const trimmedDescription = description.trim();
    const maxChars = 120; // Match shouldShowKnowMore threshold
    
    if (trimmedDescription.length <= maxChars) {
      return trimmedDescription;
    }

    // Find the last complete word within the limit
    const truncated = trimmedDescription.substring(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxChars * 0.7) { // Only break on space if it's not too early
      return trimmedDescription.substring(0, lastSpace) + '...';
    } else {
      return truncated + '...';
    }
  }

  trackByAwardId(index: number, award: Award): number {
    return award.id;
  }

  // Animation Optimization Methods
  private optimizeForAnimations() {
    if (!this.isBrowser) return;

    const style = document.createElement('style');
    style.textContent = `
      .award-card {
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
      '.award-card'
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

  private observeAwardCards() {
    if (!this.intersectionObserver || !this.isBrowser) return;

    const cards = document.querySelectorAll('.award-card');
    cards.forEach((card) => {
      this.intersectionObserver!.observe(card);
      this.optimizeCardForAnimation(card as HTMLElement);
    });
  }

  // Carousel Methods
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
      '.award-card'
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
    const totalAwards = this.awards().length;
    const cardsPerView = this.cardsPerView();

    if (totalAwards <= cardsPerView) {
      this.maxTranslateX.set(0);
      this.currentTranslateX.set(0);
      this.currentIndicatorIndex.set(0);
      return;
    }

    const cardWidth = this.cardWidth();
    const gap = 32;
    const scrollDistance = cardWidth + gap;
    const maxScroll = (totalAwards - cardsPerView) * scrollDistance;
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
    const totalAwards = this.awards().length;
    const cardsPerView = this.cardsPerView();
    return totalAwards > cardsPerView;
  }

  getCarouselIndicators(): number[] {
    const totalAwards = this.awards().length;
    const cardsPerView = this.cardsPerView();

    if (totalAwards <= cardsPerView) return [];

    const totalIndicators = totalAwards - cardsPerView + 1;
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

      const grid = document.querySelector('.awards-grid') as HTMLElement;
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