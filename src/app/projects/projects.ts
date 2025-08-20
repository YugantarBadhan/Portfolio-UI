// Enhanced Square Projects Component with Know More Modal - Cleaned console logs
import { Component, OnInit, inject, signal, PLATFORM_ID, Inject, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectService } from '../services/project.service';
import { Project } from '../model/project.model';
import { ConfigService } from '../services/config.service';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';

// Declare Quill for TypeScript
declare var Quill: any;

interface GitHubRepo {
  url: string;
  name: string;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SafeHtmlPipe],
  templateUrl: './projects.html',
  styleUrls: ['./projects.css']
})
export class ProjectsComponent implements OnInit, AfterViewInit {
  @ViewChild('quillEditor', { static: false }) quillEditorRef!: ElementRef;
  @ViewChild('projectsGrid', { static: false }) projectsGridRef!: ElementRef;
  
  private projectService = inject(ProjectService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);

  projects = signal<Project[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);
  showGithubRepos = signal(false);
  currentGithubRepos = signal<GitHubRepo[]>([]);
  
  // NEW: Project Details Modal State
  showProjectDetails = signal(false);
  selectedProject = signal<Project | null>(null);
  
  // Enhanced carousel state for perfect square cards and full-screen layout
  currentTranslateX = signal(0);
  currentIndicatorIndex = signal(0);
  cardsPerView = signal(3); // Default to 3 for desktop
  maxTranslateX = signal(0);
  cardWidth = signal(450); // Default card width - increased for consistency
  
  private isBrowser: boolean;
  private quillEditor: any = null;
  private quillLoaded = false;
  private resizeTimeout: any;
  private intersectionObserver?: IntersectionObserver;
  private animationFrameId?: number;

  projectForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    this.projectForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(400)]],
      description: ['', [Validators.required, Validators.minLength(1)]], 
      techStack: [''], 
      githubLink: ['', [this.multiUrlValidator]], 
      liveDemoLink: ['', [this.urlValidator]]
    });
  }

  ngOnInit() {
    this.loadProjects();
    // Only load Quill in browser environment
    if (this.isBrowser) {
      this.loadQuillEditor();
      this.calculateCardsPerView();
      this.setupIntersectionObserver();
      this.optimizeForAnimations();
    }
  }

  ngAfterViewInit() {
    // Only initialize Quill in browser environment
    if (this.isBrowser && this.showForm() && this.quillLoaded) {
      setTimeout(() => this.initializeQuillEditor(), 100);
    }
    
    // Initialize carousel calculations with delay for proper DOM measurement
    if (this.isBrowser) {
      setTimeout(() => {
        this.calculateCardsPerView();
        this.updateCarouselConstraints();
        this.applyOptimizedStyles();
      }, 500);
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any) {
    if (this.isBrowser) {
      // Debounce resize events for better performance
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.calculateCardsPerView();
        this.updateCarouselConstraints();
        // Reset position if needed
        this.adjustCarouselPosition();
        this.applyOptimizedStyles();
      }, 150);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Enhanced keyboard navigation for modals
    if (this.showProjectDetails()) {
      if (event.key === 'Escape') {
        this.closeProjectDetails();
        event.preventDefault();
      }
    }
    
    if (this.showGithubRepos()) {
      if (event.key === 'Escape') {
        this.closeGithubRepos();
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

  // Admin Mode Control Methods - EXISTING
  enableAdminMode() {
    this.isAdmin.set(true);
    this.checkAdminStatus();
  }

  disableAdminMode() {
    this.isAdmin.set(false);
    this.closeForm();
  }

  // Admin operation methods to be called from parent component - EXISTING
  async handleCreateOperation() {
    this.openForm();
  }

  async handleUpdateOperation() {
    if (this.projects().length === 0) {
      alert('No projects available to update');
      return false;
    }
    return true; // Indicates that project selection should be shown
  }

  async handleDeleteOperation() {
    if (this.projects().length === 0) {
      alert('No projects available to delete');
      return false;
    }
    return true; // Indicates that project selection should be shown
  }

  // Handle project selection for update/delete operations - EXISTING
  async handleProjectSelection(projectId: number, operation: 'update' | 'delete') {
    const project = this.projects().find(p => p.id === projectId);
    if (!project) {
      alert('Project not found');
      return;
    }

    if (operation === 'update') {
      this.openForm(project);
    } else if (operation === 'delete') {
      await this.deleteProject(projectId, project.title);
    }
  }

  // Refresh projects method for parent component - EXISTING
  async refreshProjects() {
    await this.loadProjects();
  }

  // ================================
  // NEW: PROJECT DETAILS MODAL METHODS
  // ================================

  /**
   * Opens the project details modal with full description and enhanced UI
   * @param project - The project to display details for
   */
  openProjectDetails(project: Project): void {
    this.selectedProject.set(project);
    this.showProjectDetails.set(true);
    
    // Prevent body scroll when modal is open
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
      
      // Focus management for accessibility
      setTimeout(() => {
        const closeButton = document.querySelector('.modal-close-btn') as HTMLElement;
        if (closeButton) {
          closeButton.focus();
        }
      }, 100);
    }
  }

  /**
   * Closes the project details modal
   */
  closeProjectDetails(): void {
    this.showProjectDetails.set(false);
    this.selectedProject.set(null);
    
    // Restore body scroll
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
      
      // Return focus to the "Know More" button that opened the modal
      setTimeout(() => {
        const activeProject = this.selectedProject();
        if (activeProject) {
          const knowMoreBtn = document.querySelector(
            `[data-project-id="${activeProject.id}"] .know-more-btn`
          ) as HTMLElement;
          if (knowMoreBtn) {
            knowMoreBtn.focus();
          }
        }
      }, 100);
    }
  }

/**
 * Generates a clean preview of the project description
 * Removes HTML tags and limits to approximately 4 lines
 * SSR-safe implementation
 * @param description - Full HTML description (can be null/undefined)
 * @returns Clean preview text
 */
getDescriptionPreview(description: string | null | undefined): string {
  if (!description) return '';
  
  let plainText = '';
  
  if (this.isBrowser && typeof document !== 'undefined') {
    // Browser environment: Use DOM manipulation for accurate HTML stripping
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = description;
      plainText = tempDiv.textContent || tempDiv.innerText || '';
    } catch (error) {
      console.warn('Error parsing HTML in browser, falling back to regex:', error);
      plainText = this.stripHtmlWithRegex(description);
    }
  } else {
    // SSR environment: Use regex-based HTML stripping
    plainText = this.stripHtmlWithRegex(description);
  }
  
  // Calculate approximate character limit for 4 lines
  // Assuming average of 80-90 characters per line at 1.1rem font size
  const maxChars = 320;
  
  if (plainText.length <= maxChars) {
    return plainText;
  }
  
  // Find the last complete sentence within the limit
  const truncated = plainText.substring(0, maxChars);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );
  
  if (lastSentenceEnd > maxChars * 0.7) { // If sentence end is reasonably close
    return plainText.substring(0, lastSentenceEnd + 1);
  } else {
    // Fall back to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? plainText.substring(0, lastSpace) + '...' : truncated + '...';
  }
}

/**
 * Regex-based HTML stripping for SSR environment
 * @param html - HTML string to strip
 * @returns Plain text content
 */
