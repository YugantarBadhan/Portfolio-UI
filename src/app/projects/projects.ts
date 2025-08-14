// src/app/projects/projects.ts - SSR Safe Version
import { Component, OnInit, inject, signal, PLATFORM_ID, Inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectService } from '../services/project.service';
import { Project } from '../model/project.model';
import { ConfigService } from '../services/config.service';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';

// Declare Quill for TypeScript
declare var Quill: any;

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SafeHtmlPipe],
  templateUrl: './projects.html',
  styleUrls: ['./projects.css']
})
export class ProjectsComponent implements OnInit, AfterViewInit {
  @ViewChild('quillEditor', { static: false }) quillEditorRef!: ElementRef;
  
  private projectService = inject(ProjectService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);

  projects = signal<Project[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);
  private isBrowser: boolean;
  private quillEditor: any = null;
  private quillLoaded = false;

  projectForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    this.projectForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(400)]],
      description: ['', [Validators.required, Validators.minLength(1)]], 
      techStack: [''], 
      githubLink: ['', [this.urlValidator]], 
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
    }
  }

  ngAfterViewInit() {
    // Only initialize Quill in browser environment
    if (this.isBrowser && this.showForm() && this.quillLoaded) {
      setTimeout(() => this.initializeQuillEditor(), 100);
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

      // Quill configuration with rich formatting options
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
        placeholder: 'Describe your project, its features, and implementation details...',
        formats: [
          'header', 'bold', 'italic', 'underline', 'strike',
          'list', 'bullet', 'indent', 'color', 'background',
          'align', 'link'
        ]
      });

      // Force white background and black text consistently
      setTimeout(() => {
        this.forceWhiteBackgroundBlackText();
      }, 50);

      // Set initial content if editing
      const currentDescription = this.projectForm.get('description')?.value;
      if (currentDescription) {
        this.quillEditor.root.innerHTML = currentDescription;
        // Force styling after setting content
        setTimeout(() => this.forceWhiteBackgroundBlackText(), 100);
      }

      // Listen for content changes
      this.quillEditor.on('text-change', () => {
        const html = this.quillEditor.root.innerHTML;
        const text = this.quillEditor.getText().trim();
        
        // Update form control with HTML content
        this.projectForm.get('description')?.setValue(html);
        
        // Trigger validation
        if (text.length === 0) {
          this.projectForm.get('description')?.setErrors({ required: true });
        } else {
          this.projectForm.get('description')?.setErrors(null);
        }

        // Force styling after each change
        setTimeout(() => this.forceWhiteBackgroundBlackText(), 10);
      });

      // Also listen for selection changes
      this.quillEditor.on('selection-change', () => {
        setTimeout(() => this.forceWhiteBackgroundBlackText(), 10);
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
    
    // Force white background and black text on the main editor
    editorElement.style.setProperty('background', 'white', 'important');
    editorElement.style.setProperty('color', '#333333', 'important');

    // Also force on the container
    const container = editorElement.parentElement;
    if (container && container.classList.contains('ql-container')) {
      container.style.setProperty('background', 'white', 'important');
    }

    // Get all elements inside the editor and force black text
    const allElements = editorElement.querySelectorAll('*');
    allElements.forEach((element: any) => {
      element.style.setProperty('color', '#333333', 'important');
      element.style.setProperty('background', 'transparent', 'important');
    });

    // Force on specific text elements
    const textElements = editorElement.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, strong, em, u, s');
    textElements.forEach((element: any) => {
      element.style.setProperty('color', '#333333', 'important');
      element.style.setProperty('background', 'transparent', 'important');
    });

    // Force styles using multiple methods
    editorElement.setAttribute('style', 'color: #333333 !important; background: white !important; padding: 15px !important; min-height: 120px !important;');
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

  // Custom URL validator
  private urlValidator(control: any) {
    const value = control.value;
    if (!value || value.trim() === '') {
      return null; // Allow empty values for optional fields
    }
    
    try {
      new URL(value);
      return null;
    } catch {
      return { invalidUrl: true };
    }
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
        } else {
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

    // Use double negation to ensure boolean return type
    return !!(
      this.projectForm.get('title')?.valid &&
      this.projectForm.get('description')?.valid &&
      this.projectForm.get('githubLink')?.valid &&
      this.projectForm.get('liveDemoLink')?.valid
    );
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
    
    // Initialize Quill editor after form is shown (only in browser)
    if (this.isBrowser && this.quillLoaded) {
      setTimeout(() => this.initializeQuillEditor(), 200);
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
      if (text.length > 0) {
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
      alert('Project saved successfully!');
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(error.message || 'An error occurred while saving');
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
    if (confirm(`Are you sure you want to delete the project "${title}"?`)) {
      this.isLoading.set(true);
      try {
        await this.projectService.deleteProject(id);
        await this.loadProjects();
        alert('Project deleted successfully!');
      } catch (error: any) {
        alert(error.message || 'Failed to delete project');
      } finally {
        this.isLoading.set(false);
      }
    }
  }
}