// Enhanced Square Projects Component with Full-Screen Layout
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
  expandedDescriptions = signal<Set<number>>(new Set());
  
  // Enhanced carousel state for perfect square cards and full-screen layout
  currentTranslateX = signal(0);
  currentIndicatorIndex = signal(0);
  cardsPerView = signal(3); // Default to 3 for desktop
  maxTranslateX = signal(0);
  cardWidth = signal(400); // Default card width
  
  private isBrowser: boolean;
  private quillEditor: any = null;
  private quillLoaded = false;
  private resizeTimeout: any;
  private intersectionObserver?: IntersectionObserver;

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

    // Only check admin status in browser
    if (this.isBrowser) {
      this.checkAdminStatus();
    }
  }

  ngOnInit() {
    this.loadProjects();
    // Only load Quill in browser environment
    if (this.isBrowser) {
      this.loadQuillEditor();
      this.calculateCardsPerView();
      this.setupIntersectionObserver();
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
      }, 150);
    }
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

  private observeProjectCards() {
    if (!this.intersectionObserver || !this.isBrowser) return;
    
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
      this.intersectionObserver!.observe(card);
    });
  }

  // Enhanced Carousel Methods for Perfect Square Cards and Full-Screen Layout
  private calculateCardsPerView() {
    if (!this.isBrowser) return;

    const windowWidth = window.innerWidth;
    
    // Calculate optimal card size and count for full-screen square layout
    if (windowWidth <= 480) {
      this.cardsPerView.set(1);
      this.cardWidth.set(Math.min(windowWidth - 120, 340)); // Account for navigation arrows
    } else if (windowWidth <= 768) {
      this.cardsPerView.set(1);
      this.cardWidth.set(Math.min(windowWidth - 140, 380));
    } else if (windowWidth <= 1200) {
      this.cardsPerView.set(2);
      this.cardWidth.set(Math.min((windowWidth - 200) / 2, 400)); // Two square cards
    } else if (windowWidth <= 1600) {
      this.cardsPerView.set(3);
      this.cardWidth.set(Math.min((windowWidth - 240) / 3, 450)); // Three square cards
    } else {
      this.cardsPerView.set(3);
      this.cardWidth.set(Math.min((windowWidth - 280) / 3, 500)); // Larger square cards on large screens
    }
    
    console.log(`Cards per view: ${this.cardsPerView()} for window width: ${windowWidth}px, card width: ${this.cardWidth()}px`);
    this.updateCarouselConstraints();
    this.updateCardStyles();
  }

  private updateCardStyles() {
    if (!this.isBrowser) return;
    
    const cards = document.querySelectorAll('.project-card') as NodeListOf<HTMLElement>;
    const cardSize = this.cardWidth();
    
    cards.forEach(card => {
      // Ensure perfect square aspect ratio
      card.style.width = `${cardSize}px`;
      card.style.height = `${cardSize}px`;
      card.style.minWidth = `${Math.max(cardSize, 300)}px`;
      card.style.minHeight = `${Math.max(cardSize, 300)}px`;
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
    
    console.log(`Total projects: ${totalProjects}, Cards per view: ${cardsPerView}, Card width: ${cardWidth}, Max scroll: -${maxScroll}px`);
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
      console.log(`Scrolling left: ${currentTranslate}px -> ${newTranslate}px`);
    } else if (direction === 'right' && this.canScrollRight()) {
      newTranslate = Math.max(this.maxTranslateX(), currentTranslate - scrollAmount);
      console.log(`Scrolling right: ${currentTranslate}px -> ${newTranslate}px`);
    }

    // Smooth animation with enhanced easing
    this.animateCarousel(newTranslate);
  }

  private animateCarousel(targetTranslate: number) {
    const startTranslate = this.currentTranslateX();
    const duration = 600; // Slightly longer for smoother animation
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Enhanced easing function for smoother animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentTranslate = startTranslate + (targetTranslate - startTranslate) * easeOutCubic;
      this.currentTranslateX.set(currentTranslate);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.currentTranslateX.set(targetTranslate);
        this.updateIndicatorIndex();
      }
    };

    requestAnimationFrame(animate);
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
    
    console.log(`Jumping to indicator ${indicatorIndex}: ${clampedTranslate}px`);
    this.animateCarousel(clampedTranslate);
  }

  // TrackBy function for better performance
  trackByProjectId(index: number, project: Project): number {
    return project.id;
  }

  // Description expansion functionality - Enhanced for square cards
  isDescriptionExpanded(projectId: number): boolean {
    return this.expandedDescriptions().has(projectId);
  }

  toggleDescription(projectId: number): void {
    const expanded = new Set(this.expandedDescriptions());
    if (expanded.has(projectId)) {
      expanded.delete(projectId);
    } else {
      expanded.add(projectId);
    }
    this.expandedDescriptions.set(expanded);

    // Trigger reflow for better animation
    setTimeout(() => {
      const card = document.querySelector(`[data-project-id="${projectId}"]`);
      if (card) {
        card.classList.add('description-transitioning');
        setTimeout(() => {
          card.classList.remove('description-transitioning');
        }, 300);
      }
    }, 10);
  }

  shouldShowReadMore(description: string): boolean {
    if (!this.isBrowser || !description) return false;
    
    // Create a temporary div to measure content for square card layout
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = description;
    tempDiv.style.cssText = `
      position: absolute; 
      visibility: hidden; 
      font-size: 1.1rem; 
      line-height: 1.6; 
      width: ${Math.max(this.cardWidth() - 64, 250)}px;
    `;
    document.body.appendChild(tempDiv);
    
    const height = tempDiv.offsetHeight;
    document.body.removeChild(tempDiv);
    
    // Check if content would be more than 4 lines (4 * 1.6 * 1.1rem ≈ 105.6px)
    return height > 106;
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

  toggleAdminMode() {
    if (!this.isBrowser) {
      return;
    }
    
    try {
      const currentToken = localStorage.getItem('adminToken');
      if (currentToken === this.configService.adminToken) {
        localStorage.removeItem('adminToken');
        this.isAdmin.set(false);
      } else {
        const token = prompt('Enter admin token:');
        if (token === this.configService.adminToken) {
          localStorage.setItem('adminToken', token);
          this.isAdmin.set(true);
        } else if (token !== null) { // User didn't cancel
          alert('Invalid admin token');
        }
      }
    } catch (error) {
      console.error('Error toggling admin mode:', error);
    }
  }

  async loadProjects() {
    this.isLoading.set(true);
    try {
      const projects = await this.projectService.getAllProjects();
      // Sort projects by ID in descending order (newest first)
      projects.sort((a, b) => b.id - a.id);
      this.projects.set(projects);
      
      // Reset expanded descriptions when projects are loaded
      this.expandedDescriptions.set(new Set());
      
      // Reset carousel position and recalculate constraints
      this.currentTranslateX.set(0);
      this.currentIndicatorIndex.set(0);
      
      if (this.isBrowser) {
        setTimeout(() => {
          this.calculateCardsPerView();
          this.updateCarouselConstraints();
          this.observeProjectCards();
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