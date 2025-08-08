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

  // Manual validation check - bypassing Angular's form validation issues
  private manualFormValidation(): boolean {
    const formValue = this.experienceForm.value;
    
    // Required field checks
    const companyNameValid = !!(formValue.companyName?.trim() && formValue.companyName.trim().length >= 2);
    const roleValid = !!(formValue.role?.trim() && formValue.role.trim().length >= 2);
    const startDateValid = !!formValue.startDate;
    const descriptionValid = !!(formValue.description?.trim() && formValue.description.trim().length >= 10);
    
    // End date check
    const endDateValid = formValue.current === true || !!formValue.endDate;
    
    // Skills check
    const skillsValid = this.hasValidSkills();
    
    const isValid = companyNameValid && roleValid && startDateValid && descriptionValid && endDateValid && skillsValid;
    
    console.log('=== MANUAL VALIDATION CHECK ===');
    console.log('Company Name Valid:', companyNameValid, `"${formValue.companyName}"`);
    console.log('Role Valid:', roleValid, `"${formValue.role}"`);
    console.log('Start Date Valid:', startDateValid, `"${formValue.startDate}"`);
    console.log('Description Valid:', descriptionValid, `"${formValue.description}" (length: ${formValue.description?.length})`);
    console.log('End Date Valid:', endDateValid, `current: ${formValue.current}, endDate: "${formValue.endDate}"`);
    console.log('Skills Valid:', skillsValid);
    console.log('MANUAL VALIDATION RESULT:', isValid);
    console.log('=== END MANUAL VALIDATION ===');
    
    return isValid;
  }

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Create form with proper validation
    this.experienceForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      role: ['', [Validators.required, Validators.minLength(2)]], 
      startDate: ['', [Validators.required]], 
      endDate: [''], 
      current: [false],
      description: ['', [Validators.required, Validators.minLength(10)]], 
      skills: this.fb.array([this.fb.control('', [Validators.required])])
    });

    this.checkAdminStatus();
  }

  ngOnInit() {
    this.loadExperiences();
    this.setupFormValidation();
  }

  private setupFormValidation() {
    // Add conditional validation for end date
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
    const skillControl = this.fb.control('', [Validators.required]);
    this.skillsArray.push(skillControl);
    // Trigger validation update
    setTimeout(() => this.onSkillChange(), 100);
  }

  removeSkill(index: number) {
    if (this.skillsArray.length > 1) {
      this.skillsArray.removeAt(index);
      // Trigger validation update
      setTimeout(() => this.onSkillChange(), 100);
    }
  }

  // Simplified and more reliable skills validation
  hasValidSkills(): boolean {
    if (!this.skillsArray || this.skillsArray.length === 0) {
      console.log('No skills array or empty array');
      return false;
    }
    
    // Get all skill values and filter for valid ones
    const allSkillValues = this.skillsArray.controls.map(control => control.value);
    const validSkills = allSkillValues.filter(value => {
      const isValid = value && typeof value === 'string' && value.trim().length > 0;
      return isValid;
    });
    
    console.log('Skills validation check:', {
      totalControls: this.skillsArray.length,
      allValues: allSkillValues,
      validSkills: validSkills,
      validCount: validSkills.length,
      result: validSkills.length > 0
    });
    
    return validSkills.length > 0;
  }

  // Improved form validation
  isFormValid(): boolean {
    const formValue = this.experienceForm.value;
    
    // Check required fields
    const companyName = formValue.companyName?.trim();
    const role = formValue.role?.trim();
    const startDate = formValue.startDate;
    const description = formValue.description?.trim();
    const current = formValue.current;
    const endDate = formValue.endDate;

    // Basic validation
    const hasCompanyName = !!companyName && companyName.length >= 2;
    const hasRole = !!role && role.length >= 2;
    const hasStartDate = !!startDate;
    const hasDescription = !!description && description.length >= 10;
    
    // End date validation
    const hasValidEndDate = current === true || !!endDate;
    
    // Date format validation (ensure it's in YYYY-MM-DD format)
    const isValidStartDate = this.isValidDateFormat(startDate);
    const isValidEndDate = current || !endDate || this.isValidDateFormat(endDate);
    
    // Skills validation - simplified approach
    const hasValidSkills = this.hasValidSkills();

    const isValid = hasCompanyName && hasRole && hasStartDate && hasDescription && 
                   hasValidEndDate && isValidStartDate && isValidEndDate && hasValidSkills;
    
    console.log('=== DETAILED FORM VALIDATION ===');
    console.log('Company Name:', { value: `"${companyName}"`, valid: hasCompanyName });
    console.log('Role:', { value: `"${role}"`, valid: hasRole });
    console.log('Start Date:', { value: `"${startDate}"`, valid: hasStartDate && isValidStartDate });
    console.log('Description:', { value: `"${description}"`, length: description?.length, valid: hasDescription });
    console.log('Current Working:', current);
    console.log('End Date:', { value: `"${endDate}"`, required: !current, valid: hasValidEndDate && isValidEndDate });
    console.log('Skills Valid:', hasValidSkills);
    console.log('Angular Form Valid:', this.experienceForm.valid);
    console.log('FINAL RESULT:', isValid);
    console.log('=== END VALIDATION ===');
    
    return isValid;
  }

  // Helper method to validate date format
  private isValidDateFormat(dateString: string): boolean {
    if (!dateString) return false;
    
    // Check if the date string matches YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  onSkillChange() {
    // Trigger form validation update
    setTimeout(() => {
      // Force update skills array validation
      this.skillsArray.controls.forEach(control => {
        control.updateValueAndValidity();
      });
      
      // Update form validation
      this.experienceForm.updateValueAndValidity();
      
      // Force change detection for skills validation
      console.log('Skills changed - current values:', this.skillsArray.controls.map(c => c.value));
    }, 50); // Increased timeout to ensure DOM updates are captured
  }

  onCurrentChange() {
    const isCurrentlyWorking = this.experienceForm.get('current')?.value;
    const endDateControl = this.experienceForm.get('endDate');
    
    if (isCurrentlyWorking) {
      endDateControl?.setValue('');
      endDateControl?.clearValidators();
    } else {
      endDateControl?.setValidators([Validators.required]);
    }
    endDateControl?.updateValueAndValidity();
    
    // Trigger validation update
    this.onSkillChange();
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
          this.skillsArray.push(this.fb.control(skill, [Validators.required]));
        });
      } else {
        this.skillsArray.push(this.fb.control('', [Validators.required]));
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
    this.skillsArray.push(this.fb.control('', [Validators.required]));
    this.experienceForm.patchValue({ current: false });
    this.editingId.set(null);
  }

  async onSubmit() {
    console.log('=== FORM SUBMISSION ===');
    console.log('Form value:', this.experienceForm.value);
    console.log('Form valid check:', this.isFormValid());
    
    if (!this.isFormValid()) {
      console.log('Form validation failed - marking fields as touched');
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
      const startDate = this.convertToApiDateFormat(formValue.startDate);
      const endDate = formValue.current ? null : this.convertToApiDateFormat(formValue.endDate);
      
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

  // Convert date from form to API format (ensure YYYY-MM-DD)
  private convertToApiDateFormat(dateString: string): string {
    if (!dateString) return '';
    
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Try to parse and convert to YYYY-MM-DD
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
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
    const hasNoValidSkills = !this.hasValidSkills() && 
      this.skillsArray.controls.some(control => control.touched);
    
    return hasInvalidSkills || hasNoValidSkills;
  }
}