import { Component, OnInit, inject, signal, PLATFORM_ID, Inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
  styleUrls: ['./experience.css']
})
export class ExperienceComponent implements OnInit, AfterViewInit {
  @ViewChild('quillEditor', { static: false }) quillEditorRef!: ElementRef;
  
  private experienceService = inject(ExperienceService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);

  experiences = signal<Experience[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);
  private isBrowser: boolean;
  private quillEditor: any = null;
  private quillLoaded = false;

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
    this.checkAdminStatus();
  }

  ngOnInit() {
    this.loadExperiences();
    this.loadQuillEditor();
  }

  ngAfterViewInit() {
    // Initialize Quill when the form opens
    if (this.showForm() && this.quillLoaded) {
      setTimeout(() => this.initializeQuillEditor(), 100);
    }
  }

  private async loadQuillEditor() {
    if (!this.isBrowser || this.quillLoaded) {
      return;
    }

    try {
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
    this.isAdmin.set(adminToken === this.configService.adminToken);
  }

  toggleAdminMode() {
    if (!this.isBrowser) {
      return;
    }
    
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
  }

  async loadExperiences() {
    this.isLoading.set(true);
    try {
      const experiences = await this.experienceService.getAllExperiences();
      experiences.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      this.experiences.set(experiences);
    } catch (error) {
      console.error('Error loading experiences:', error);
      this.experiences.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  get skillsArray(): FormArray {
    return this.experienceForm.get('skills') as FormArray;
  }

  addSkill() {
    this.skillsArray.push(this.createSkillControl());
  }

  removeSkill(index: number) {
    if (this.skillsArray.length > 1) {
      this.skillsArray.removeAt(index);
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
  }

  openForm(experience?: Experience) {
    this.resetForm();
    
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
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
    
    // Initialize Quill editor after form is shown
    if (this.quillLoaded) {
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
  }

  async deleteExperience(id: number, companyName: string) {
    if (confirm(`Are you sure you want to delete the experience at ${companyName}?`)) {
      this.isLoading.set(true);
      try {
        await this.experienceService.deleteExperience(id);
        await this.loadExperiences();
        alert('Experience deleted successfully!');
      } catch (error: any) {
        alert(error.message || 'Failed to delete experience');
      } finally {
        this.isLoading.set(false);
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