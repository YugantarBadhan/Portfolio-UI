// Author: Yugantar Badhan

import {
  Component,
  OnInit,
  HostListener,
  Inject,
  PLATFORM_ID,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  OnDestroy,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from './services/config.service';
import { AdminSessionService } from './services/admin-session.service';
import { ExperienceService } from './services/experience.service';
import { ProjectService } from './services/project.service';
import { EducationService } from './services/education.service';
import { Experience } from './model/experience.model';
import { Project } from './model/project.model';
import { Education } from './model/education.model';
import { ExperienceComponent } from './experience/experience';
import { ProjectsComponent } from './projects/projects';
import { EducationsComponent } from './educations/educations';
import { HttpEventType } from '@angular/common/http';
import { ResumeService, ResumeResponse } from './services/resume.service';
import { SkillsComponent } from './skills/skills';
import { SkillService } from './services/skill.service';
import { Skill } from './model/skill.model';
import { Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CertificationsComponent } from './certifications/certifications';
import { CertificationService } from './services/certification.service';
import { Certification } from './model/certification.model';
import { AwardsComponent } from './awards/awards';
import { AwardService } from './services/award.service';
import { Award } from './model/award.model';

interface AdminSection {
  id: string;
  label: string;
  enabled: boolean;
}

interface AdminOperation {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ExperienceComponent,
    ProjectsComponent,
    SkillsComponent,
    CertificationsComponent,
    EducationsComponent,
    AwardsComponent,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(ExperienceComponent) experienceComponentRef!: ExperienceComponent;
  @ViewChild(ProjectsComponent) projectsComponentRef!: ProjectsComponent;
  @ViewChild(SkillsComponent) skillsComponentRef!: SkillsComponent;
  @ViewChild(CertificationsComponent)
  certificationsComponentRef!: CertificationsComponent;
  @ViewChild(EducationsComponent) educationsComponentRef!: EducationsComponent;
  @ViewChild(AwardsComponent) awardsComponentRef!: AwardsComponent;

  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private configService = inject(ConfigService);
  private adminSessionService = inject(AdminSessionService);
  private experienceService = inject(ExperienceService);
  private projectService = inject(ProjectService);
  private skillService = inject(SkillService);
  private certificationService = inject(CertificationService);
  private educationService = inject(EducationService);
  private awardService = inject(AwardService);
  private resumeService = inject(ResumeService);
  private router = inject(Router);

  title = 'Portfolio-UI';
  isDarkTheme = true;
  isScrolled = false;
  isMobileMenuOpen = false;

  // Resume Upload properties
  showResumeUploadModal = signal(false);
  selectedFile: File | null = null;
  isDragOver = false;
  isUploading = signal(false);
  uploadProgress = signal(0);
  uploadError = signal<string>('');
  uploadSuccess = signal<string>('');
  existingResumes = signal<ResumeResponse[]>([]);
  resumeUploaded = signal(false);

  // Lazy loading state
  experienceComponentLoaded = signal(false);
  projectsComponentLoaded = signal(false);
  skillsComponentLoaded = signal(false);
  certificationsComponentLoaded = signal(false);
  educationsComponentLoaded = signal(false);
  awardsComponentLoaded = signal(false);

  // Component readiness tracking
  experienceComponentReady = signal(false);
  projectsComponentReady = signal(false);
  skillsComponentReady = signal(false);
  certificationsComponentReady = signal(false);
  educationsComponentReady = signal(false);
  awardsComponentReady = signal(false);

  // Admin-related properties - USING AdminSessionService
  showAdminDropdown = signal(false);
  isAdminAuthenticated = signal(false);
  showAdminTokenModal = signal(false);
  showAdminOperationsModal = signal(false);
  showExperienceSelectionModal = signal(false);
  showProjectSelectionModal = signal(false);
  showSkillSelectionModal = signal(false);
  showCertificationSelectionModal = signal(false);
  showEducationSelectionModal = signal(false);
  showAwardSelectionModal = signal(false);
  selectedAdminSection = signal<string>('');
  selectedOperation = signal<string>('');
  adminToken = '';

  // Pending operation tracking
  private pendingOperation: { section: string; operation: string } | null =
    null;

  // Data properties
  experiences = signal<Experience[]>([]);
  selectedExperienceId = signal<number | null>(null);
  projects = signal<Project[]>([]);
  selectedProjectId = signal<number | null>(null);
  skills = signal<Skill[]>([]);
  selectedSkillId = signal<number | null>(null);
  certifications = signal<Certification[]>([]);
  selectedCertificationId = signal<number | null>(null);
  educations = signal<Education[]>([]);
  selectedEducationId = signal<number | null>(null);
  awards = signal<Award[]>([]);
  selectedAwardId = signal<number | null>(null);

  private sectionObserver?: IntersectionObserver;
  private isBrowser: boolean;

  adminSections: AdminSection[] = [
    { id: 'experience', label: 'Experience', enabled: true },
    { id: 'projects', label: 'Projects', enabled: true },
    { id: 'skills', label: 'Skills', enabled: true },
    { id: 'certifications', label: 'Certifications', enabled: true },
    { id: 'educations', label: 'Educations', enabled: true },
    { id: 'awards', label: 'Awards', enabled: true },
  ];

  adminOperations: AdminOperation[] = [
    { id: 'create', label: 'Create New', icon: 'fa-plus' },
    { id: 'update', label: 'Update Existing', icon: 'fa-edit' },
    { id: 'delete', label: 'Delete Existing', icon: 'fa-trash' },
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      // CRITICAL: Sync with the theme already applied in index.html
      // Don't set a default - read what's already been applied
      try {
        const savedTheme = localStorage.getItem('theme');
        this.isDarkTheme = savedTheme !== 'light'; // true unless explicitly light

        // Theme is already applied in index.html, just sync the state
        // NO need to call applyTheme() here - it's already applied
        console.log('Theme synced:', this.isDarkTheme ? 'dark' : 'light');

        // Add fast transitions after initial load for smooth toggling
        setTimeout(() => {
          this.enableFastTransitions();
        }, 100); // Small delay to ensure everything is rendered
      } catch (error) {
        console.error('Error reading theme preference:', error);
        // Fallback to dark theme
        this.isDarkTheme = true;
      }

      // Rest of your ngOnInit code...
      this.adminSessionService.isAuthenticated$
        .pipe(takeUntil(this.destroy$))
        .subscribe((isAuth) => {
          console.log('Admin authentication state changed:', isAuth);
          this.isAdminAuthenticated.set(isAuth);

          if (isAuth && this.pendingOperation) {
            console.log('Executing pending operation:', this.pendingOperation);
            setTimeout(() => {
              this.executePendingOperation();
            }, 100);
          }

          this.updateComponentAdminModes(isAuth);
          this.cdr.markForCheck();
        });

      this.setupScrollRestoration();
      this.setupSectionObserver();
    } else {
      // Server-side: default to dark theme
      this.isDarkTheme = true;
    }
  }

  ngAfterViewInit() {
    // FIXED: Mark components as ready after view init
    setTimeout(() => {
      if (this.experienceComponentRef) {
        this.experienceComponentReady.set(true);
        console.log('Experience component ready');
      }
      if (this.projectsComponentRef) {
        this.projectsComponentReady.set(true);
        console.log('Projects component ready');
      }
      if (this.skillsComponentRef) {
        this.skillsComponentReady.set(true);
        console.log('Skills component ready');
      }
      if (this.certificationsComponentRef) {
        this.certificationsComponentReady.set(true);
        console.log('Certifications component ready');
      }
      if (this.educationsComponentRef) {
        this.educationsComponentReady.set(true);
        console.log('Educations component ready');
      }
      if (this.awardsComponentRef) {
        this.awardsComponentReady.set(true);
        console.log('Awards component ready');
      }

      // Apply admin mode if already authenticated
      if (this.isAdminAuthenticated()) {
        this.updateComponentAdminModes(true);
      }
    }, 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
    }
  }

  /**
   * FIXED: Execute pending operation after authentication
   */
  private executePendingOperation() {
    if (!this.pendingOperation) return;

    const { section, operation } = this.pendingOperation;
    this.pendingOperation = null;

    console.log(`Executing pending operation: ${operation} on ${section}`);

    if (section === 'resume') {
      this.openResumeUploadModal();
      return;
    }

    // For other sections, ensure they're loaded and show operations
    this.selectedAdminSection.set(section);
    this.ensureSectionLoadedThenShowOperations(section);
  }

  /**
   * FIXED: Update admin modes in child components based on auth state
   */
  private updateComponentAdminModes(isAuthenticated: boolean) {
    console.log('Updating component admin modes:', isAuthenticated);

    if (isAuthenticated) {
      // Enable admin mode in ready components
      if (this.experienceComponentReady() && this.experienceComponentRef) {
        console.log('Enabling admin mode for experience component');
        this.experienceComponentRef.enableAdminMode();
      }
      if (this.projectsComponentReady() && this.projectsComponentRef) {
        console.log('Enabling admin mode for projects component');
        this.projectsComponentRef.enableAdminMode();
      }
      if (this.skillsComponentReady() && this.skillsComponentRef) {
        console.log('Enabling admin mode for skills component');
        this.skillsComponentRef.enableAdminMode();
      }
      if (
        this.certificationsComponentReady() &&
        this.certificationsComponentRef
      ) {
        console.log('Enabling admin mode for certifications component');
        this.certificationsComponentRef.enableAdminMode();
      }
      if (this.educationsComponentReady() && this.educationsComponentRef) {
        console.log('Enabling admin mode for educations component');
        this.educationsComponentRef.enableAdminMode();
      }
      if (this.awardsComponentReady() && this.awardsComponentRef) {
        console.log('Enabling admin mode for awards component');
        this.awardsComponentRef.enableAdminMode();
      }
    } else {
      // Disable admin mode in all components immediately
      if (this.experienceComponentRef) {
        this.experienceComponentRef.disableAdminMode();
      }
      if (this.projectsComponentRef) {
        this.projectsComponentRef.disableAdminMode();
      }
      if (this.skillsComponentRef) {
        this.skillsComponentRef.disableAdminMode();
      }
      if (this.certificationsComponentRef) {
        this.certificationsComponentRef.disableAdminMode();
      }
      if (this.educationsComponentRef) {
        this.educationsComponentRef.disableAdminMode();
      }
      if (this.awardsComponentRef) {
        this.awardsComponentRef.disableAdminMode();
      }
    }
  }

  // Add property for scroll optimization
  private scrollTimeout: number | null = null;

  // UPDATED: Optimized scroll restoration with fast transitions
  private setupScrollRestoration() {
    if (!this.isBrowser) return;

    // Always scroll to top on page load/reload with fast smooth behavior
    window.scrollTo({ top: 0, behavior: 'auto' }); // Use 'auto' for instant scroll on load

    // Listen to router navigation events
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Scroll to top on route changes with smooth behavior
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50); // Faster timeout for snappy navigation
      });

    // Force logout on page refresh for security
    window.addEventListener('beforeunload', () => {
      if (this.isAdminAuthenticated()) {
        console.log('Page refresh detected - logging out for security');
        this.adminSessionService.logout();
      }
      // Instant scroll to top on page unload
      window.scrollTo(0, 0);
    });

    // Additional fallback for scroll restoration with shorter timeout
    setTimeout(() => {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }, 200); // Reduced from 500ms for faster feel
  }

  // NEW: Optimized scroll to section with fast smooth scrolling
  scrollToSection(sectionId: string, event: Event) {
    event.preventDefault();

    this.isMobileMenuOpen = false;
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }

    // If scrolling to home, just go to top with fast smooth scroll
    if (sectionId === 'home') {
      if (this.isBrowser) {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
      return;
    }

    // Trigger loading of the section
    this.loadSection(sectionId);

    if (this.isBrowser) {
      // Use requestAnimationFrame for optimized scrolling
      requestAnimationFrame(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          const navbarHeight = 80;
          const elementPosition = element.offsetTop - navbarHeight;

          window.scrollTo({
            top: elementPosition,
            behavior: 'smooth',
          });
        }
      });
    }
    this.cdr.markForCheck();
  }

  // Lazy Loading Methods
  private setupSectionObserver() {
    if (!this.isBrowser) return;

    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            this.loadSection(sectionId);
          }
        });
      },
      {
        root: null,
        rootMargin: '200px', // Load 200px before visible
        threshold: 0.01,
      }
    );

    // Observe section anchors - wait for DOM to be ready
    setTimeout(() => {
      const experienceSection = document.getElementById('experience');
      const projectsSection = document.getElementById('projects');
      const skillsSection = document.getElementById('skills');
      const educationsSection = document.getElementById('educations');
      const awardsSection = document.getElementById('awards');

      if (experienceSection) {
        this.sectionObserver?.observe(experienceSection);
      }
      if (projectsSection) {
        this.sectionObserver?.observe(projectsSection);
      }
      if (skillsSection) {
        this.sectionObserver?.observe(skillsSection);
      }
      if (educationsSection) {
        this.sectionObserver?.observe(educationsSection);
      }
      if (awardsSection) {
        this.sectionObserver?.observe(awardsSection);
      }
    }, 100);
  }

  private async loadSection(sectionId: string) {
    if (sectionId === 'experience' && !this.experienceComponentLoaded()) {
      try {
        await this.loadExperiences();
        this.experienceComponentLoaded.set(true);

        // FIXED: Wait for component to be ready before setting admin mode
        setTimeout(() => {
          this.experienceComponentReady.set(true);
          if (this.isAdminAuthenticated() && this.experienceComponentRef) {
            this.experienceComponentRef.enableAdminMode();
          }
        }, 100);

        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading experience section:', error);
      }
    } else if (sectionId === 'projects' && !this.projectsComponentLoaded()) {
      try {
        await this.loadProjects();
        this.projectsComponentLoaded.set(true);

        // FIXED: Wait for component to be ready before setting admin mode
        setTimeout(() => {
          this.projectsComponentReady.set(true);
          if (this.isAdminAuthenticated() && this.projectsComponentRef) {
            this.projectsComponentRef.enableAdminMode();
          }
        }, 100);

        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading projects section:', error);
      }
    } else if (sectionId === 'skills' && !this.skillsComponentLoaded()) {
      try {
        await this.loadSkills();
        this.skillsComponentLoaded.set(true);

        // FIXED: Wait for component to be ready before setting admin mode
        setTimeout(() => {
          this.skillsComponentReady.set(true);
          if (this.isAdminAuthenticated() && this.skillsComponentRef) {
            this.skillsComponentRef.enableAdminMode();
          }
        }, 100);

        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading skills section:', error);
      }
    } else if (
      sectionId === 'certifications' &&
      !this.certificationsComponentLoaded()
    ) {
      try {
        await this.loadCertifications();
        this.certificationsComponentLoaded.set(true);

        setTimeout(() => {
          this.certificationsComponentReady.set(true);
          if (this.isAdminAuthenticated() && this.certificationsComponentRef) {
            this.certificationsComponentRef.enableAdminMode();
          }
        }, 100);

        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading certifications section:', error);
      }
    } else if (
      sectionId === 'educations' &&
      !this.educationsComponentLoaded()
    ) {
      try {
        await this.loadEducations();
        this.educationsComponentLoaded.set(true);
        setTimeout(() => {
          this.educationsComponentReady.set(true);
          if (this.isAdminAuthenticated() && this.educationsComponentRef) {
            this.educationsComponentRef.enableAdminMode();
          }
        }, 100);
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading educations section:', error);
      }
    } else if (sectionId === 'awards' && !this.awardsComponentLoaded()) {
      try {
        await this.loadAwards();
        this.awardsComponentLoaded.set(true);
        setTimeout(() => {
          this.awardsComponentReady.set(true);
          if (this.isAdminAuthenticated() && this.awardsComponentRef) {
            this.awardsComponentRef.enableAdminMode();
          }
        }, 100);
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading awards section:', error);
      }
    }
  }

  // Check if section should be displayed
  shouldShowExperience(): boolean {
    return this.experienceComponentLoaded();
  }

  shouldShowProjects(): boolean {
    return this.projectsComponentLoaded();
  }

  shouldShowSkills(): boolean {
    return this.skillsComponentLoaded();
  }

  shouldShowCertifications(): boolean {
    return this.certificationsComponentLoaded();
  }

  shouldShowEducations(): boolean {
    return this.educationsComponentLoaded();
  }

  shouldShowAwards(): boolean {
    return this.awardsComponentLoaded();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (this.isBrowser) {
      // Use requestAnimationFrame for smooth scrolling performance
      if (!this.scrollTimeout) {
        this.scrollTimeout = requestAnimationFrame(() => {
          this.isScrolled = window.scrollY > 50;
          this.cdr.markForCheck();
          this.scrollTimeout = null;
        });
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const adminDropdown = document.querySelector('.admin-dropdown-container');
    const adminButton = document.querySelector('.admin-toggle');

    if (
      adminDropdown &&
      adminButton &&
      !adminDropdown.contains(target) &&
      !adminButton.contains(target)
    ) {
      this.showAdminDropdown.set(false);
      this.cdr.markForCheck();
    }
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;

    if (this.isBrowser) {
      // Save preference
      localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    }

    // Apply theme with fast smooth transition
    this.applyThemeFast();
    this.cdr.markForCheck();
  }

  private applyTheme() {
    if (typeof document !== 'undefined') {
      const htmlElement = document.documentElement;

      if (this.isDarkTheme) {
        htmlElement.className = 'dark-theme';
        // Also update body classes for backward compatibility
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
      } else {
        htmlElement.className = 'light-theme';
        // Also update body classes for backward compatibility
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
      }
    }
  }

  // NEW: Fast theme application for smooth toggling
  private applyThemeFast() {
    if (typeof document !== 'undefined') {
      const htmlElement = document.documentElement;

      // Add transition class for smooth toggle
      document.body.classList.add('theme-transitioning');

      if (this.isDarkTheme) {
        htmlElement.className = 'dark-theme theme-transitioning';
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
      } else {
        htmlElement.className = 'light-theme theme-transitioning';
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
      }

      // Remove transition class after animation completes
      setTimeout(() => {
        document.body.classList.remove('theme-transitioning');
        htmlElement.classList.remove('theme-transitioning');
      }, 200); // Match transition duration
    }
  }

  // NEW: Enable fast transitions after initial load
  private enableFastTransitions() {
    if (typeof document !== 'undefined') {
      // Add transition classes to body for global fast transitions
      document.body.classList.add('fast-transitions');

      // Also add to specific elements that need fast transitions
      const elementsToSpeedUp = [
        '.navbar',
        '.logo',
        '.nav-links a',
        '.mobile-menu-btn',
        '.theme-toggle',
        '.admin-toggle',
        '.admin-icon',
        '.mobile-menu',
        '.mobile-nav-links a',
      ];

      elementsToSpeedUp.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          (element as HTMLElement).style.transition = 'all 0.2s ease';
        });
      });

      console.log('Fast transitions enabled for smooth UI');
    }
  }

  /**
   * Handle resume upload request with session check
   */
  handleResumeUploadRequest(event: Event) {
    event.stopPropagation();

    if (!this.isAdminAuthenticated()) {
      // FIXED: Set pending operation
      this.pendingOperation = { section: 'resume', operation: 'upload' };
      this.selectedAdminSection.set('resume');
      this.showAdminTokenModal.set(true);
      this.showAdminDropdown.set(false);
      this.adminToken = '';

      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
      }

      setTimeout(() => {
        const input = document.querySelector(
          '.admin-token-input'
        ) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    } else {
      this.openResumeUploadModal();
    }
    this.cdr.markForCheck();
  }

  /**
   * FIXED: Submit admin token using AdminSessionService with proper error handling
   */
  submitAdminToken() {
    if (this.adminToken.trim() === '') {
      alert('Please enter a token');
      return;
    }

    console.log('Attempting admin authentication...');

    // Use AdminSessionService for authentication
    const success = this.adminSessionService.authenticate(this.adminToken);

    if (success) {
      console.log('Admin authentication successful');
      this.closeAdminTokenModal();

      // The pending operation will be executed automatically via the subscription
      // in the ngOnInit method when isAuthenticated$ emits true
    } else {
      console.log('Admin authentication failed');
      alert('Invalid admin token');
      this.adminToken = '';

      setTimeout(() => {
        const input = document.querySelector(
          '.admin-token-input'
        ) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    }
  }

  /**
   * FIXED: Ensure section is loaded before showing operations modal
   */
  private async ensureSectionLoadedThenShowOperations(sectionId: string) {
    try {
      console.log('Ensuring section is loaded:', sectionId);

      // Load the section if not already loaded
      if (sectionId === 'experience' && !this.experienceComponentLoaded()) {
        await this.loadSection('experience');
        await this.waitForComponent('experience');
      } else if (sectionId === 'projects' && !this.projectsComponentLoaded()) {
        await this.loadSection('projects');
        await this.waitForComponent('projects');
      } else if (sectionId === 'skills' && !this.skillsComponentLoaded()) {
        await this.loadSection('skills');
        await this.waitForComponent('skills');
      } else if (
        sectionId === 'certifications' &&
        !this.certificationsComponentLoaded()
      ) {
        await this.loadSection('certifications');
        await this.waitForComponent('certifications');
      }

      // Now show the operations modal
      setTimeout(() => {
        this.showAdminOperationsModal.set(true);
        if (this.isBrowser) {
          document.body.style.overflow = 'hidden';
        }
        this.cdr.markForCheck();
      }, 200);
    } catch (error) {
      console.error('Error ensuring section is loaded:', error);
      alert(`Failed to load ${sectionId} section. Please try again.`);
    }
  }

  /**
   * FIXED: Wait for component to be properly initialized with admin mode
   */
  private async waitForComponent(sectionId: string): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // 3 seconds max wait

      const checkComponent = () => {
        attempts++;

        let componentReady = false;

        if (sectionId === 'experience' && this.experienceComponentReady()) {
          componentReady = true;
        } else if (sectionId === 'projects' && this.projectsComponentReady()) {
          componentReady = true;
        } else if (sectionId === 'skills' && this.skillsComponentReady()) {
          componentReady = true;
        } else if (
          sectionId === 'certifications' &&
          this.certificationsComponentReady()
        ) {
          componentReady = true;
        } else if (
          sectionId === 'educations' &&
          this.educationsComponentReady()
        ) {
          componentReady = true;
        } else if (sectionId === 'awards' && this.awardsComponentReady()) {
          componentReady = true;
        }

        if (componentReady || attempts >= maxAttempts) {
          console.log(
            `Component ${sectionId} ready after ${attempts} attempts`
          );
          resolve();
        } else {
          setTimeout(checkComponent, 100);
        }
      };

      checkComponent();
    });
  }

  /**
   * FIXED: Logout admin using AdminSessionService
   */
  logoutAdmin() {
    console.log('Logging out admin...');
    this.adminSessionService.logout();
    this.showAdminDropdown.set(false);
    // Clear any pending operations
    this.pendingOperation = null;
    this.cdr.markForCheck();
  }

  // Resume Upload Methods (unchanged)
  openResumeUploadModal() {
    this.showResumeUploadModal.set(true);
    this.showAdminDropdown.set(false);
    this.resetUploadState();
    this.loadExistingResumes();

    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
  }

  closeResumeUploadModal() {
    this.showResumeUploadModal.set(false);
    this.resetUploadState();

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  private resetUploadState() {
    this.selectedFile = null;
    this.isDragOver = false;
    this.isUploading.set(false);
    this.uploadProgress.set(0);
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.resumeUploaded.set(false);
  }

  async loadExistingResumes() {
    try {
      const resumes = await this.resumeService.getAllResumes();
      this.existingResumes.set(resumes);
      this.cdr.markForCheck();
    } catch (error: any) {
      console.error('Error loading resumes:', error);
      if (error.message.includes('Unauthorized')) {
        this.uploadError.set('Unauthorized access. Please re-authenticate.');
        // Force logout if unauthorized
        this.adminSessionService.forceLogout('Authentication expired');
      }
    }
  }

  // Drag and Drop handlers (unchanged)
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
    this.cdr.markForCheck();
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    this.cdr.markForCheck();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
    this.cdr.markForCheck();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileSelection(input.files[0]);
    }
  }

  private handleFileSelection(file: File) {
    // Reset previous errors
    this.uploadError.set('');
    this.uploadSuccess.set('');

    // Validate file
    const validationError = this.resumeService.validateFile(file);
    if (validationError) {
      this.uploadError.set(validationError);
      this.selectedFile = null;
      this.cdr.markForCheck();
      return;
    }

    this.selectedFile = file;
    this.cdr.markForCheck();
  }

  removeSelectedFile() {
    this.selectedFile = null;
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.cdr.markForCheck();
  }

  uploadResume() {
    if (!this.selectedFile) {
      this.uploadError.set('Please select a file to upload');
      return;
    }

    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set('');
    this.uploadSuccess.set('');

    this.resumeService.uploadResume(this.selectedFile).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total
            ? Math.round((100 * event.loaded) / event.total)
            : 0;
          this.uploadProgress.set(progress);
        } else if (event.type === HttpEventType.Response) {
          // Upload completed
          this.isUploading.set(false);
          this.uploadProgress.set(100);

          if (event.body.success) {
            this.uploadSuccess.set(
              event.body.message || 'Resume uploaded successfully!'
            );
            this.resumeUploaded.set(true);
            this.selectedFile = null;

            // Reload the resumes list
            this.loadExistingResumes();

            // Clear success message after 3 seconds
            setTimeout(() => {
              this.uploadSuccess.set('');
              this.resumeUploaded.set(false);
              this.cdr.markForCheck();
            }, 3000);
          } else {
            this.uploadError.set(event.body.message || 'Upload failed');
          }
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Upload error:', error);
        this.isUploading.set(false);
        this.uploadProgress.set(0);

        let errorMessage = 'Failed to upload resume. ';
        if (error.status === 401) {
          errorMessage += 'Unauthorized access.';
        } else if (error.status === 413) {
          errorMessage += 'File size too large.';
        } else if (error.status === 415) {
          errorMessage += 'Unsupported file type.';
        } else if (error.error && error.error.message) {
          errorMessage += error.error.message;
        } else {
          errorMessage += 'Please try again.';
        }

        this.uploadError.set(errorMessage);
        this.cdr.markForCheck();
      },
    });
  }

  async setActiveResume(resumeId: number) {
    try {
      await this.resumeService.setActiveResume(resumeId);
      this.uploadSuccess.set('Resume set as active successfully!');
      await this.loadExistingResumes();

      // Clear success message after 3 seconds
      setTimeout(() => {
        this.uploadSuccess.set('');
        this.cdr.markForCheck();
      }, 3000);
    } catch (error: any) {
      console.error('Error setting active resume:', error);
      this.uploadError.set(error.message || 'Failed to set active resume');
    }
    this.cdr.markForCheck();
  }

  async deleteResume(resumeId: number, fileName: string) {
    const confirmDelete = confirm(
      `Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`
    );

    if (confirmDelete) {
      try {
        await this.resumeService.deleteResume(resumeId);
        this.uploadSuccess.set('Resume deleted successfully!');
        await this.loadExistingResumes();

        // Clear success message after 3 seconds
        setTimeout(() => {
          this.uploadSuccess.set('');
          this.cdr.markForCheck();
        }, 3000);
      } catch (error: any) {
        console.error('Error deleting resume:', error);
        this.uploadError.set(error.message || 'Failed to delete resume');
      }
      this.cdr.markForCheck();
    }
  }

  previewResume(resumeId: number) {
    this.resumeService.previewResume(resumeId);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  formatUploadDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  }

  async downloadResume() {
    if (this.isBrowser) {
      try {
        // Check if resume is available
        const downloadInfo = await this.resumeService.getResumeDownloadInfo();

        if (downloadInfo.available) {
          // Resume is available, proceed with download
          this.resumeService.downloadResume();
        } else {
          // Resume not available, show message
          alert(
            downloadInfo.message ||
              'No resume is currently available for download. Please contact the administrator.'
          );
        }
      } catch (error) {
        console.error('Error checking resume availability:', error);
        alert(
          'Unable to download resume at this time. Please try again later.'
        );
      }
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;

    if (this.isBrowser) {
      document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : 'auto';
    }
    this.cdr.markForCheck();
  }

  // scrollToSection(sectionId: string, event: Event) {
  //   event.preventDefault();

  //   this.isMobileMenuOpen = false;
  //   if (this.isBrowser) {
  //     document.body.style.overflow = 'auto';
  //   }

  //   // If scrolling to home, just go to top
  //   if (sectionId === 'home') {
  //     if (this.isBrowser) {
  //       window.scrollTo({
  //         top: 0,
  //         behavior: 'smooth',
  //       });
  //     }
  //     return;
  //   }

  //   // Trigger loading of the section
  //   this.loadSection(sectionId);

  //   if (this.isBrowser) {
  //     const element = document.getElementById(sectionId);
  //     if (element) {
  //       const navbarHeight = 80;
  //       const elementPosition = element.offsetTop - navbarHeight;

  //       window.scrollTo({
  //         top: elementPosition,
  //         behavior: 'smooth',
  //       });
  //     }
  //   }
  //   this.cdr.markForCheck();
  // }

  // Admin functionality methods
  toggleAdminDropdown(event: Event) {
    event.stopPropagation();
    this.showAdminDropdown.update((show) => !show);
    this.cdr.markForCheck();
  }

  /**
   * FIXED: Handle admin section selection with proper loading and pending operation tracking
   */
  selectAdminSection(sectionId: string, event: Event) {
    event.stopPropagation();

    console.log('Admin section selected:', sectionId);

    if (!this.isAdminAuthenticated()) {
      // FIXED: User not authenticated - set pending operation and show token modal
      this.pendingOperation = { section: sectionId, operation: 'select' };
      this.selectedAdminSection.set(sectionId);
      this.showAdminTokenModal.set(true);
      this.showAdminDropdown.set(false);
      this.adminToken = '';

      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
      }

      setTimeout(() => {
        const input = document.querySelector(
          '.admin-token-input'
        ) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    } else {
      // User is authenticated - ensure section is loaded and show operations
      this.selectedAdminSection.set(sectionId);
      this.showAdminDropdown.set(false);

      // Ensure section is loaded before showing operations
      this.ensureSectionLoadedThenShowOperations(sectionId);
    }
    this.cdr.markForCheck();
  }

  closeAdminTokenModal() {
    this.showAdminTokenModal.set(false);
    this.selectedAdminSection.set('');
    this.adminToken = '';
    // FIXED: Clear pending operation if modal is closed
    this.pendingOperation = null;

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  closeAdminOperationsModal() {
    this.showAdminOperationsModal.set(false);
    this.selectedAdminSection.set('');

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  /**
   * FIXED: Handle operation selection with proper component initialization and better error handling
   */
  selectOperation(operationId: string) {
    console.log('Operation selected:', operationId);

    this.selectedOperation.set(operationId);
    const sectionId = this.selectedAdminSection();

    this.closeAdminOperationsModal();

    // FIXED: Validate section ID
    if (!sectionId) {
      console.error('No section selected for operation');
      alert('No section selected. Please try again.');
      return;
    }

    // FIXED: Add proper delay and error handling for component readiness
    setTimeout(async () => {
      try {
        if (sectionId === 'experience') {
          await this.handleExperienceOperation(operationId);
        } else if (sectionId === 'projects') {
          await this.handleProjectsOperation(operationId);
        } else if (sectionId === 'skills') {
          await this.handleSkillsOperation(operationId);
        } else if (sectionId === 'certifications') {
          await this.handleCertificationsOperation(operationId);
        } else if (sectionId === 'educations') {
          await this.handleEducationsOperation(operationId);
        } else if (sectionId === 'awards') {
          await this.handleAwardsOperation(operationId);
        } else {
          console.warn(`Unknown section: ${sectionId}`);
          alert(`${sectionId} operations are not yet implemented`);
        }
      } catch (error) {
        console.error(`Error handling ${sectionId} operation:`, error);
        alert(`Failed to ${operationId} ${sectionId}. Please try again.`);
      }
    }, 150);
  }

  /**
   * FIXED: Handle experience operations with proper component checking and error handling
   */
  private async handleExperienceOperation(operationId: string) {
    console.log('Handling experience operation:', operationId);

    // Ensure section is loaded first
    if (!this.experienceComponentLoaded()) {
      console.log('Loading experience section...');
      await this.loadSection('experience');
    }

    // Wait for component to be ready
    await this.waitForComponent('experience');

    // FIXED: Ensure component reference exists and is ready
    if (!this.experienceComponentRef) {
      console.error('Experience component reference not available');
      alert('Experience component is not ready. Please try again.');
      return;
    }

    // Ensure admin mode is enabled
    this.experienceComponentRef.enableAdminMode();

    if (operationId === 'create') {
      console.log('Opening experience create form');
      setTimeout(() => {
        this.experienceComponentRef.openForm();
      }, 100);
    } else if (operationId === 'update' || operationId === 'delete') {
      try {
        await this.loadExperiences();

        if (this.experiences().length === 0) {
          alert('No experiences available to ' + operationId);
          return;
        }

        this.showExperienceSelectionModal.set(true);

        if (this.isBrowser) {
          document.body.style.overflow = 'hidden';
        }
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading experiences:', error);
        alert('Failed to load experiences');
      }
    }
  }

  /**
   * FIXED: Handle projects operations with proper component checking and error handling
   */
  private async handleProjectsOperation(operationId: string) {
    console.log('Handling projects operation:', operationId);

    // Ensure section is loaded first
    if (!this.projectsComponentLoaded()) {
      console.log('Loading projects section...');
      await this.loadSection('projects');
    }

    // Wait for component to be ready
    await this.waitForComponent('projects');

    // FIXED: Ensure component reference exists and is ready
    if (!this.projectsComponentRef) {
      console.error('Projects component reference not available');
      alert('Projects component is not ready. Please try again.');
      return;
    }

    // Ensure admin mode is enabled
    this.projectsComponentRef.enableAdminMode();

    if (operationId === 'create') {
      console.log('Opening projects create form');
      setTimeout(() => {
        this.projectsComponentRef.handleCreateOperation();
      }, 100);
    } else if (operationId === 'update' || operationId === 'delete') {
      try {
        await this.loadProjects();

        if (this.projects().length === 0) {
          alert('No projects available to ' + operationId);
          return;
        }

        this.showProjectSelectionModal.set(true);

        if (this.isBrowser) {
          document.body.style.overflow = 'hidden';
        }
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading projects:', error);
        alert('Failed to load projects');
      }
    }
  }

  /**
   * FIXED: Handle skills operations with proper component checking and error handling
   */
  private async handleSkillsOperation(operationId: string) {
    console.log('Handling skills operation:', operationId);

    // Ensure section is loaded first
    if (!this.skillsComponentLoaded()) {
      console.log('Loading skills section...');
      await this.loadSection('skills');
    }

    // Wait for component to be ready
    await this.waitForComponent('skills');

    // FIXED: Ensure component reference exists and is ready
    if (!this.skillsComponentRef) {
      console.error('Skills component reference not available');
      alert('Skills component is not ready. Please try again.');
      return;
    }

    // Ensure admin mode is enabled
    this.skillsComponentRef.enableAdminMode();

    if (operationId === 'create') {
      console.log('Opening skills create form');
      setTimeout(() => {
        this.skillsComponentRef.handleCreateOperation();
      }, 100);
    } else if (operationId === 'update' || operationId === 'delete') {
      try {
        await this.loadSkills();

        if (this.skills().length === 0) {
          alert('No skills available to ' + operationId);
          return;
        }

        this.showSkillSelectionModal.set(true);
        this.selectedOperation.set(operationId);

        if (this.isBrowser) {
          document.body.style.overflow = 'hidden';
        }
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading skills:', error);
        alert('Failed to load skills');
      }
    }
  }

  /**
   * FIXED: Handle certifications operations with proper component checking and error handling
   */
  private async handleCertificationsOperation(operationId: string) {
    console.log('Handling certifications operation:', operationId);

    if (!this.certificationsComponentLoaded()) {
      console.log('Loading certifications section...');
      await this.loadSection('certifications');
    }

    await this.waitForComponent('certifications');

    if (!this.certificationsComponentRef) {
      console.error('Certifications component reference not available');
      alert('Certifications component is not ready. Please try again.');
      return;
    }

    this.certificationsComponentRef.enableAdminMode();

    if (operationId === 'create') {
      console.log('Opening certifications create form');
      setTimeout(() => {
        this.certificationsComponentRef.handleCreateOperation();
      }, 100);
    } else if (operationId === 'update' || operationId === 'delete') {
      try {
        await this.loadCertifications();

        if (this.certifications().length === 0) {
          alert('No certifications available to ' + operationId);
          return;
        }

        this.showCertificationSelectionModal.set(true);
        this.selectedOperation.set(operationId);

        if (this.isBrowser) {
          document.body.style.overflow = 'hidden';
        }
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading certifications:', error);
        alert('Failed to load certifications');
      }
    }
  }

  private async handleEducationsOperation(operationId: string) {
    console.log('Handling educations operation:', operationId);

    // Ensure section is loaded first
    if (!this.educationsComponentLoaded()) {
      console.log('Loading educations section...');
      await this.loadSection('educations');
    }

    // Wait for component to be ready
    await this.waitForComponent('educations');

    // Ensure component reference exists and is ready
    if (!this.educationsComponentRef) {
      console.error('Educations component reference not available');
      alert('Educations component is not ready. Please try again.');
      return;
    }

    // Ensure admin mode is enabled
    this.educationsComponentRef.enableAdminMode();

    if (operationId === 'create') {
      console.log('Opening educations create form');
      setTimeout(() => {
        this.educationsComponentRef.handleCreateOperation();
      }, 100);
    } else if (operationId === 'update' || operationId === 'delete') {
      try {
        await this.loadEducations();

        if (this.educations().length === 0) {
          alert('No educations available to ' + operationId);
          return;
        }

        this.showEducationSelectionModal.set(true);
        this.selectedOperation.set(operationId);

        if (this.isBrowser) {
          document.body.style.overflow = 'hidden';
        }
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading educations:', error);
        alert('Failed to load educations');
      }
    }
  }

  // Add handleAwardsOperation method:
  private async handleAwardsOperation(operationId: string) {
    console.log('Handling awards operation:', operationId);

    if (!this.awardsComponentLoaded()) {
      console.log('Loading awards section...');
      await this.loadSection('awards');
    }

    await this.waitForComponent('awards');

    if (!this.awardsComponentRef) {
      console.error('Awards component reference not available');
      alert('Awards component is not ready. Please try again.');
      return;
    }

    this.awardsComponentRef.enableAdminMode();

    if (operationId === 'create') {
      console.log('Opening awards create form');
      setTimeout(() => {
        this.awardsComponentRef.handleCreateOperation();
      }, 100);
    } else if (operationId === 'update' || operationId === 'delete') {
      try {
        await this.loadAwards();

        if (this.awards().length === 0) {
          alert('No awards available to ' + operationId);
          return;
        }

        this.showAwardSelectionModal.set(true);
        this.selectedOperation.set(operationId);

        if (this.isBrowser) {
          document.body.style.overflow = 'hidden';
        }
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading awards:', error);
        alert('Failed to load awards');
      }
    }
  }

  closeExperienceSelectionModal() {
    this.showExperienceSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedExperienceId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  closeProjectSelectionModal() {
    this.showProjectSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedProjectId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  closeSkillSelectionModal() {
    this.showSkillSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedSkillId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  closeCertificationSelectionModal() {
    this.showCertificationSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedCertificationId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  closeEducationSelectionModal() {
    this.showEducationSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedEducationId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  closeAwardSelectionModal() {
    this.showAwardSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedAwardId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  selectExperience(experienceId: number) {
    this.selectedExperienceId.set(experienceId);
    const operation = this.selectedOperation();

    this.closeExperienceSelectionModal();

    const experience = this.experiences().find(
      (exp) => exp.id === experienceId
    );
    if (!experience) {
      alert('Experience not found');
      return;
    }

    if (operation === 'update') {
      this.updateExperience(experienceId);
    } else if (operation === 'delete') {
      this.deleteExperience(experienceId);
    }
  }

  selectProject(projectId: number) {
    this.selectedProjectId.set(projectId);
    const operation = this.selectedOperation();

    this.closeProjectSelectionModal();

    const project = this.projects().find((proj) => proj.id === projectId);
    if (!project) {
      alert('Project not found');
      return;
    }

    if (operation === 'update') {
      this.updateProject(projectId);
    } else if (operation === 'delete') {
      this.deleteProject(projectId);
    }
  }

  selectSkill(skillId: number) {
    this.selectedSkillId.set(skillId);
    const operation = this.selectedOperation();

    this.closeSkillSelectionModal();

    const skill = this.skills().find((s) => s.id === skillId);
    if (!skill) {
      alert('Skill not found');
      return;
    }

    if (operation === 'update') {
      this.updateSkill(skillId);
    } else if (operation === 'delete') {
      this.deleteSkill(skillId);
    }
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
      this.updateCertification(certificationId);
    } else if (operation === 'delete') {
      this.deleteCertification(certificationId);
    }
  }

  selectEducation(educationId: number) {
    this.selectedEducationId.set(educationId);
    const operation = this.selectedOperation();

    this.closeEducationSelectionModal();

    const education = this.educations().find((e) => e.id === educationId);
    if (!education) {
      alert('Education not found');
      return;
    }

    if (operation === 'update') {
      this.updateEducation(educationId);
    } else if (operation === 'delete') {
      this.deleteEducation(educationId);
    }
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
      this.updateAward(awardId);
    } else if (operation === 'delete') {
      this.deleteAward(awardId);
    }
  }

  private updateExperience(experienceId: number) {
    const experience = this.experiences().find(
      (exp) => exp.id === experienceId
    );
    if (experience) {
      if (this.experienceComponentRef) {
        this.experienceComponentRef.enableAdminMode();
        setTimeout(() => {
          this.experienceComponentRef.openForm(experience);
        }, 100);
      } else {
        alert('Experience component not loaded');
      }
    } else {
      alert('Experience not found');
    }
  }

  private updateProject(projectId: number) {
    const project = this.projects().find((proj) => proj.id === projectId);
    if (project) {
      if (this.projectsComponentRef) {
        this.projectsComponentRef.enableAdminMode();
        setTimeout(() => {
          this.projectsComponentRef.handleProjectSelection(projectId, 'update');
        }, 100);
      } else {
        alert('Projects component not loaded');
      }
    } else {
      alert('Project not found');
    }
  }

  private updateSkill(skillId: number) {
    const skill = this.skills().find((s) => s.id === skillId);
    if (skill) {
      if (this.skillsComponentRef) {
        this.skillsComponentRef.enableAdminMode();
        setTimeout(() => {
          this.skillsComponentRef.openForm(skill);
        }, 100);
      } else {
        alert('Skills component not loaded');
      }
    } else {
      alert('Skill not found');
    }
  }

  private updateCertification(certificationId: number) {
    const certification = this.certifications().find(
      (c) => c.id === certificationId
    );
    if (certification) {
      if (this.certificationsComponentRef) {
        this.certificationsComponentRef.enableAdminMode();
        setTimeout(() => {
          this.certificationsComponentRef.handleCertificationSelection(
            certificationId,
            'update'
          );
        }, 100);
      } else {
        alert('Certifications component not loaded');
      }
    } else {
      alert('Certification not found');
    }
  }

  private updateEducation(educationId: number) {
    const education = this.educations().find((e) => e.id === educationId);
    if (education) {
      if (this.educationsComponentRef) {
        this.educationsComponentRef.enableAdminMode();
        setTimeout(() => {
          this.educationsComponentRef.handleEducationSelection(
            educationId,
            'update'
          );
        }, 100);
      } else {
        alert('Educations component not loaded');
      }
    } else {
      alert('Education not found');
    }
  }

  private updateAward(awardId: number) {
    const award = this.awards().find((a) => a.id === awardId);
    if (award) {
      if (this.awardsComponentRef) {
        this.awardsComponentRef.enableAdminMode();
        setTimeout(() => {
          this.awardsComponentRef.handleAwardSelection(awardId, 'update');
        }, 100);
      } else {
        alert('Awards component not loaded');
      }
    } else {
      alert('Award not found');
    }
  }

  private async deleteExperience(experienceId: number) {
    const experience = this.experiences().find(
      (exp) => exp.id === experienceId
    );
    if (experience) {
      const confirmMessage = `Are you sure you want to delete the experience at "${experience.companyName}"?\n\nThis action cannot be undone.`;
      const confirmDelete = confirm(confirmMessage);

      if (confirmDelete) {
        try {
          await this.experienceService.deleteExperience(experienceId);

          await this.loadExperiences();

          if (this.experienceComponentRef) {
            await this.experienceComponentRef.refreshExperiences();
          }

          alert('Experience deleted successfully!');
        } catch (error: any) {
          console.error('Delete error:', error);
          alert(error.message || 'Failed to delete experience');
        }
      }
    } else {
      alert('Experience not found');
    }
  }

  private async deleteProject(projectId: number) {
    const project = this.projects().find((proj) => proj.id === projectId);
    if (project) {
      const confirmMessage = `Are you sure you want to delete the project "${project.title}"?\n\nThis action cannot be undone.`;
      const confirmDelete = confirm(confirmMessage);

      if (confirmDelete) {
        try {
          await this.projectService.deleteProject(projectId);

          await this.loadProjects();

          if (this.projectsComponentRef) {
            await this.projectsComponentRef.refreshProjects();
          }

          alert('Project deleted successfully!');
        } catch (error: any) {
          console.error('Delete project error:', error);
          alert(error.message || 'Failed to delete project');
        }
      }
    } else {
      alert('Project not found');
    }
  }

  private async deleteSkill(skillId: number) {
    const skill = this.skills().find((s) => s.id === skillId);
    if (skill) {
      const confirmMessage = `Are you sure you want to delete the skill "${skill.name}"?\n\nThis action cannot be undone.`;
      const confirmDelete = confirm(confirmMessage);

      if (confirmDelete) {
        try {
          await this.skillService.deleteSkill(skillId);

          await this.loadSkills();

          if (this.skillsComponentRef) {
            await this.skillsComponentRef.refreshSkills();
          }

          alert('Skill deleted successfully!');
        } catch (error: any) {
          console.error('Delete skill error:', error);
          alert(error.message || 'Failed to delete skill');
        }
      }
    } else {
      alert('Skill not found');
    }
  }

  private async deleteEducation(educationId: number) {
    const education = this.educations().find((e) => e.id === educationId);
    if (education) {
      const confirmMessage = `Are you sure you want to delete the education "${education.degree}"?\n\nThis action cannot be undone.`;
      const confirmDelete = confirm(confirmMessage);

      if (confirmDelete) {
        try {
          await this.educationService.deleteEducation(educationId);

          await this.loadEducations();

          if (this.educationsComponentRef) {
            await this.educationsComponentRef.refreshEducations();
          }

          alert('Education deleted successfully!');
        } catch (error: any) {
          console.error('Delete education error:', error);
          alert(error.message || 'Failed to delete education');
        }
      }
    } else {
      alert('Education not found');
    }
  }

  private async deleteCertification(certificationId: number) {
    const certification = this.certifications().find(
      (c) => c.id === certificationId
    );
    if (certification) {
      const confirmMessage = `Are you sure you want to delete the certification "${certification.title}"?\n\nThis action cannot be undone.`;
      const confirmDelete = confirm(confirmMessage);

      if (confirmDelete) {
        try {
          await this.certificationService.deleteCertification(certificationId);
          await this.loadCertifications();

          if (this.certificationsComponentRef) {
            await this.certificationsComponentRef.refreshCertifications();
          }

          alert('Certification deleted successfully!');
        } catch (error: any) {
          console.error('Delete certification error:', error);
          alert(error.message || 'Failed to delete certification');
        }
      }
    } else {
      alert('Certification not found');
    }
  }

  private async deleteAward(awardId: number) {
    const award = this.awards().find((a) => a.id === awardId);
    if (award) {
      const confirmMessage = `Are you sure you want to delete the award "${award.awardName}"?\n\nThis action cannot be undone.`;
      const confirmDelete = confirm(confirmMessage);

      if (confirmDelete) {
        try {
          await this.awardService.deleteAward(awardId);
          await this.loadAwards();

          if (this.awardsComponentRef) {
            await this.awardsComponentRef.refreshAwards();
          }

          alert('Award deleted successfully!');
        } catch (error: any) {
          console.error('Delete award error:', error);
          alert(error.message || 'Failed to delete award');
        }
      }
    } else {
      alert('Award not found');
    }
  }

  private async loadExperiences() {
    try {
      const experiences = await this.experienceService.getAllExperiences();
      experiences.sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      this.experiences.set(experiences);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading experiences in app component:', error);
      this.experiences.set([]);
      this.cdr.markForCheck();
    }
  }

  private async loadProjects() {
    try {
      const projects = await this.projectService.getAllProjects();
      projects.sort((a, b) => b.id - a.id);
      this.projects.set(projects);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading projects in app component:', error);
      this.projects.set([]);
      this.cdr.markForCheck();
    }
  }

  private async loadSkills() {
    try {
      const skills = await this.skillService.getAllSkills();
      skills.sort((a, b) => b.proficiency - a.proficiency);
      this.skills.set(skills);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading skills in app component:', error);
      this.skills.set([]);
      this.cdr.markForCheck();
    }
  }

  private async loadCertifications() {
    try {
      const certifications =
        await this.certificationService.getAllCertifications();
      certifications.sort((a, b) => b.id - a.id);
      this.certifications.set(certifications);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading certifications in app component:', error);
      this.certifications.set([]);
      this.cdr.markForCheck();
    }
  }

  private async loadEducations() {
    try {
      const educations = await this.educationService.getAllEducations();
      educations.sort((a, b) => b.id - a.id);
      this.educations.set(educations);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading educations in app component:', error);
      this.educations.set([]);
      this.cdr.markForCheck();
    }
  }

  private async loadAwards() {
    try {
      const awards = await this.awardService.getAllAwards();
      awards.sort((a, b) => b.id - a.id);
      this.awards.set(awards);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading awards in app component:', error);
      this.awards.set([]);
      this.cdr.markForCheck();
    }
  }
}
