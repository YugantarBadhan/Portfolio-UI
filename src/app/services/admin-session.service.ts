// src/app/services/admin-session.service.ts - FIXED VERSION addressing page refresh logout

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { ConfigService } from './config.service';

interface AdminSession {
  token: string;
  timestamp: number;
  sessionId: string;
  browserFingerprint: string;
  isPageRefresh?: boolean; // ADDED: Flag to handle page refresh scenarios
}

@Injectable({
  providedIn: 'root'
})
export class AdminSessionService {
  private readonly ADMIN_SESSION_KEY = 'adminSession';
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly SESSION_CHECK_INTERVAL = 60 * 1000; // 1 minute
  private readonly PAGE_REFRESH_GRACE_PERIOD = 2 * 60 * 1000; // 2 minutes grace for page refresh
  
  private isBrowser: boolean;
  private currentSessionId: string = '';
  private browserFingerprint: string = '';
  private sessionCheckSubscription: any;
  private initialized: boolean = false;
  
  // Observable for authentication state
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private configService: ConfigService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    if (this.isBrowser) {
      this.initializeSession();
      this.startSessionMonitoring();
    }
  }

  /**
   * FIXED: Initialize session management with better page refresh handling
   */
  private initializeSession() {
    try {
      // Generate unique identifiers for this browser session
      this.currentSessionId = this.generateSessionId();
      this.browserFingerprint = this.generateBrowserFingerprint();
      
      console.log('AdminSessionService: Initializing session...');
      
      // FIXED: Check if this is likely a page refresh
      const navigationEntries = performance.getEntriesByType('navigation');
      const isPageRefresh = navigationEntries.length > 0 && 
        (navigationEntries[0] as PerformanceNavigationTiming).type === 'reload';
      
      // Check if there's an existing valid session
      const existingSession = this.getStoredSession();
      
      if (existingSession && this.isSessionValid(existingSession, isPageRefresh)) {
        // FIXED: Restore valid session, but update sessionId for new page load
        console.log('AdminSessionService: Restoring valid session');
        
        // Update session with new sessionId but keep other data
        const updatedSession: AdminSession = {
          ...existingSession,
          sessionId: this.currentSessionId,
          timestamp: Date.now(), // Refresh timestamp
          isPageRefresh: isPageRefresh
        };
        
        this.storeSession(updatedSession);
        this.isAuthenticatedSubject.next(true);
      } else {
        // Clear any invalid sessions
        console.log('AdminSessionService: No valid session found, starting fresh');
        this.clearSession();
        this.isAuthenticatedSubject.next(false);
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('AdminSessionService: Error during initialization:', error);
      this.clearSession();
      this.isAuthenticatedSubject.next(false);
      this.initialized = true;
    }
  }

  /**
   * Get stored session from localStorage
   */
  private getStoredSession(): AdminSession | null {
    if (!this.isBrowser) return null;
    
    try {
      const savedSession = localStorage.getItem(this.ADMIN_SESSION_KEY);
      if (savedSession) {
        return JSON.parse(savedSession) as AdminSession;
      }
    } catch (error) {
      console.error('AdminSessionService: Error retrieving session:', error);
      // Clear corrupted session
      this.clearSession();
    }
    
    return null;
  }

  /**
   * FIXED: Store session to localStorage
   */
  private storeSession(session: AdminSession): void {
    if (!this.isBrowser) return;
    
    try {
      localStorage.setItem(this.ADMIN_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('AdminSessionService: Error storing session:', error);
    }
  }

  /**
   * FIXED: Check if a session is valid with page refresh consideration
   */
  private isSessionValid(session: AdminSession, isPageRefresh: boolean = false): boolean {
    if (!session) return false;
    
    try {
      // Check expiration - use grace period for page refresh
      const now = Date.now();
      const sessionAge = now - session.timestamp;
      const timeoutPeriod = isPageRefresh ? 
        this.SESSION_TIMEOUT + this.PAGE_REFRESH_GRACE_PERIOD : 
        this.SESSION_TIMEOUT;
      
      if (sessionAge > timeoutPeriod) {
        console.log('AdminSessionService: Session expired', {
          sessionAge,
          timeoutPeriod,
          isPageRefresh
        });
        return false;
      }
      
      // Check token validity
      if (session.token !== this.configService.adminToken) {
        console.log('AdminSessionService: Invalid token');
        return false;
      }
      
      // FIXED: Be more lenient with session ID for page refresh scenarios
      if (!isPageRefresh && session.sessionId && 
          session.sessionId !== this.currentSessionId && 
          sessionAge > (5 * 60 * 1000)) { // Only check sessionId if session is older than 5 minutes
        console.log('AdminSessionService: Session ID mismatch for old session');
        return false;
      }
      
      // Check browser fingerprint - this should remain consistent
      if (session.browserFingerprint !== this.browserFingerprint) {
        console.warn('AdminSessionService: Browser fingerprint mismatch - possible security issue');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('AdminSessionService: Error validating session:', error);
      return false;
    }
  }

  /**
   * FIXED: Start monitoring session validity with better refresh handling
   */
  private startSessionMonitoring() {
    if (!this.isBrowser) return;

    try {
      // Check session validity every minute
      this.sessionCheckSubscription = interval(this.SESSION_CHECK_INTERVAL).subscribe(() => {
        if (this.isAuthenticatedSubject.value) {
          this.checkSessionValidity();
        }
      });

      // Listen for storage changes (other tabs)
      window.addEventListener('storage', (event) => {
        if (event.key === this.ADMIN_SESSION_KEY) {
          if (!event.newValue && this.isAuthenticatedSubject.value) {
            // Session was cleared in another tab
            this.handleSessionInvalidation('Session cleared in another tab');
          }
        }
      });

      // FIXED: Only clear session on intentional navigation away, not page refresh
      window.addEventListener('beforeunload', (event) => {
        // Don't clear session on page refresh - let the session timeout handle expiration
        // This allows for proper session restoration on page reload
        console.log('AdminSessionService: beforeunload triggered - preserving session for potential refresh');
      });

      // FIXED: Handle page visibility changes for better session management
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isAuthenticatedSubject.value) {
          // Page became visible again - extend session
          this.extendSession();
        }
      });
    } catch (error) {
      console.error('AdminSessionService: Error starting session monitoring:', error);
    }
  }

  /**
   * FIXED: Authenticate admin user with proper session creation
   */
  authenticate(token: string): boolean {
    if (!this.isBrowser) return false;

    try {
      console.log('AdminSessionService: Attempting authentication...');
      
      if (token !== this.configService.adminToken) {
        console.log('AdminSessionService: Authentication failed - invalid token');
        return false;
      }

      const session: AdminSession = {
        token: token,
        timestamp: Date.now(),
        sessionId: this.currentSessionId,
        browserFingerprint: this.browserFingerprint,
        isPageRefresh: false
      };

      this.storeSession(session);
      this.isAuthenticatedSubject.next(true);
      
      console.log('AdminSessionService: Authentication successful');
      return true;
    } catch (error) {
      console.error('AdminSessionService: Error during authentication:', error);
      return false;
    }
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * FIXED: Logout admin user with proper cleanup
   */
  logout(): void {
    console.log('AdminSessionService: Logout initiated');
    this.clearSession();
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Force logout with reason
   */
  forceLogout(reason: string): void {
    console.log(`AdminSessionService: Force logout - ${reason}`);
    this.logout();
    
    // Show user notification after a short delay to ensure UI is ready
    setTimeout(() => {
      if (this.isBrowser) {
        alert(`Admin session ${reason.toLowerCase()}. Please authenticate again.`);
      }
    }, 100);
  }

  /**
   * FIXED: Check session validity with better refresh handling
   */
  private checkSessionValidity(): void {
    if (!this.isBrowser || !this.initialized) return;

    try {
      const savedSession = this.getStoredSession();
      
      if (!savedSession) {
        this.handleSessionInvalidation('Session not found in storage');
        return;
      }
      
      // Check if this could be a recent page refresh
      const sessionAge = Date.now() - savedSession.timestamp;
      const isRecentSession = sessionAge < (5 * 60 * 1000); // 5 minutes
      
      if (!this.isSessionValid(savedSession, isRecentSession)) {
        this.handleSessionInvalidation('Session validation failed');
        return;
      }

      // Session is valid - extend it if it's getting old
      if (sessionAge > (this.SESSION_TIMEOUT * 0.7)) { // Extend when 70% expired
        this.extendSession();
      }

    } catch (error) {
      console.error('AdminSessionService: Error checking session validity:', error);
      this.handleSessionInvalidation('Session validation error');
    }
  }

  /**
   * Handle session invalidation
   */
  private handleSessionInvalidation(reason: string): void {
    console.warn(`AdminSessionService: Session invalidated - ${reason}`);
    
    if (this.isAuthenticatedSubject.value) {
      this.forceLogout(reason);
    }
  }

  /**
   * Clear session data
   */
  private clearSession(): void {
    if (!this.isBrowser) return;

    try {
      localStorage.removeItem(this.ADMIN_SESSION_KEY);
      localStorage.removeItem('adminToken'); // Remove legacy token storage
    } catch (error) {
      console.error('AdminSessionService: Error clearing session:', error);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate browser fingerprint for additional security
   */
  private generateBrowserFingerprint(): string {
    if (!this.isBrowser) return 'server';

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Browser fingerprint', 2, 2);
      }
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset().toString(),
        canvas.toDataURL()
      ].join('|');

      // Create a simple hash
      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return 'fp_' + Math.abs(hash).toString(36);
    } catch (error) {
      console.error('AdminSessionService: Error generating fingerprint:', error);
      // Fallback fingerprint
      return 'fp_' + Date.now().toString(36);
    }
  }

  /**
   * FIXED: Extend session (refresh timestamp) with proper session update
   */
  extendSession(): void {
    if (!this.isBrowser || !this.isAuthenticated()) return;

    try {
      const savedSession = this.getStoredSession();
      if (savedSession) {
        const updatedSession: AdminSession = {
          ...savedSession,
          timestamp: Date.now(), // Refresh timestamp
          sessionId: this.currentSessionId // Update with current session ID
        };
        this.storeSession(updatedSession);
        console.log('AdminSessionService: Session extended');
      }
    } catch (error) {
      console.error('AdminSessionService: Error extending session:', error);
    }
  }

  /**
   * Get session info
   */
  getSessionInfo(): { isAuthenticated: boolean; timeRemaining: number; sessionAge: number } {
    if (!this.isBrowser || !this.isAuthenticated()) {
      return { isAuthenticated: false, timeRemaining: 0, sessionAge: 0 };
    }

    try {
      const savedSession = this.getStoredSession();
      if (savedSession) {
        const now = Date.now();
        const elapsed = now - savedSession.timestamp;
        const remaining = Math.max(0, this.SESSION_TIMEOUT - elapsed);
        
        return {
          isAuthenticated: true,
          timeRemaining: remaining,
          sessionAge: elapsed
        };
      }
    } catch (error) {
      console.error('AdminSessionService: Error getting session info:', error);
    }

    return { isAuthenticated: false, timeRemaining: 0, sessionAge: 0 };
  }

  /**
   * FIXED: Check if service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup service
   */
  ngOnDestroy(): void {
    if (this.sessionCheckSubscription) {
      this.sessionCheckSubscription.unsubscribe();
    }
  }
}