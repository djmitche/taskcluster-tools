import UserSession from './UserSession';

import { renew as auth0Renew } from './auth0';

/**
 * Controller for authentication-related pieces of the site.
 *
 * This encompasses knowledge of which authentication mechanisms are enabled, including credentials menu
 * items, ongoing expiration monitoring, and any additional required UI.  It also handles synchronizing
 * sign-in status across tabs.
 */
export default class AuthController {
  constructor() {
    this.userSessionChangedCallbacks = [];
    this.renewalTimer = null;

    window.addEventListener('storage', ({ storageArea, key }) => {
      if (storageArea === localStorage && key === 'userSession') {
        this.loadUserSession();
      }
    });

    this.setUserSession = this.setUserSession.bind(this);
  }

  /**
   * Determine whether the given sign-in method is enabled.  This is a static configuration
   * of the site and will not change at runtime.
   */
  canSignInUsing(method) {
    return process.env.SIGN_IN_METHODS.includes(method);
  }

  /**
   * Reset the renewal timer based on the given user session.
   */
  resetRenewalTimer(userSession) {
    if (this.renewalTimer) {
      window.clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }

    if (userSession && userSession.renewAfter) {
      let timeout = Math.max(0, new Date(userSession.renewAfter) - new Date());

      // if the timeout is in the future, apply up to a few minutes to it
      // randomly.  This avoids multiple tabs all trying to renew at the
      // same time.
      if (timeout > 0) {
        timeout += Math.random() * 5 * 60 * 1000;
      }

      this.renewalTimer = window.setTimeout(() => {
        this.renewalTimer = null;
        this.renew({ userSession });
      }, timeout);
    }
  }

  /**
   * Load the current user session (from localStorage).
   *
   * This will call the onUserSessionChanged callbacks, but does not
   * return the user session.
   */
  loadUserSession() {
    const storedUserSession = localStorage.getItem('userSession');
    const userSession = storedUserSession ?
      UserSession.deserialize(storedUserSession) :
      null;

    this.resetRenewalTimer(userSession);
    this.userSessionChangedCallbacks.forEach(cb => cb(userSession));
  }

  /**
   * Set the current user session, or (if null) delete the current user session.
   *
   * This will change the user session in all open windows/tabs, eventually triggering
   * a call to any onSessionChanged callbacks.
   */
  setUserSession(userSession) {
    if (!userSession) {
      localStorage.removeItem('userSession');
    } else {
      localStorage.setItem('userSession', userSession.serialize());
    }

    // localStorage updates do not trigger event listeners on the current window/tab,
    // so invoke it directly
    this.loadUserSession();
  }

  /**
   * Renew the user session.  This is not possible for all auth methods, and will trivially succeed
   * for methods that do not support it.  If it fails, the user will be logged out.
   */
  async renew({ userSession }) {
    try {
      if (this.canSignInUsing('auth0')) {
        await auth0Renew({ userSession, authController: this });
      }
    } catch (err) {
      this.setUserSession(null);
      // usually this is just "user interaction required" or the like, but just
      // in case the user wants to peek, put it in the console
      /* eslint-disable no-console */
      console.error('Could not renew login:', err);
    }
  }

  /**
   * Register to get a callback with a UserSession (or null) every time the user session changes.
   * This is typically reflected into state at the top level and handed down as properties.
   */
  onUserSessionChanged(callback) {
    this.userSessionChangedCallbacks.push(callback);
  }
}
