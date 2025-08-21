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
  ViewChild
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from './services/config.service';
import { ExperienceService } from './services/experience.service';
import { ProjectService } from './services/project.service';
import { Experience } from './model/experience.model';
import { Project } from './model/project.model';
import { ExperienceComponent } from './experience/experience';
import { ProjectsComponent } from './projects/projects';

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
  imports: [CommonModule, FormsModule, ExperienceComponent, ProjectsComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild(ExperienceComponent) experienceComponentRef!: ExperienceComponent;
  @ViewChild(ProjectsComponent) projectsComponentRef!: ProjectsComponent;
  private cdr = inject(ChangeDetectorRef);
  private configService = inject(ConfigService);
  private experienceService = inject(ExperienceService);
  private projectService = inject(ProjectService);

  title = 'Portfolio-UI';
  isDarkTheme = true;
  isScrolled = false;
  isMobileMenuOpen = false;
  
  // Lazy loading state
  experienceComponentLoaded = signal(false);
  projectsComponentLoaded = signal(false);
  
  // Admin-related properties
  showAdminDropdown = signal(false);
  isAdminAuthenticated = signal(false);
  showAdminTokenModal = signal(false);
  showAdminOperationsModal = signal(false);
  showExperienceSelectionModal = signal(false);
  showProjectSelectionModal = signal(false);
  selectedAdminSection = signal<string>('');
  selectedOperation = signal<string>('');
  adminToken = '';
  
  // Experience-related properties
  experiences = signal<Experience[]>([]);
  selectedExperienceId = signal<number | null>(null);

  // Project-related properties
  projects = signal<Project[]>([]);
  selectedProjectId = signal<number | null>(null);

  // Intersection Observer for lazy loading
  private sectionObserver?: IntersectionObserver;
  private isBrowser: boolean;

  adminSections: AdminSection[] = [
    { id: 'experience', label: 'Experience', enabled: true },
    { id: 'projects', label: 'Projects', enabled: true },
    { id: 'certifications', label: 'Certifications', enabled: false },
    { id: 'educations', label: 'Educations', enabled: false },
    { id: 'awards', label: 'Awards', enabled: false }
  ];

  adminOperations: AdminOperation[] = [
    { id: 'create', label: 'Create New', icon: 'fa-plus' },
    { id: 'update', label: 'Update Existing', icon: 'fa-edit' },
    { id: 'delete', label: 'Delete Existing', icon: 'fa-trash' }
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

    ngOnInit() {
    // FIXED: Set dark theme as default immediately
    this.isDarkTheme = true;

    if (this.isBrowser) {
      // Check saved theme preference
      const savedTheme = localStorage.getItem('theme');
      
      // If user previously selected light theme, switch to it
      if (savedTheme === 'light') {
        this.isDarkTheme = false;
      }
      // Otherwise keep dark theme (default)
      
      // Check if user is already authenticated as admin
      const savedAdminToken = localStorage.getItem('adminToken');
      if (savedAdminToken === this.configService.adminToken) {
        this.isAdminAuthenticated.set(true);
      }

      // Setup lazy loading observer
      this.setupSectionObserver();
    }

    // Apply theme immediately
    this.applyTheme();
    // Don't load data on init - wait for lazy loading
  }

  ngOnDestroy() {
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
    }
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
        threshold: 0.01
      }
    );

    // Observe section anchors - wait for DOM to be ready
    setTimeout(() => {
      const experienceSection = document.getElementById('experience');
      const projectsSection = document.getElementById('projects');
      
      if (experienceSection) {
        this.sectionObserver?.observe(experienceSection);
      }
      if (projectsSection) {
        this.sectionObserver?.observe(projectsSection);
      }
    }, 100);
  }

  private async loadSection(sectionId: string) {
    if (sectionId === 'experience' && !this.experienceComponentLoaded()) {
      try {
        // Load data first
        await this.loadExperiences();
        this.experienceComponentLoaded.set(true);
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading experience section:', error);
      }
    } else if (sectionId === 'projects' && !this.projectsComponentLoaded()) {
      try {
        // Load data first
        await this.loadProjects();
        this.projectsComponentLoaded.set(true);
        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading projects section:', error);
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

  @HostListener('window:scroll')
  onWindowScroll() {
    if (this.isBrowser) {
      this.isScrolled = window.scrollY > 50;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const adminDropdown = document.querySelector('.admin-dropdown-container');
    const adminButton = document.querySelector('.admin-toggle');
    
    if (adminDropdown && adminButton && 
        !adminDropdown.contains(target) && 
        !adminButton.contains(target)) {
      this.showAdminDropdown.set(false);
      this.cdr.markForCheck();
    }
  }

    toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;

    if (this.isBrowser) {
      localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    }

    this.applyTheme();
    this.cdr.markForCheck();
  }

   private applyTheme() {
    if (typeof document !== 'undefined') {
      // FIXED: Use specific theme classes for smooth transitions
      if (this.isDarkTheme) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
      }
    }
  }

  downloadResume() {
    if (this.isBrowser) {
      const resumePath = 'assets/resume/Resume_Yugantar_Badhan.pdf';
      const link = document.createElement('a');
      link.href = resumePath;
      link.download = 'Resume_Yugantar_Badhan.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    
    if (this.isBrowser) {
      document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : 'auto';
    }
    this.cdr.markForCheck();
  }

  scrollToSection(sectionId: string, event: Event) {
    event.preventDefault();

    this.isMobileMenuOpen = false;
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }

    // Trigger loading of the section
    this.loadSection(sectionId);

    if (this.isBrowser) {
      const element = document.getElementById(sectionId);
      if (element) {
        const navbarHeight = 80;
        const elementPosition = element.offsetTop - navbarHeight;
        
        window.scrollTo({
          top: elementPosition,
          behavior: 'smooth'
        });
      }
    }
    this.cdr.markForCheck();
  }

  // Admin functionality methods
  toggleAdminDropdown(event: Event) {
    event.stopPropagation();
    this.showAdminDropdown.update(show => !show);
    this.cdr.markForCheck();
  }

  selectAdminSection(sectionId: string, event: Event) {
    event.stopPropagation();
    
    if (!this.isAdminAuthenticated()) {
      this.selectedAdminSection.set(sectionId);
      this.showAdminTokenModal.set(true);
      this.showAdminDropdown.set(false);
      this.adminToken = '';
      
      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
      }
      
      setTimeout(() => {
        const input = document.querySelector('.admin-token-input') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    } else {
      this.selectedAdminSection.set(sectionId);
      this.showAdminOperationsModal.set(true);
      this.showAdminDropdown.set(false);
      
      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
      }
    }
    this.cdr.markForCheck();
  }

  closeAdminTokenModal() {
    this.showAdminTokenModal.set(false);
    this.selectedAdminSection.set('');
    this.adminToken = '';
    
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  submitAdminToken() {
    if (this.adminToken.trim() === '') {
      alert('Please enter a token');
      return;
    }
    
    if (this.adminToken === this.configService.adminToken) {
      this.isAdminAuthenticated.set(true);
      
      if (this.isBrowser) {
        localStorage.setItem('adminToken', this.adminToken);
      }
      
      const sectionId = this.selectedAdminSection();
      this.closeAdminTokenModal();
      
      setTimeout(() => {
        this.showAdminOperationsModal.set(true);
        if (this.isBrowser) {
          document.body.style.overflow = 'hidden';
        }
        this.cdr.markForCheck();
      }, 100);
    } else {
      alert('Invalid admin token');
      this.adminToken = '';
      
      setTimeout(() => {
        const input = document.querySelector('.admin-token-input') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    }
  }

  closeAdminOperationsModal() {
    this.showAdminOperationsModal.set(false);
    this.selectedAdminSection.set('');
    
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  selectOperation(operationId: string) {
    this.selectedOperation.set(operationId);
    const sectionId = this.selectedAdminSection();
    
    this.closeAdminOperationsModal();
    
    if (sectionId === 'experience') {
      this.handleExperienceOperation(operationId);
    } else if (sectionId === 'projects') {
      this.handleProjectsOperation(operationId);
    } else {
      alert(`${sectionId} operations are not yet implemented`);
    }
  }

  private async handleExperienceOperation(operationId: string) {
    // Ensure section is loaded first
    if (!this.experienceComponentLoaded()) {
      await this.loadSection('experience');
      // Wait for component to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (operationId === 'create') {
      if (this.experienceComponentRef) {
        this.experienceComponentRef.enableAdminMode();
        setTimeout(() => {
          this.experienceComponentRef.openForm();
        }, 100);
      }
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

  private async handleProjectsOperation(operationId: string) {
    // Ensure section is loaded first
    if (!this.projectsComponentLoaded()) {
      await this.loadSection('projects');
      // Wait for component to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (operationId === 'create') {
      if (this.projectsComponentRef) {
        this.projectsComponentRef.enableAdminMode();
        setTimeout(() => {
          this.projectsComponentRef.handleCreateOperation();
        }, 100);
      }
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

  selectExperience(experienceId: number) {
    this.selectedExperienceId.set(experienceId);
    const operation = this.selectedOperation();
    
    this.closeExperienceSelectionModal();
    
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
    
    if (operation === 'update') {
      this.updateProject(projectId);
    } else if (operation === 'delete') {
      this.deleteProject(projectId);
    }
  }

  private updateExperience(experienceId: number) {
    const experience = this.experiences().find(exp => exp.id === experienceId);
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
    const project = this.projects().find(proj => proj.id === projectId);
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

  private async deleteExperience(experienceId: number) {
    const experience = this.experiences().find(exp => exp.id === experienceId);
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
    const project = this.projects().find(proj => proj.id === projectId);
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

  private async loadExperiences() {
    try {
      const experiences = await this.experienceService.getAllExperiences();
      experiences.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
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

  logoutAdmin() {
    this.isAdminAuthenticated.set(false);
    this.showAdminDropdown.set(false);
    
    if (this.isBrowser) {
      localStorage.removeItem('adminToken');
    }
    
    if (this.experienceComponentRef) {
      this.experienceComponentRef.disableAdminMode();
    }
    
    if (this.projectsComponentRef) {
      this.projectsComponentRef.disableAdminMode();
    }
    
    this.cdr.markForCheck();
  }
}