private stripHtmlWithRegex(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  // Remove HTML tags using regex
  let text = html.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&hellip;/g, '...');
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

  // ================================
  // ENHANCED ANIMATION AND OPTIMIZATION METHODS
  // ================================

  private optimizeForAnimations() {
    if (!this.isBrowser) return;

    // Force hardware acceleration on key elements
    const style = document.createElement('style');
    style.textContent = `
      .project-card {
        -webkit-transform: translateZ(0) !important;
        transform: translateZ(0) !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        backface-visibility: hidden !important;
        perspective: 1000px !important;
      }
      
      .project-card:hover {
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
      }
      
      .project-card * {
        -webkit-font-smoothing: inherit !important;
        -moz-osx-font-smoothing: inherit !important;
        text-rendering: inherit !important;
      }
      
      .project-details-modal {
        -webkit-transform: translateZ(0) !important;
        transform: translateZ(0) !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
      }
    `;
    document.head.appendChild(style);
  }

  private applyOptimizedStyles() {
    if (!this.isBrowser) return;
    
    // Apply optimization to all project cards
    const cards = document.querySelectorAll('.project-card') as NodeListOf<HTMLElement>;
    cards.forEach(card => {
      // Force hardware acceleration and crisp text
      card.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
      card.style.setProperty('transform', 'translateZ(0)', 'important');
      card.style.setProperty('-webkit-font-smoothing', 'antialiased', 'important');
      card.style.setProperty('-moz-osx-font-smoothing', 'grayscale', 'important');
      card.style.setProperty('text-rendering', 'optimizeLegibility', 'important');
      card.style.setProperty('backface-visibility', 'hidden', 'important');
      
      // Apply to all child elements
      const allChildren = card.querySelectorAll('*') as NodeListOf<HTMLElement>;
      allChildren.forEach(child => {
        child.style.setProperty('-webkit-font-smoothing', 'inherit', 'important');
        child.style.setProperty('-moz-osx-font-smoothing', 'inherit', 'important');
        child.style.setProperty('text-rendering', 'inherit', 'important');
      });
    });
  }

  // Enhanced Performance Optimization with Intersection Observer
  private setupIntersectionObserver() {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const card = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          card.style.willChange = 'transform';
          // Apply optimization when card becomes visible
          this.optimizeCardForAnimation(card);
        } else {
          card.style.willChange = 'auto';
        }
      });
    }, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    });
  }

  private optimizeCardForAnimation(card: HTMLElement) {
    // Apply optimizations to prevent blur during animations
    card.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
    card.style.setProperty('transform', 'translateZ(0)', 'important');
    card.style.setProperty('-webkit-font-smoothing', 'antialiased', 'important');
    card.style.setProperty('-moz-osx-font-smoothing', 'grayscale', 'important');
    card.style.setProperty('text-rendering', 'optimizeLegibility', 'important');
    card.style.setProperty('backface-visibility', 'hidden', 'important');
    card.style.setProperty('perspective', '1000px', 'important');
  }

  private observeProjectCards() {
    if (!this.intersectionObserver || !this.isBrowser) return;
    
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
      this.intersectionObserver!.observe(card);
      // Immediately optimize visible cards
      this.optimizeCardForAnimation(card as HTMLElement);
    });
  }

  // Enhanced Carousel Methods for Perfect Square Cards and Full-Screen Layout
  private calculateCardsPerView() {
    if (!this.isBrowser) return;

    const windowWidth = window.innerWidth;
    
    // Calculate optimal card count based on consistent card sizes
    if (windowWidth <= 480) {
      this.cardsPerView.set(1);
      this.cardWidth.set(320); // Fixed size for mobile
    } else if (windowWidth <= 768) {
      this.cardsPerView.set(1);
      this.cardWidth.set(350); // Fixed size for tablet
    } else if (windowWidth <= 1200) {
      this.cardsPerView.set(2);
      this.cardWidth.set(380); // Fixed size for small desktop
    } else if (windowWidth <= 1400) {
      this.cardsPerView.set(3);
      this.cardWidth.set(400); // Fixed size for medium desktop
    } else {
      this.cardsPerView.set(3);
      this.cardWidth.set(450); // Fixed size for large desktop
    }
    
    this.updateCarouselConstraints();
    this.updateCardStyles();
  }

  private updateCardStyles() {
    if (!this.isBrowser) return;
    
    const cards = document.querySelectorAll('.project-card') as NodeListOf<HTMLElement>;
    const cardSize = this.cardWidth();
    
    cards.forEach(card => {
      // Force consistent square dimensions
      card.style.setProperty('width', `${cardSize}px`, 'important');
      card.style.setProperty('height', `${cardSize}px`, 'important');
      card.style.setProperty('min-width', `${cardSize}px`, 'important');
      card.style.setProperty('min-height', `${cardSize}px`, 'important');
      card.style.setProperty('max-width', `${cardSize}px`, 'important');
      card.style.setProperty('max-height', `${cardSize}px`, 'important');
      
      // Apply animation optimizations
      this.optimizeCardForAnimation(card);
    });
  }

  private updateCarouselConstraints() {
    const totalProjects = this.projects().length;
    const cardsPerView = this.cardsPerView();
    
    if (totalProjects <= cardsPerView) {
      this.maxTranslateX.set(0);
      this.currentTranslateX.set(0);
      this.currentIndicatorIndex.set(0);
      return;
    }
    
    // Calculate max scroll based on card width and gap
    const cardWidth = this.cardWidth();
    const gap = 32; // 2rem gap between cards
    const scrollDistance = cardWidth + gap;
    const maxScroll = (totalProjects - cardsPerView) * scrollDistance;
    this.maxTranslateX.set(-maxScroll);
  }

  private adjustCarouselPosition() {
    // Ensure current position is still valid after resize
    const currentTranslate = this.currentTranslateX();
    const maxTranslate = this.maxTranslateX();
    
    if (currentTranslate < maxTranslate) {
      // Calculate nearest valid position
      const cardWidth = this.cardWidth();
      const gap = 32;
      const scrollDistance = cardWidth + gap;
      const validPosition = Math.ceil(Math.abs(currentTranslate) / scrollDistance) * scrollDistance;
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
    const gap = 32; // 2rem gap
    const scrollAmount = cardWidth + gap;

    let newTranslate = currentTranslate;
    
    if (direction === 'left' && this.canScrollLeft()) {
      newTranslate = Math.min(0, currentTranslate + scrollAmount);
    } else if (direction === 'right' && this.canScrollRight()) {
      newTranslate = Math.max(this.maxTranslateX(), currentTranslate - scrollAmount);
    }

    // Smooth animation with enhanced easing and optimization
    this.animateCarousel(newTranslate);
  }

  // OPTIMIZED: Enhanced animation with blur prevention
  private animateCarousel(targetTranslate: number) {
    const startTranslate = this.currentTranslateX();
    const duration = 600; // Slightly longer for smoother animation
    const startTime = performance.now();

    // Cancel any existing animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Enhanced easing function for smoother animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentTranslate = startTranslate + (targetTranslate - startTranslate) * easeOutCubic;
      this.currentTranslateX.set(currentTranslate);

      // Force repaint optimization
      const grid = document.querySelector('.projects-grid') as HTMLElement;
      if (grid) {
        // Use transform3d for hardware acceleration and blur prevention
        grid.style.transform = `translate3d(${currentTranslate}px, 0, 0)`;
        grid.style.webkitTransform = `translate3d(${currentTranslate}px, 0, 0)`;
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.currentTranslateX.set(targetTranslate);
        this.updateIndicatorIndex();
        this.animationFrameId = undefined;
        
        // Final optimization application
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

  shouldShowIndicators(): boolean {
    const totalProjects = this.projects().length;
    const cardsPerView = this.cardsPerView();
    return totalProjects > cardsPerView;
  }

  getCarouselIndicators(): number[] {
    const totalProjects = this.projects().length;
    const cardsPerView = this.cardsPerView();
    
    if (totalProjects <= cardsPerView) return [];
    
    const totalIndicators = totalProjects - cardsPerView + 1;
    return Array(totalIndicators).fill(0).map((_, index) => index);
  }

  scrollToIndicator(indicatorIndex: number) {
    if (!this.isBrowser) return;
    
    const cardWidth = this.cardWidth();
    const gap = 32;
    const scrollDistance = cardWidth + gap;
    const newTranslate = -indicatorIndex * scrollDistance;
    const clampedTranslate = Math.max(this.maxTranslateX(), Math.min(0, newTranslate));
    
    this.animateCarousel(clampedTranslate);
  }

  // TrackBy function for better performance
  trackByProjectId(index: number, project: Project): number {
    return project.id;
  }

  // GitHub repositories functionality
  hasMultipleGithubRepos(githubLink: string): boolean {
    if (!githubLink) return false;
    return githubLink.includes(',');
  }

  getGithubRepoCount(githubLink: string): number {
    if (!githubLink) return 0;
    return githubLink.split(',').filter(url => url.trim()).length;
  }

  openGithubRepos(githubLink: string): void {
    if (!githubLink) return;
    
    const urls = githubLink.split(',').map(url => url.trim()).filter(url => url);
    const repos: GitHubRepo[] = urls.map((url, index) => ({
      url: url,
      name: this.extractRepoName(url) || `Repository ${index + 1}`
    }));
    
    this.currentGithubRepos.set(repos);
    this.showGithubRepos.set(true);
    
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
  }

  closeGithubRepos(): void {
    this.showGithubRepos.set(false);
    this.currentGithubRepos.set([]);
    
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  private extractRepoName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      
      if (pathParts.length >= 2) {
        return `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`;
      }
      
      return pathParts[pathParts.length - 1] || '';
    } catch {
      // If URL parsing fails, try simple string manipulation
      const parts = url.split('/').filter(part => part);
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
      return parts[parts.length - 1] || '';
    }
  }

  private async loadQuillEditor() {
    if (!this.isBrowser || this.quillLoaded) {
      return;
    }

    try {
      // Ensure we're in browser before manipulating DOM
      if (typeof document === 'undefined') {
        return;
      }

      // Load Quill CSS
      const quillCSS = document.createElement('link');
      quillCSS.rel = 'stylesheet';
      quillCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css';
      document.head.appendChild(quillCSS);

      // Load Quill JS
      const quillJS = document.createElement('script');
      quillJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js';
      
      return new Promise<void>((resolve, reject) => {
        quillJS.onload = () => {
          this.quillLoaded = true;
          resolve();
        };
        quillJS.onerror = reject;
        document.head.appendChild(quillJS);
      });
    } catch (error) {
      console.error('Failed to load Quill editor:', error);
    }
  }

  private initializeQuillEditor() {
    if (!this.isBrowser || !this.quillLoaded || !this.quillEditorRef?.nativeElement || this.quillEditor) {
      return;
    }

    try {
      // Double check we have Quill available
      if (typeof Quill === 'undefined') {
        console.warn('Quill is not loaded, falling back to textarea');
        this.showQuillFallback();
        return;
      }

      // Enhanced Quill configuration with more formatting options
      const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link'],
        ['clean']
      ];

      this.quillEditor = new Quill(this.quillEditorRef.nativeElement, {
        theme: 'snow',
        modules: {
          toolbar: toolbarOptions
        },
        placeholder: 'Describe your project in detail. Include features, technologies used, challenges overcome, and key achievements...',
        formats: [
          'header', 'bold', 'italic', 'underline', 'strike',
          'list', 'bullet', 'indent', 'color', 'background',
          'align', 'link'
        ]
      });

      // Enhanced styling enforcement with retry mechanism
      const forceStyles = () => {
        this.forceWhiteBackgroundBlackText();
        // Additional retry for stubborn elements
        setTimeout(() => this.forceWhiteBackgroundBlackText(), 50);
      };

      // Initial styling
      setTimeout(forceStyles, 50);

      // Set initial content if editing
      const currentDescription = this.projectForm.get('description')?.value;
      if (currentDescription) {
        this.quillEditor.root.innerHTML = currentDescription;
        setTimeout(forceStyles, 100);
      }

      // Enhanced event listeners with styling enforcement
      this.quillEditor.on('text-change', () => {
        const html = this.quillEditor.root.innerHTML;
        const text = this.quillEditor.getText().trim();
        
        // Update form control with HTML content
        this.projectForm.get('description')?.setValue(html);
        
        // Enhanced validation
        if (text.length === 0 || html === '<p><br></p>') {
          this.projectForm.get('description')?.setErrors({ required: true });
        } else {
          this.projectForm.get('description')?.setErrors(null);
        }

        // Force styling after each change with debouncing
        setTimeout(forceStyles, 10);
      });

      this.quillEditor.on('selection-change', () => {
        setTimeout(forceStyles, 10);
      });

      // Handle focus/blur events for better UX
      this.quillEditor.on('selection-change', (range: any) => {
        if (range) {
          // Editor is focused
          const container = this.quillEditorRef.nativeElement.closest('.quill-editor-container');
          if (container) {
            container.style.borderColor = '#007bff';
            container.style.boxShadow = '0 0 0 2px rgba(0, 123, 255, 0.25)';
          }
        } else {
          // Editor is blurred
          const container = this.quillEditorRef.nativeElement.closest('.quill-editor-container');
          if (container) {
            container.style.borderColor = '#ddd';
            container.style.boxShadow = 'none';
          }
        }
      });

    } catch (error) {
      console.error('Error initializing Quill editor:', error);
      // Fallback to regular textarea if Quill fails
      this.showQuillFallback();
    }
  }

  private forceWhiteBackgroundBlackText() {
    if (!this.isBrowser || !this.quillEditor || !this.quillEditor.root) {
      return;
    }

    const editorElement = this.quillEditor.root;
    
    // Enhanced styling enforcement with important flags
    const forceStyle = (element: HTMLElement, styles: Record<string, string>) => {
      Object.entries(styles).forEach(([property, value]) => {
        element.style.setProperty(property, value, 'important');
      });
    };

    // Force main editor styles
    forceStyle(editorElement, {
      'background': 'white',
      'color': '#333333',
      'padding': '15px',
      'min-height': '120px',
      'font-family': 'inherit'
    });

    // Force container styles
    const container = editorElement.parentElement;
    if (container && container.classList.contains('ql-container')) {
      forceStyle(container, {
        'background': 'white',
        'border': 'none'
      });
    }

    // Force all child elements
    const allElements = editorElement.querySelectorAll('*');
    allElements.forEach((element: Element) => {
      const htmlElement = element as HTMLElement;
      forceStyle(htmlElement, {
        'color': '#333333',
        'background': 'transparent'
      });
    });

    // Force specific text elements with enhanced selectors
    const textSelectors = 'p, div, span, h1, h2, h3, h4, h5, h6, li, strong, em, u, s, a, ol, ul, blockquote';
    const textElements = editorElement.querySelectorAll(textSelectors);
    textElements.forEach((element: Element) => {
      const htmlElement = element as HTMLElement;
      forceStyle(htmlElement, {
        'color': '#333333',
        'background': 'transparent'
      });
      
      // Remove any inline styles that might override our important styles
      if (htmlElement.style.color && htmlElement.style.color !== '#333333') {
        htmlElement.style.removeProperty('color');
        htmlElement.style.setProperty('color', '#333333', 'important');
      }
    });

    // Enhanced attribute-based styling
    editorElement.setAttribute('style', editorElement.getAttribute('style') + '; color: #333333 !important; background: white !important;');
  }

  private showQuillFallback() {
    if (!this.isBrowser) {
      return;
    }
    
    // Hide Quill container and show fallback textarea
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
      // Get content before destroying
      const content = this.quillEditor.root.innerHTML;
      this.projectForm.get('description')?.setValue(content);
      
      // Destroy the editor
      this.quillEditor = null;
    } catch (error) {
      console.error('Error destroying Quill editor:', error);
    }
  }

  // Enhanced URL validators with better error handling
  private urlValidator(control: any) {
    const value = control.value;
    if (!value || value.trim() === '') {
      return null; // Allow empty values for optional fields
    }
    
    try {
      const url = new URL(value.trim());
      // Additional validation for common URL issues
      if (!url.protocol.startsWith('http')) {
        return { invalidUrl: true };
      }
      return null;
    } catch {
      return { invalidUrl: true };
    }
  }

  private multiUrlValidator(control: any) {
    const value = control.value;
    if (!value || value.trim() === '') {
      return null; // Allow empty values for optional fields
    }
    
    // Split by comma and validate each URL
    const urls = value.split(',').map((url: string) => url.trim()).filter((url: string) => url);
    
    if (urls.length === 0) {
      return null;
    }
    
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        if (!urlObj.protocol.startsWith('http')) {
          return { invalidUrl: true };
        }
      } catch {
        return { invalidUrl: true };
      }
    }
    
    return null;
  }

  private checkAdminStatus() {
    if (!this.isBrowser) {
      return;
    }
    
    try {
      const adminToken = localStorage.getItem('adminToken');
      this.isAdmin.set(adminToken === this.configService.adminToken);
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.isAdmin.set(false);
    }
  }

  async loadProjects() {
    this.isLoading.set(true);
    try {
      const projects = await this.projectService.getAllProjects();
      // Sort projects by ID in descending order (newest first)
      projects.sort((a, b) => b.id - a.id);
      this.projects.set(projects);
      
      // Reset carousel position and recalculate constraints
      this.currentTranslateX.set(0);
      this.currentIndicatorIndex.set(0);
      
      if (this.isBrowser) {
        setTimeout(() => {
          this.calculateCardsPerView();
          this.updateCarouselConstraints();
          this.observeProjectCards();
          this.applyOptimizedStyles(); // Apply optimizations after load
        }, 300);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  get isFormValid(): boolean {
    if (!this.projectForm) {
      return false;
    }

    const titleValid = this.projectForm.get('title')?.valid;
    const descriptionValid = this.projectForm.get('description')?.valid;
    const githubValid = this.projectForm.get('githubLink')?.valid;
    const demoValid = this.projectForm.get('liveDemoLink')?.valid;

    // Additional check for Quill content
    if (this.quillEditor) {
      const text = this.quillEditor.getText().trim();
      if (text.length === 0) {
        return false;
      }
    }

    return !!(titleValid && descriptionValid && githubValid && demoValid);
  }

  openForm(project?: Project) {
    this.resetForm();
    
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    
    if (project) {
      this.editingId.set(project.id);
      
      this.projectForm.patchValue({
        title: project.title,
        description: project.description,
        techStack: project.techStack || '',
        githubLink: project.githubLink || '',
        liveDemoLink: project.liveDemoLink || ''
      });
    } else {
      this.editingId.set(null);
    }
    
    this.showForm.set(true);
    
    // Initialize Quill editor after form is shown with enhanced timing
    if (this.isBrowser && this.quillLoaded) {
      setTimeout(() => {
        this.initializeQuillEditor();
        // Additional delay for content setting in edit mode
        if (project) {
          setTimeout(() => {
            if (this.quillEditor && project.description) {
              this.quillEditor.root.innerHTML = project.description;
              this.forceWhiteBackgroundBlackText();
            }
          }, 100);
        }
      }, 250);
    }
  }

  closeForm() {
    this.destroyQuillEditor();
    this.showForm.set(false);
    this.resetForm();
    
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  closeFormOnBackdrop(event: Event) {
    if (event.target === event.currentTarget) {
      this.closeForm();
    }
  }

  resetForm() {
    this.projectForm.reset();
    this.projectForm.patchValue({
      title: '',
      description: '',
      techStack: '',
      githubLink: '',
      liveDemoLink: ''
    });
    this.editingId.set(null);
  }

  async onSubmit() {
    // Ensure Quill content is saved to form before validation
    if (this.isBrowser && this.quillEditor) {
      const html = this.quillEditor.root.innerHTML;
      const text = this.quillEditor.getText().trim();
      if (text.length > 0 && html !== '<p><br></p>') {
        this.projectForm.get('description')?.setValue(html);
      }
    }

    if (!this.isFormValid) {
      this.markAllFieldsAsTouched();
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.projectForm.value;
      
      const projectData = {
        title: formValue.title.trim(),
        description: formValue.description, // This now contains HTML from Quill
        techStack: formValue.techStack?.trim() || null,
        githubLink: formValue.githubLink?.trim() || null,
        liveDemoLink: formValue.liveDemoLink?.trim() || null
      };

      if (this.editingId()) {
        await this.projectService.updateProject(this.editingId()!, projectData);
      } else {
        await this.projectService.createProject(projectData);
      }
      
      await this.loadProjects();
      this.closeForm();
      
      // Enhanced success feedback
      const message = this.editingId() ? 'Project updated successfully!' : 'Project created successfully!';
      alert(message);
      
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error.message || 'An error occurred while saving the project. Please try again.';
      alert(errorMessage);
    } finally {
      this.isLoading.set(false);
    }
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.projectForm.controls).forEach(key => {
      const control = this.projectForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  async deleteProject(id: number, title: string) {
    const confirmMessage = `Are you sure you want to delete the project "${title}"?\n\nThis action cannot be undone.`;
    if (confirm(confirmMessage)) {
      this.isLoading.set(true);
      try {
        await this.projectService.deleteProject(id);
        await this.loadProjects();
        alert('Project deleted successfully!');
      } catch (error: any) {
        console.error('Delete error:', error);
        const errorMessage = error.message || 'Failed to delete project. Please try again.';
        alert(errorMessage);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  // Cleanup method for better memory management
  ngOnDestroy() {
    // Cancel any pending animations
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
}