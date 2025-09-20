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
  styleUrls: ['./projects.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('quillEditor', { static: false }) quillEditorRef!: ElementRef;

  private projectService = inject(ProjectService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  projects = signal<Project[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);
  showGithubRepos = signal(false);
  currentGithubRepos = signal<GitHubRepo[]>([]);

  // Project Details Modal State
  showProjectDetails = signal(false);
  selectedProject = signal<Project | null>(null);

  private isBrowser: boolean;
  private quillEditor: any = null;
  private quillLoaded = false;
  private quillLoadPromise: Promise<void> | null = null;
  private resizeTimeout: any;

  projectForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.projectForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(400)]],
      description: ['', [Validators.required, Validators.minLength(1)]],
      techStack: [''],
      githubLink: ['', [this.multiUrlValidator]],
      liveDemoLink: ['', [this.urlValidator]],
    });
  }

  ngOnInit() {
    console.log('ProjectsComponent: Initializing...');
    this.loadProjects();
    this.checkAdminStatus();
  }

  ngAfterViewInit() {
    console.log('ProjectsComponent: After view init');
    // Only initialize Quill in browser environment when form is shown
    if (this.isBrowser && this.showForm() && this.quillLoaded) {
      setTimeout(() => this.initializeQuillEditor(), 100);
    }
  }

  ngOnDestroy() {
    console.log('ProjectsComponent: Destroying...');
    
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.destroyQuillEditor();

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  // FIXED: Admin Mode Control Methods with proper logging
  enableAdminMode() {
    console.log('ProjectsComponent: Enabling admin mode');
    this.isAdmin.set(true);
    this.checkAdminStatus();
    this.cdr.markForCheck();
  }

  disableAdminMode() {
    console.log('ProjectsComponent: Disabling admin mode');
    this.isAdmin.set(false);
    this.closeForm();
    this.cdr.markForCheck();
  }

  // FIXED: Admin operation methods with better error handling
  async handleCreateOperation() {
    console.log('ProjectsComponent: Handle create operation');
    try {
      await this.openForm();
    } catch (error) {
      console.error('Error opening create form:', error);
      alert('Failed to open create form. Please try again.');
    }
  }

  async handleUpdateOperation() {
    console.log('ProjectsComponent: Handle update operation');
    if (this.projects().length === 0) {
      alert('No projects available to update');
      return false;
    }
    return true;
  }

  async handleDeleteOperation() {
    console.log('ProjectsComponent: Handle delete operation');
    if (this.projects().length === 0) {
      alert('No projects available to delete');
      return false;
    }
    return true;
  }

  // Handle project selection for update/delete operations
  async handleProjectSelection(
    projectId: number,
    operation: 'update' | 'delete'
  ) {
    console.log(
      'ProjectsComponent: Handle project selection',
      projectId,
      operation
    );

    const project = this.projects().find((p) => p.id === projectId);
    if (!project) {
      alert('Project not found');
      return;
    }

    try {
      if (operation === 'update') {
        await this.openForm(project);
      } else if (operation === 'delete') {
        await this.deleteProject(projectId, project.title);
      }
    } catch (error) {
      console.error(`Error handling ${operation} operation:`, error);
      alert(`Failed to ${operation} project. Please try again.`);
    }
  }

  // Refresh projects method
  async refreshProjects() {
    console.log('ProjectsComponent: Refreshing projects...');
    await this.loadProjects();
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any) {
    if (this.isBrowser) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.cdr.markForCheck();
      }, 150);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
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

  private checkAdminStatus() {
    if (!this.isBrowser) {
      return;
    }

    try {
      const adminToken = localStorage.getItem('adminToken');
      const adminSession = localStorage.getItem('adminSession');

      let isAuthenticated = false;

      // Check new session format first
      if (adminSession) {
        const session = JSON.parse(adminSession);
        const now = Date.now();
        const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

        if (
          now - session.timestamp <= SESSION_TIMEOUT &&
          session.token === this.configService.adminToken
        ) {
          isAuthenticated = true;
        }
      } else if (adminToken === this.configService.adminToken) {
        // Fallback to old token format
        isAuthenticated = true;
      }

      console.log(
        'ProjectsComponent: Admin authentication status:',
        isAuthenticated
      );
      this.isAdmin.set(isAuthenticated);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.isAdmin.set(false);
    }
  }

  // FIXED: Open form with better error handling and body scroll management
  async openForm(project?: Project) {
    console.log(
      'ProjectsComponent: Opening form',
      project ? 'for editing' : 'for creation'
    );

    try {
      this.resetForm();

      // Load Quill only when form is opened
      if (this.isBrowser && !this.quillLoaded) {
        try {
          await this.loadQuillEditor();
        } catch (error) {
          console.error('Failed to load Quill, using fallback textarea');
          this.showQuillFallback();
        }
      }

      // FIXED: Always set body overflow to hidden when opening form
      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
        console.log('ProjectsComponent: Set body overflow to hidden');
      }

      if (project) {
        this.editingId.set(project.id);

        this.projectForm.patchValue({
          title: project.title,
          description: project.description,
          techStack: project.techStack || '',
          githubLink: project.githubLink || '',
          liveDemoLink: project.liveDemoLink || '',
        });
      } else {
        this.editingId.set(null);
      }

      this.showForm.set(true);
      console.log('ProjectsComponent: Form opened successfully');
      this.cdr.markForCheck();

      // Initialize Quill editor after form is shown
      if (this.isBrowser && this.quillLoaded) {
        setTimeout(() => {
          this.initializeQuillEditor();
          if (project && project.description) {
            setTimeout(() => {
              if (this.quillEditor) {
                this.quillEditor.root.innerHTML = project.description;
                this.forceWhiteBackgroundBlackText();
              }
            }, 100);
          }
        }, 250);
      }
    } catch (error) {
      console.error('Error opening form:', error);

      // Ensure body scroll is restored on error
      if (this.isBrowser) {
        document.body.style.overflow = 'auto';
      }

      throw error; // Re-throw to be handled by caller
    }
  }

  // FIXED: Close form with proper body scroll restoration
  closeForm() {
    console.log('ProjectsComponent: Closing form');

    this.destroyQuillEditor();
    this.showForm.set(false);
    this.resetForm();

    // FIXED: Always restore body scroll when closing form
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
      console.log('ProjectsComponent: Restored body overflow to auto');
    }

    this.cdr.markForCheck();
  }

  resetForm() {
    this.projectForm.reset();
    this.projectForm.patchValue({
      title: '',
      description: '',
      techStack: '',
      githubLink: '',
      liveDemoLink: '',
    });
    this.editingId.set(null);
  }

  // Lazy load Quill editor only when needed
  private async loadQuillEditor(): Promise<void> {
    if (!this.isBrowser || this.quillLoaded) {
      return;
    }

    // Return existing promise if already loading
    if (this.quillLoadPromise) {
      return this.quillLoadPromise;
    }

    this.quillLoadPromise = new Promise<void>((resolve, reject) => {
      // Check if Quill is already loaded
      if (typeof (window as any).Quill !== 'undefined') {
        this.quillLoaded = true;
        resolve();
        return;
      }

      // Check if scripts are already in DOM
      const existingQuillScript = document.querySelector(
        'script[src*="quill.min.js"]'
      );
      if (existingQuillScript) {
        // Wait for existing script to load
        existingQuillScript.addEventListener('load', () => {
          this.quillLoaded = true;
          resolve();
        });
        return;
      }

      // Load Quill CSS with optimized loading
      const existingQuillCSS = document.querySelector(
        'link[href*="quill.snow.min.css"]'
      );
      if (!existingQuillCSS) {
        const quillCSS = document.createElement('link');
        quillCSS.rel = 'stylesheet';
        quillCSS.href =
          'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css';
        quillCSS.media = 'print'; // Load without blocking
        quillCSS.onload = () => {
          quillCSS.media = 'all'; // Apply styles after load
        };
        document.head.appendChild(quillCSS);
      }

      // Load Quill JS asynchronously
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
        this.quillLoadPromise = null; // Reset promise on error
        reject(error);
      };

      document.head.appendChild(quillJS);
    });

    return this.quillLoadPromise;
  }

  async loadProjects() {
    console.log('ProjectsComponent: Loading projects...');
    this.isLoading.set(true);
    try {
      const projects = await this.projectService.getAllProjects();
      projects.sort((a, b) => b.id - a.id);
      this.projects.set(projects);

      console.log(
        'ProjectsComponent: Projects loaded successfully',
        projects.length,
        'projects'
      );
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects.set([]);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
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

    if (this.quillEditor) {
      const text = this.quillEditor.getText().trim();
      if (text.length === 0) {
        return false;
      }
    }

    return !!(titleValid && descriptionValid && githubValid && demoValid);
  }

  // FIXED: Submit form with better error handling
  async onSubmit() {
    console.log('ProjectsComponent: Submitting form...');

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
        description: formValue.description,
        techStack: formValue.techStack?.trim() || null,
        githubLink: formValue.githubLink?.trim() || null,
        liveDemoLink: formValue.liveDemoLink?.trim() || null,
      };

      console.log('Submitting project data:', projectData);

      if (this.editingId()) {
        await this.projectService.updateProject(this.editingId()!, projectData);
        console.log('Project updated successfully');
      } else {
        await this.projectService.createProject(projectData);
        console.log('Project created successfully');
      }

      await this.loadProjects();
      this.closeForm();

      const message = this.editingId()
        ? 'Project updated successfully!'
        : 'Project created successfully!';
      alert(message);
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage =
        error.message ||
        'An error occurred while saving the project. Please try again.';
      alert(errorMessage);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
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
        const errorMessage =
          error.message || 'Failed to delete project. Please try again.';
        alert(errorMessage);
      } finally {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    }
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.projectForm.controls).forEach((key) => {
      const control = this.projectForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    this.cdr.markForCheck();
  }

  // Validators
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

  private multiUrlValidator(control: any) {
    const value = control.value;
    if (!value || value.trim() === '') {
      return null;
    }

    const urls = value
      .split(',')
      .map((url: string) => url.trim())
      .filter((url: string) => url);

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

  private initializeQuillEditor() {
    if (
      !this.isBrowser ||
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
          'Describe your project in detail. Include features, technologies used, challenges overcome, and key achievements...',
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

      const currentDescription = this.projectForm.get('description')?.value;
      if (currentDescription) {
        this.quillEditor.root.innerHTML = currentDescription;
        setTimeout(forceStyles, 100);
      }

      this.quillEditor.on('text-change', () => {
        const html = this.quillEditor.root.innerHTML;
        const text = this.quillEditor.getText().trim();

        this.projectForm.get('description')?.setValue(html);

        if (text.length === 0 || html === '<p><br></p>') {
          this.projectForm.get('description')?.setErrors({ required: true });
        } else {
          this.projectForm.get('description')?.setErrors(null);
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
      this.projectForm.get('description')?.setValue(content);
      this.quillEditor = null;
    } catch (error) {
      console.error('Error destroying Quill editor:', error);
    }
  }

  // Project Details Modal Methods
  openProjectDetails(project: Project): void {
    this.selectedProject.set(project);
    this.showProjectDetails.set(true);

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

  closeProjectDetails(): void {
    this.showProjectDetails.set(false);
    this.selectedProject.set(null);

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

  // GitHub repositories functionality
  hasMultipleGithubRepos(githubLink: string): boolean {
    if (!githubLink) return false;
    return githubLink.includes(',');
  }

  getGithubRepoCount(githubLink: string): number {
    if (!githubLink) return 0;
    return githubLink.split(',').filter((url) => url.trim()).length;
  }

  openGithubRepos(githubLink: string): void {
    if (!githubLink) return;

    const urls = githubLink
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url);
    const repos: GitHubRepo[] = urls.map((url, index) => ({
      url: url,
      name: this.extractRepoName(url) || `Repository ${index + 1}`,
    }));

    this.currentGithubRepos.set(repos);
    this.showGithubRepos.set(true);

    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
  }

  closeGithubRepos(): void {
    this.showGithubRepos.set(false);
    this.currentGithubRepos.set([]);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  private extractRepoName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter((part) => part);

      if (pathParts.length >= 2) {
        return `${pathParts[pathParts.length - 2]}/${
          pathParts[pathParts.length - 1]
        }`;
      }

      return pathParts[pathParts.length - 1] || '';
    } catch {
      const parts = url.split('/').filter((part) => part);
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
      return parts[parts.length - 1] || '';
    }
  }

  trackByProjectId(index: number, project: Project): number {
    return project.id;
  }
}