// Updated src/app/experience/experience.ts - Performance Optimized
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
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ExperienceService } from '../services/experience.service';
import { Experience } from '../model/experience.model';
import { ConfigService } from '../services/config.service';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';

// Declare Quill for TypeScript
declare var Quill: any;

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SafeHtmlPipe],
  templateUrl: './experience.html',
  styleUrls: ['./experience.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExperienceComponent implements OnInit, AfterViewInit {
  @ViewChild('quillEditor', { static: false }) quillEditorRef!: ElementRef;
  
  private experienceService = inject(ExperienceService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  experiences = signal<Experience[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);
  private isBrowser: boolean;
  private quillEditor: any = null;
  private quillLoaded = false;
  private quillLoadPromise: Promise<void> | null = null;

  experienceForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    this.experienceForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(1)]],
      role: ['', [Validators.required, Validators.minLength(1)]], 
      startDate: ['', [Validators.required]], 
      endDate: [''], 
      current: [false],
      description: ['', [Validators.required, Validators.minLength(1)]], 
      skills: this.fb.array([this.createSkillControl()])
    });

    this.setupFormValidation();
  }

  ngOnInit() {
    this.loadExperiences();
    // Don't load Quill on init - wait for form to be opened
    this.checkAdminStatus();
  }

  ngAfterViewInit() {
    if (this.showForm() && this.quillLoaded) {
      setTimeout(() => this.initializeQuillEditor(), 100);
    }
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
      const existingQuillScript = document.querySelector('script[src*="quill.min.js"]');
      if (existingQuillScript) {
        // Wait for existing script to load
        existingQuillScript.addEventListener('load', () => {
          this.quillLoaded = true;
          resolve();
        });
        return;
      }

      // Load Quill CSS with optimized loading
      const existingQuillCSS = document.querySelector('link[href*="quill.snow.min.css"]');
      if (!existingQuillCSS) {
        const quillCSS = document.createElement('link');
        quillCSS.rel = 'stylesheet';
        quillCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css';
        quillCSS.media = 'print'; // Load without blocking
        quillCSS.onload = () => { 
          quillCSS.media = 'all'; // Apply styles after load
        };
        document.head.appendChild(quillCSS);
      }

      // Load Quill JS asynchronously
      const quillJS = document.createElement('script');
      quillJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js';
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

  // Public methods to be called from parent component
  enableAdminMode() {
    this.checkAdminStatus();
    this.isAdmin.set(true);
    this.cdr.markForCheck();
  }

  disableAdminMode() {
    this.isAdmin.set(false);
    this.closeForm();
    this.cdr.markForCheck();
  }

  // Public method to open form - can be called from parent
  async openForm(experience?: Experience) {
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
    
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    if (experience) {
      this.editingId.set(experience.id);
      
      const startDate = this.convertToDateInputFormat(experience.startDate);
      const endDate = experience.endDate ? this.convertToDateInputFormat(experience.endDate) : '';
      
      this.experienceForm.patchValue({
        companyName: experience.companyName,
        role: experience.role,
        startDate: startDate,
        endDate: endDate,
        current: experience.current,
        description: experience.description
      });
      
      this.skillsArray.clear();
      if (experience.skills && experience.skills.length > 0) {
        experience.skills.forEach(skill => {
          this.skillsArray.push(this.fb.control(skill, [Validators.required, Validators.minLength(1)]));
        });
      } else {
        this.skillsArray.push(this.createSkillControl());
      }
    } else {
      this.editingId.set(null);
    }
    
    this.showForm.set(true);
    this.cdr.markForCheck();
    
    // Initialize Quill editor after form is shown
    if (this.quillLoaded) {
      setTimeout(() => this.initializeQuillEditor(), 200);
    }
  }

  // Public method to refresh experiences - can be called from parent
  async refreshExperiences() {
    await this.loadExperiences();
  }

  // Public method to load experiences - can be called from parent
  async loadExperiences() {
    this.isLoading.set(true);
    try {
      const experiences = await this.experienceService.getAllExperiences();
      experiences.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      this.experiences.set(experiences);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading experiences:', error);
      this.experiences.set([]);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private initializeQuillEditor() {
    if (!this.quillLoaded || !this.quillEditorRef?.nativeElement || this.quillEditor) {
      return;
    }

    try {
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
        placeholder: 'Describe your role and responsibilities...',
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
      const currentDescription = this.experienceForm.get('description')?.value;
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
        this.experienceForm.get('description')?.setValue(html);
        
        // Trigger validation
        if (text.length === 0) {
          this.experienceForm.get('description')?.setErrors({ required: true });
        } else {
          this.experienceForm.get('description')?.setErrors(null);
        }

        // Force styling after each change
        setTimeout(() => this.forceWhiteBackgroundBlackText(), 10);
        this.cdr.markForCheck();
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
    if (!this.quillEditor || !this.quillEditor.root) {
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
    if (this.quillEditor) {
      try {
        // Get content before destroying
        const content = this.quillEditor.root.innerHTML;
        this.experienceForm.get('description')?.setValue(content);
        
        // Destroy the editor
        this.quillEditor = null;
      } catch (error) {
        console.error('Error destroying Quill editor:', error);
      }
    }
  }

  private setupFormValidation() {
    this.experienceForm.get('current')?.valueChanges.subscribe(isCurrent => {
      const endDateControl = this.experienceForm.get('endDate');
      if (isCurrent) {
        endDateControl?.clearValidators();
        endDateControl?.setValue('');
      } else {
        endDateControl?.setValidators([Validators.required]);
      }
      endDateControl?.updateValueAndValidity();
      this.cdr.markForCheck();
    });
  }

  private createSkillControl() {
    return this.fb.control('', [Validators.required, Validators.minLength(1)]);
  }

  private checkAdminStatus() {
    if (!this.isBrowser) {
      return;
    }
    
    const adminToken = localStorage.getItem('adminToken');
    const isAuthenticated = adminToken === this.configService.adminToken;
    this.isAdmin.set(isAuthenticated);
    this.cdr.markForCheck();
  }

  get skillsArray(): FormArray {
    return this.experienceForm.get('skills') as FormArray;
  }

  addSkill() {
    this.skillsArray.push(this.createSkillControl());
    this.cdr.markForCheck();
  }

  removeSkill(index: number) {
    if (this.skillsArray.length > 1) {
      this.skillsArray.removeAt(index);
      this.cdr.markForCheck();
    }
  }

  get isFormValid(): boolean {
    if (!this.experienceForm) {
      return false;
    }

    const basicFormValid = this.experienceForm.get('companyName')?.valid &&
                          this.experienceForm.get('role')?.valid &&
                          this.experienceForm.get('startDate')?.valid &&
                          this.experienceForm.get('description')?.valid;

    const current = this.experienceForm.get('current')?.value;
    const endDateValid = current || this.experienceForm.get('endDate')?.valid;

    const hasValidSkill = this.skillsArray.controls.some(control => {
      const value = control.value;
      return control.valid && value && typeof value === 'string' && value.trim().length > 0;
    });

    return basicFormValid && endDateValid && hasValidSkill;
  }

  onCurrentChange() {
    this.experienceForm.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  closeForm() {
    this.destroyQuillEditor();
    this.showForm.set(false);
    this.resetForm();
    
    if (this.isBrowser) {
      document.body.style.overflow = 'auto'; // Restore background scrolling
    }
    this.cdr.markForCheck();
  }

  resetForm() {
    this.experienceForm.reset();
    this.skillsArray.clear();
    this.skillsArray.push(this.createSkillControl());
    this.experienceForm.patchValue({ current: false });
    this.editingId.set(null);
  }

  async onSubmit() {
    // Ensure Quill content is saved to form before validation
    if (this.quillEditor) {
      const html = this.quillEditor.root.innerHTML;
      const text = this.quillEditor.getText().trim();
      if (text.length > 0) {
        this.experienceForm.get('description')?.setValue(html);
      }
    }

    if (!this.isFormValid) {
      this.markAllFieldsAsTouched();
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.experienceForm.value;
      
      const validSkills: string[] = [];
      this.skillsArray.controls.forEach(control => {
        const skill = control.value;
        if (skill && typeof skill === 'string' && skill.trim().length > 0) {
          validSkills.push(skill.trim());
        }
      });
      
      const startDate = formValue.startDate;
      const endDate = formValue.current ? null : formValue.endDate;
      
      const experienceData = {
        companyName: formValue.companyName.trim(),
        role: formValue.role.trim(),
        startDate: startDate,
        endDate: endDate,
        current: formValue.current,
        description: formValue.description, // This now contains HTML from Quill
        skills: validSkills
      };

      if (this.editingId()) {
        await this.experienceService.updateExperience(this.editingId()!, experienceData);
      } else {
        await this.experienceService.createExperience(experienceData);
      }
      
      await this.loadExperiences();
      this.closeForm();
      alert('Experience saved successfully!');
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(error.message || 'An error occurred while saving');
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.experienceForm.controls).forEach(key => {
      const control = this.experienceForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    
    this.skillsArray.controls.forEach(control => {
      control.markAsTouched();
    });
    
    this.cdr.markForCheck();
  }

  async deleteExperience(id: number, companyName: string) {
    if (confirm(`Are you sure you want to delete the experience at ${companyName}?`)) {
      this.isLoading.set(true);
      try {
        await this.experienceService.deleteExperience(id);
        await this.loadExperiences();
        alert('Experience deleted successfully!');
      } catch (error: any) {
        console.error('Delete error:', error);
        alert(error.message || 'Failed to delete experience');
      } finally {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    }
  }

  private convertToDateInputFormat(dateString: string): string {
    if (!dateString) return '';
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toISOString().split('T')[0];
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  calculateDuration(startDate: string, endDate: string | null, isCurrent: boolean): string {
    const start = new Date(startDate);
    const end = isCurrent ? new Date() : new Date(endDate!);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const years = Math.floor(diffMonths / 12);
    const months = diffMonths % 12;

    if (years > 0 && months > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      return 'Less than a month';
    }
  }

  shouldShowSkillsError(): boolean {
    const hasInvalidSkills = this.skillsArray.controls.some(control => 
      control.invalid && control.touched
    );
    const hasNoValidSkills = this.skillsArray.controls.every(control => 
      !control.value || !control.value.trim()
    ) && this.skillsArray.controls.some(control => control.touched);
    
    return hasInvalidSkills || hasNoValidSkills;
  }
}