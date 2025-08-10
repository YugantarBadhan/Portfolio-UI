import { Component, OnInit, inject, signal, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ExperienceService } from '../services/experience.service';
import { Experience } from '../model/experience.model';
import { ConfigService } from '../services/config.service';

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './experience.html',
  styleUrls: ['./experience.css']
})
export class ExperienceComponent implements OnInit {
  private experienceService = inject(ExperienceService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);

  experiences = signal<Experience[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);
  private isBrowser: boolean;

  experienceForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Initialize form immediately in constructor
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
  }

  private setupFormValidation() {
    // Setup conditional validation for end date
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

  // Simple form validation using Angular's built-in validation
  get isFormValid(): boolean {
    if (!this.experienceForm) {
      return false;
    }

    // Check if basic form is valid
    const basicFormValid = this.experienceForm.get('companyName')?.valid &&
                          this.experienceForm.get('role')?.valid &&
                          this.experienceForm.get('startDate')?.valid &&
                          this.experienceForm.get('description')?.valid;

    // Check end date validation
    const current = this.experienceForm.get('current')?.value;
    const endDateValid = current || this.experienceForm.get('endDate')?.valid;

    // Check if at least one skill is valid and non-empty
    const hasValidSkill = this.skillsArray.controls.some(control => {
      const value = control.value;
      const isValid = control.valid && value && typeof value === 'string' && value.trim().length > 0;
      return isValid;
    });

    // Check if the skills array itself is valid
    const skillsArrayValid = this.skillsArray.valid;

    const formValid = basicFormValid && endDateValid && hasValidSkill && skillsArrayValid;

    console.log('=== DETAILED FORM VALIDATION ===');
    console.log('Company:', this.experienceForm.get('companyName')?.value, this.experienceForm.get('companyName')?.valid);
    console.log('Role:', this.experienceForm.get('role')?.value, this.experienceForm.get('role')?.valid);
    console.log('Start Date:', this.experienceForm.get('startDate')?.value, this.experienceForm.get('startDate')?.valid);
    console.log('Description:', this.experienceForm.get('description')?.value, this.experienceForm.get('description')?.valid);
    console.log('Current:', current);
    console.log('End Date Valid:', endDateValid, '(endDate:', this.experienceForm.get('endDate')?.value, this.experienceForm.get('endDate')?.valid, ')');
    console.log('Skills Array Valid:', skillsArrayValid);
    console.log('Has Valid Skill:', hasValidSkill);
    console.log('Skills Details:');
    this.skillsArray.controls.forEach((control, index) => {
      console.log(`  Skill ${index}:`, {
        value: `"${control.value}"`,
        valid: control.valid,
        errors: control.errors,
        trimmed: control.value?.trim?.(),
        trimmedLength: control.value?.trim?.().length || 0
      });
    });
    console.log('Basic Form Valid:', basicFormValid);
    console.log('End Date Valid:', endDateValid);
    console.log('OVERALL FORM VALID:', formValid);
    console.log('Angular Form.valid:', this.experienceForm.valid);
    console.log('=== END DETAILED VALIDATION ===');

    return formValid;
  }

  onCurrentChange() {
    // The form validation is already handled in the constructor
    // Just trigger form validation update
    this.experienceForm.updateValueAndValidity();
  }

  openForm(experience?: Experience) {
    this.resetForm();
    
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    
    if (experience) {
      this.editingId.set(experience.id);
      
      // Convert dates to YYYY-MM-DD format for the date inputs
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
      
      // Set skills
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
  }

  closeForm() {
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
    console.log('=== FORM SUBMISSION ===');
    console.log('Form valid:', this.isFormValid);
    console.log('Form value:', this.experienceForm.value);
    
    if (!this.isFormValid) {
      console.log('Form validation failed');
      this.markAllFieldsAsTouched();
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.experienceForm.value;
      
      // Get valid skills (filter out empty ones)
      const validSkills: string[] = [];
      this.skillsArray.controls.forEach(control => {
        const skill = control.value;
        if (skill && typeof skill === 'string' && skill.trim().length > 0) {
          validSkills.push(skill.trim());
        }
      });
      
      console.log('Processed valid skills:', validSkills);
      
      // Ensure dates are in correct format (YYYY-MM-DD)
      const startDate = formValue.startDate;
      const endDate = formValue.current ? null : formValue.endDate;
      
      const experienceData = {
        companyName: formValue.companyName.trim(),
        role: formValue.role.trim(),
        startDate: startDate,
        endDate: endDate,
        current: formValue.current,
        description: formValue.description.trim(),
        skills: validSkills
      };

      console.log('Final experience data to send:', experienceData);

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
    // Mark all form controls as touched
    Object.keys(this.experienceForm.controls).forEach(key => {
      const control = this.experienceForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    
    // Mark skills array controls as touched
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

  // Convert date string to format suitable for HTML date input (YYYY-MM-DD)
  private convertToDateInputFormat(dateString: string): string {
    if (!dateString) return '';
    
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Try to parse and convert to YYYY-MM-DD
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toISOString().split('T')[0];
  }

  // Format date for display (DD Month YYYY)
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

  // Helper method to check if it's the last item for timeline rendering
  isLastExperience(index: number): boolean {
    return index === this.experiences().length - 1;
  }

  // Helper method for skills error display
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