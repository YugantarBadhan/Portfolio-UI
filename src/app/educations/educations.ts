// Author: Yugantar Badhan

import {
  Component,
  OnInit,
  inject,
  signal,
  PLATFORM_ID,
  Inject,
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
import { EducationService } from '../services/education.service';
import { Education } from '../model/education.model';
import { ConfigService } from '../services/config.service';

@Component({
  selector: 'app-educations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './educations.html',
  styleUrls: ['./educations.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EducationsComponent implements OnInit, OnDestroy {
  private educationService = inject(EducationService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  educations = signal<Education[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);

  // Education Details Modal State
  showEducationDetails = signal(false);
  selectedEducation = signal<Education | null>(null);

  // Selection Modal State
  showEducationSelectionModal = signal(false);
  selectedOperation = signal<string>('');
  selectedEducationId = signal<number | null>(null);

  private isBrowser: boolean;
  private resizeTimeout: any;

  educationForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.educationForm = this.fb.group({
      degree: ['', [Validators.required, Validators.minLength(1)]],
      field: ['', [Validators.required, Validators.minLength(1)]],
      university: ['', [Validators.required, Validators.minLength(1)]],
      institute: ['', [Validators.required, Validators.minLength(1)]],
      location: [''],
      startDate: ['', [Validators.required, Validators.minLength(1)]],
      endDate: [''],
      currentStudying: [false],
      grade: ['', [Validators.required, Validators.minLength(1)]],
      educationType: ['', [Validators.required]],
      description: [''],
    });

    // Watch currentStudying changes
    this.educationForm.get('currentStudying')?.valueChanges.subscribe((isCurrentlyStudying) => {
      const endDateControl = this.educationForm.get('endDate');
      if (isCurrentlyStudying) {
        endDateControl?.setValue('');
        endDateControl?.clearValidators();
      } else {
        endDateControl?.setValidators([Validators.required]);
      }
      endDateControl?.updateValueAndValidity();
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    console.log('EducationsComponent: Initializing...');
    this.loadEducations();
    this.checkAdminStatus();
  }

  ngOnDestroy() {
    console.log('EducationsComponent: Destroying...');
    
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  // Public methods for admin functionality
  enableAdminMode() {
    console.log('EducationsComponent: Enabling admin mode');
    this.isAdmin.set(true);
    this.checkAdminStatus();
    this.cdr.markForCheck();
  }

  disableAdminMode() {
    console.log('EducationsComponent: Disabling admin mode');
    this.isAdmin.set(false);
    this.closeForm();
    this.closeEducationSelectionModal();
    this.cdr.markForCheck();
  }

  async handleCreateOperation() {
    console.log('EducationsComponent: Handle create operation');
    try {
      await this.openForm();
    } catch (error) {
      console.error('Error opening create form:', error);
      alert('Failed to open create form. Please try again.');
    }
  }

  async handleUpdateOperation() {
    console.log('EducationsComponent: Handle update operation');
    if (this.educations().length === 0) {
      alert('No educations available to update');
      return false;
    }
    this.selectedOperation.set('update');
    this.showEducationSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleDeleteOperation() {
    console.log('EducationsComponent: Handle delete operation');
    if (this.educations().length === 0) {
      alert('No educations available to delete');
      return false;
    }
    this.selectedOperation.set('delete');
    this.showEducationSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleEducationSelection(
    educationId: number,
    operation: 'update' | 'delete'
  ) {
    console.log(
      'EducationsComponent: Handle education selection',
      educationId,
      operation
    );

    const education = this.educations().find(
      (e) => e.id === educationId
    );
    if (!education) {
      alert('Education not found');
      return;
    }

    try {
      if (operation === 'update') {
        await this.openForm(education);
      } else if (operation === 'delete') {
        await this.deleteEducation(educationId, education.degree);
      }
    } catch (error) {
      console.error(`Error handling ${operation} operation:`, error);
      alert(`Failed to ${operation} education. Please try again.`);
    }
  }

  async refreshEducations() {
    console.log('EducationsComponent: Refreshing educations...');
    await this.loadEducations();
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
    if (this.showEducationDetails()) {
      if (event.key === 'Escape') {
        this.closeEducationDetails();
        event.preventDefault();
      }
    }

    if (this.showEducationSelectionModal()) {
      if (event.key === 'Escape') {
        this.closeEducationSelectionModal();
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

      if (adminSession) {
        const session = JSON.parse(adminSession);
        const now = Date.now();
        const SESSION_TIMEOUT = 30 * 60 * 1000;

        if (
          now - session.timestamp <= SESSION_TIMEOUT &&
          session.token === this.configService.adminToken
        ) {
          isAuthenticated = true;
        }
      } else if (adminToken === this.configService.adminToken) {
        isAuthenticated = true;
      }

      console.log(
        'EducationsComponent: Admin authentication status:',
        isAuthenticated
      );
      this.isAdmin.set(isAuthenticated);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.isAdmin.set(false);
    }
  }

  // Form Management
  async openForm(education?: Education) {
    console.log(
      'EducationsComponent: Opening form',
      education ? 'for editing' : 'for creation'
    );

    try {
      this.resetForm();

      if (this.isBrowser) {
        document.body.style.overflow = 'hidden';
      }

      if (education) {
        this.editingId.set(education.id);

        this.educationForm.patchValue({
          degree: education.degree,
          field: education.field,
          university: education.university,
          institute: education.institute,
          location: education.location || '',
          startDate: education.startDate,
          endDate: education.endDate || '',
          currentStudying: education.currentStudying,
          grade: education.grade,
          educationType: education.educationType,
          description: education.description || '',
        });
      } else {
        this.editingId.set(null);
      }

      this.showForm.set(true);
      this.cdr.markForCheck();

    } catch (error) {
      console.error('Error opening form:', error);
      if (this.isBrowser) {
        document.body.style.overflow = 'auto';
      }
      throw error;
    }
  }

  closeForm() {
    console.log('EducationsComponent: Closing form');
    this.showForm.set(false);
    this.resetForm();

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  resetForm() {
    this.educationForm.reset();
    this.educationForm.patchValue({
      degree: '',
      field: '',
      university: '',
      institute: '',
      location: '',
      startDate: '',
      endDate: '',
      currentStudying: false,
      grade: '',
      educationType: '',
      description: '',
    });
    this.editingId.set(null);
  }

  // Load educations
  async loadEducations() {
    console.log('EducationsComponent: Loading educations...');
    this.isLoading.set(true);
    try {
      const educations = await this.educationService.getAllEducations();
      educations.sort((a, b) => b.id - a.id);
      this.educations.set(educations);

      console.log(
        'EducationsComponent: Educations loaded successfully',
        educations.length,
        'educations'
      );
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading educations:', error);
      this.educations.set([]);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  get isFormValid(): boolean {
    if (!this.educationForm) {
      return false;
    }

    const isCurrentlyStudying = this.educationForm.get('currentStudying')?.value;
    const endDate = this.educationForm.get('endDate')?.value;

    // Check base validation
    const baseValid = this.educationForm.valid;

    // Additional validation for end date logic
    if (!isCurrentlyStudying && !endDate?.trim()) {
      return false;
    }

    if (isCurrentlyStudying && endDate?.trim()) {
      return false;
    }

    return baseValid;
  }

  async onSubmit() {
    console.log('EducationsComponent: Submitting form...');

    if (!this.isFormValid) {
      this.markAllFieldsAsTouched();
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.educationForm.value;

      const educationData = {
        degree: formValue.degree.trim(),
        field: formValue.field.trim(),
        university: formValue.university.trim(),
        institute: formValue.institute.trim(),
        location: formValue.location?.trim() || null,
        startDate: formValue.startDate.trim(),
        endDate: formValue.currentStudying ? null : (formValue.endDate?.trim() || null),
        currentStudying: Boolean(formValue.currentStudying),
        grade: formValue.grade.trim(),
        educationType: formValue.educationType.trim(),
        description: formValue.description?.trim() || null,
      };

      console.log('Submitting education data:', educationData);

      if (this.editingId()) {
        await this.educationService.updateEducation(
          this.editingId()!,
          educationData
        );
        console.log('Education updated successfully');
      } else {
        await this.educationService.createEducation(educationData);
        console.log('Education created successfully');
      }

      await this.loadEducations();
      this.closeForm();

      const message = this.editingId()
        ? 'Education updated successfully!'
        : 'Education created successfully!';
      alert(message);
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage =
        error.message ||
        'An error occurred while saving the education. Please try again.';
      alert(errorMessage);
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  async deleteEducation(id: number, degree: string) {
    const confirmMessage = `Are you sure you want to delete the education "${degree}"?\n\nThis action cannot be undone.`;
    if (confirm(confirmMessage)) {
      this.isLoading.set(true);
      try {
        await this.educationService.deleteEducation(id);
        await this.loadEducations();
        alert('Education deleted successfully!');
      } catch (error: any) {
        console.error('Delete error:', error);
        const errorMessage =
          error.message || 'Failed to delete education. Please try again.';
        alert(errorMessage);
      } finally {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    }
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.educationForm.controls).forEach((key) => {
      const control = this.educationForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    this.cdr.markForCheck();
  }

  // Selection Modal Management
  closeEducationSelectionModal() {
    this.showEducationSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedEducationId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  selectEducation(educationId: number) {
    this.selectedEducationId.set(educationId);
    const operation = this.selectedOperation();

    this.closeEducationSelectionModal();

    const education = this.educations().find(
      (e) => e.id === educationId
    );
    if (!education) {
      alert('Education not found');
      return;
    }

    if (operation === 'update') {
      this.openForm(education);
    } else if (operation === 'delete') {
      this.deleteEducation(educationId, education.degree);
    }
  }

  // Education Details Modal
  openEducationDetails(education: Education): void {
    this.selectedEducation.set(education);
    this.showEducationDetails.set(true);

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

  closeEducationDetails(): void {
    this.showEducationDetails.set(false);
    this.selectedEducation.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  trackByEducationId(index: number, education: Education): number {
    return education.id;
  }
}
