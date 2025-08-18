// Updated src/app/app.ts - Enhanced admin interface with Projects integration
import {
  Component,
  OnInit,
  HostListener,
  Inject,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExperienceComponent } from './experience/experience';
import { ProjectsComponent } from './projects/projects';
import { ConfigService } from './services/config.service';
import { ExperienceService } from './services/experience.service';
import { ProjectService } from './services/project.service';
import { Experience } from './model/experience.model';
import { Project } from './model/project.model';

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
})
export class AppComponent implements OnInit {
  @ViewChild(ExperienceComponent) experienceComponent!: ExperienceComponent;
  @ViewChild(ProjectsComponent) projectsComponent!: ProjectsComponent;

  title = 'Portfolio-UI';
  isDarkTheme = true;
  isScrolled = false;
  isMobileMenuOpen = false;
  
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

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private configService: ConfigService,
    private experienceService: ExperienceService,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    this.isDarkTheme = true;

    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme');
      this.isDarkTheme = savedTheme === null || savedTheme === 'dark';
      
      // Check if user is already authenticated as admin
      const savedAdminToken = localStorage.getItem('adminToken');
      if (savedAdminToken === this.configService.adminToken) {
        this.isAdminAuthenticated.set(true);
      }
    }

    this.applyTheme();
    this.loadExperiences();
    this.loadProjects();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      this.isScrolled = window.scrollY > 50;
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
    }
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    }

    this.applyTheme();
  }

  private applyTheme() {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-theme', this.isDarkTheme);
    }
  }

  downloadResume() {
    if (isPlatformBrowser(this.platformId)) {
      const resumePath = 'assets/resume/Resume_Yugantar_Badhan.pdf';
      const link = document.createElement('a');
      link.href = resumePath;
      link.download = 'Resume_Yugantar_Badhan.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('Resume download triggered.');
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : 'auto';
    }
  }

  scrollToSection(sectionId: string, event: Event) {
    event.preventDefault();

    this.isMobileMenuOpen = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'auto';
    }

    if (isPlatformBrowser(this.platformId)) {
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
  }

  // Admin functionality methods
  toggleAdminDropdown(event: Event) {
    event.stopPropagation();
    this.showAdminDropdown.update(show => !show);
  }

  selectAdminSection(sectionId: string, event: Event) {
    event.stopPropagation();
    
    if (!this.isAdminAuthenticated()) {
      this.selectedAdminSection.set(sectionId);
      this.showAdminTokenModal.set(true);
      this.showAdminDropdown.set(false);
      this.adminToken = '';
      
      // Focus the input after modal opens
      setTimeout(() => {
        const input = document.querySelector('.admin-token-input') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    } else {
      // User is already authenticated, show operations modal
      this.selectedAdminSection.set(sectionId);
      this.showAdminOperationsModal.set(true);
      this.showAdminDropdown.set(false);
    }
  }

  closeAdminTokenModal() {
    this.showAdminTokenModal.set(false);
    this.selectedAdminSection.set('');
    this.adminToken = '';
  }

  submitAdminToken() {
    if (this.adminToken.trim() === '') {
      alert('Please enter a token');
      return;
    }
    
    if (this.adminToken === this.configService.adminToken) {
      this.isAdminAuthenticated.set(true);
      
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('adminToken', this.adminToken);
      }
      
      const sectionId = this.selectedAdminSection();
      this.closeAdminTokenModal();
      
      // Show operations modal after successful authentication
      setTimeout(() => {
        this.showAdminOperationsModal.set(true);
      }, 100);
    } else {
      alert('Invalid admin token');
      this.adminToken = '';
      
      // Refocus the input
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
  }

  selectOperation(operationId: string) {
    this.selectedOperation.set(operationId);
    const sectionId = this.selectedAdminSection();
    
    console.log(`Selected operation: ${operationId} for section: ${sectionId}`);
    
    this.closeAdminOperationsModal();
    
    // Handle the operation based on section
    if (sectionId === 'experience') {
      this.handleExperienceOperation(operationId);
    } else if (sectionId === 'projects') {
      this.handleProjectsOperation(operationId);
    } else {
      alert(`${sectionId} operations are not yet implemented`);
    }
  }

  private async handleExperienceOperation(operationId: string) {
    console.log(`Handling experience operation: ${operationId}`);
    
    if (operationId === 'create') {
      // Enable admin mode and open form for creating new experience
      if (this.experienceComponent) {
        console.log('Experience component found, enabling admin mode');
        this.experienceComponent.enableAdminMode();
        
        // Small delay to ensure admin mode is set
        setTimeout(() => {
          this.experienceComponent.openForm();
        }, 100);
      } else {
        console.error('Experience component not found via ViewChild');
        alert('Error: Could not access experience component. Please refresh the page.');
      }
    } else if (operationId === 'update' || operationId === 'delete') {
      // Load experiences and show selection modal
      console.log('Loading experiences for selection...');
      
      try {
        await this.loadExperiences();
        
        if (this.experiences().length === 0) {
          alert('No experiences available to ' + operationId);
          return;
        }
        
        // Show experience selection modal
        this.showExperienceSelectionModal.set(true);
      } catch (error) {
        console.error('Error loading experiences:', error);
        alert('Failed to load experiences');
      }
    }
  }

  private async handleProjectsOperation(operationId: string) {
    console.log(`Handling projects operation: ${operationId}`);
    
    if (operationId === 'create') {
      // Enable admin mode and open form for creating new project
      if (this.projectsComponent) {
        console.log('Projects component found, enabling admin mode');
        this.projectsComponent.enableAdminMode();
        
        // Small delay to ensure admin mode is set
        setTimeout(() => {
          this.projectsComponent.handleCreateOperation();
        }, 100);
      } else {
        console.error('Projects component not found via ViewChild');
        alert('Error: Could not access projects component. Please refresh the page.');
      }
    } else if (operationId === 'update' || operationId === 'delete') {
      // Load projects and show selection modal
      console.log('Loading projects for selection...');
      
      try {
        await this.loadProjects();
        
        if (this.projects().length === 0) {
          alert('No projects available to ' + operationId);
          return;
        }
        
        // Show project selection modal
        this.showProjectSelectionModal.set(true);
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
  }

  closeProjectSelectionModal() {
    this.showProjectSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedProjectId.set(null);
  }

  selectExperience(experienceId: number) {
    this.selectedExperienceId.set(experienceId);
    const operation = this.selectedOperation();
    
    console.log(`Selected experience ${experienceId} for operation: ${operation}`);
    
    this.closeExperienceSelectionModal();
    
    // Execute the operation
    if (operation === 'update') {
      this.updateExperience(experienceId);
    } else if (operation === 'delete') {
      this.deleteExperience(experienceId);
    }
  }

  selectProject(projectId: number) {
    this.selectedProjectId.set(projectId);
    const operation = this.selectedOperation();
    
    console.log(`Selected project ${projectId} for operation: ${operation}`);
    
    this.closeProjectSelectionModal();
    
    // Execute the operation
    if (operation === 'update') {
      this.updateProject(projectId);
    } else if (operation === 'delete') {
      this.deleteProject(projectId);
    }
  }

  private updateExperience(experienceId: number) {
    const experience = this.experiences().find(exp => exp.id === experienceId);
    if (experience) {
      console.log('Opening update form for experience:', experience);
      
      if (this.experienceComponent) {
        console.log('Experience component found, enabling admin mode and opening form');
        this.experienceComponent.enableAdminMode();
        
        // Small delay to ensure admin mode is set
        setTimeout(() => {
          this.experienceComponent.openForm(experience);
        }, 100);
      } else {
        console.error('Experience component not found via ViewChild');
        alert('Error: Could not access experience component. Please refresh the page.');
      }
    } else {
      alert('Experience not found');
    }
  }

  private updateProject(projectId: number) {
    const project = this.projects().find(proj => proj.id === projectId);
    if (project) {
      console.log('Opening update form for project:', project);
      
      if (this.projectsComponent) {
        console.log('Projects component found, enabling admin mode and opening form');
        this.projectsComponent.enableAdminMode();
        
        // Small delay to ensure admin mode is set
        setTimeout(() => {
          this.projectsComponent.handleProjectSelection(projectId, 'update');
        }, 100);
      } else {
        console.error('Projects component not found via ViewChild');
        alert('Error: Could not access projects component. Please refresh the page.');
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
          console.log('Deleting experience:', experienceId);
          
          await this.experienceService.deleteExperience(experienceId);
          
          // Reload experiences in both parent and child components
          await this.loadExperiences();
          
          // Refresh the experience component
          if (this.experienceComponent) {
            await this.experienceComponent.refreshExperiences();
          }
          
          alert('Experience deleted successfully!');
          console.log('Experience deleted successfully');
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
          console.log('Deleting project:', projectId);
          
          await this.projectService.deleteProject(projectId);
          
          // Reload projects in both parent and child components
          await this.loadProjects();
          
          // Refresh the projects component
          if (this.projectsComponent) {
            await this.projectsComponent.refreshProjects();
          }
          
          alert('Project deleted successfully!');
          console.log('Project deleted successfully');
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
      console.log('Loading experiences in app component...');
      const experiences = await this.experienceService.getAllExperiences();
      experiences.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      this.experiences.set(experiences);
      console.log('Loaded experiences in app component:', experiences.length);
    } catch (error) {
      console.error('Error loading experiences in app component:', error);
      this.experiences.set([]);
    }
  }

  private async loadProjects() {
    try {
      console.log('Loading projects in app component...');
      const projects = await this.projectService.getAllProjects();
      projects.sort((a, b) => b.id - a.id);
      this.projects.set(projects);
      console.log('Loaded projects in app component:', projects.length);
    } catch (error) {
      console.error('Error loading projects in app component:', error);
      this.projects.set([]);
    }
  }

  logoutAdmin() {
    this.isAdminAuthenticated.set(false);
    this.showAdminDropdown.set(false);
    
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('adminToken');
    }
    
    // Disable admin mode in all components
    if (this.experienceComponent) {
      this.experienceComponent.disableAdminMode();
    }
    
    if (this.projectsComponent) {
      this.projectsComponent.disableAdminMode();
    }
    
    console.log('Admin logged out');
  }

  // Helper methods for debugging
  getDebugInfo() {
    return {
      isAdminAuthenticated: this.isAdminAuthenticated(),
      selectedAdminSection: this.selectedAdminSection(),
      selectedOperation: this.selectedOperation(),
      experiencesCount: this.experiences().length,
      projectsCount: this.projects().length,
      showModals: {
        adminToken: this.showAdminTokenModal(),
        adminOperations: this.showAdminOperationsModal(),
        experienceSelection: this.showExperienceSelectionModal(),
        projectSelection: this.showProjectSelectionModal()
      },
      componentsAvailable: {
        experience: !!this.experienceComponent,
        projects: !!this.projectsComponent
      }
    };
  }
}