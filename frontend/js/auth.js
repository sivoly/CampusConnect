/**
 * CampusConnect Authentication Client
 * 
 * Manages user authentication, session persistence, role validation,
 * and secure redirects between Student, Staff, and Admin dashboards.
 */

class AuthManager {
  constructor() {
    this.sessionKey = "campusconnect_auth_session";
    this.currentUser = null;
    this.init();
  }

  init() {
    const saved = localStorage.getItem(this.sessionKey);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        localStorage.removeItem(this.sessionKey);
      }
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  async login(identifier, password) {
    if (!identifier || !password) {
      throw new Error("Please enter both username/email and password.");
    }

    const cleanId = identifier.trim().toLowerCase();
    const users = await window.CampusConnectFirebase.firestore.getDocs("users");

    // Match by email or username
    const user = users.find(u => 
      (u.email && u.email.toLowerCase() === cleanId) || 
      (u.username && u.username.toLowerCase() === cleanId)
    );

    if (!user) {
      throw new Error("Invalid credentials. Please check your username/email and password.");
    }

    // Verify password if stored, or match default demo convention
    const expectedPassword = user.password || `${user.username}123`;
    if (user.password ? user.password !== password : expectedPassword !== password) {
      throw new Error("Incorrect password. Please verify your password and try again.");
    }

    if (user.status === "inactive") {
      throw new Error("This account is currently deactivated. Please contact the administrator.");
    }

    // Set authenticated session (with password never stored in session)
    this.currentUser = {
      uid: user.uid,
      email: user.email,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role, // 'student' | 'staff' | 'admin'
      department: user.department || "General",
      status: user.status
    };

    localStorage.setItem(this.sessionKey, JSON.stringify(this.currentUser));

    // Audit log login
    await window.CampusConnectDB.logAudit({
      action: "user_login",
      targetType: "user",
      targetId: user.uid,
      details: `User ${user.username} (${user.role}) logged in.`
    });

    return this.currentUser;
  }

  async register(data) {
    const { email, username, password, displayName, department, role, semester } = data;
    if (!email || !username || !password) {
      throw new Error("Email, username, and password are required.");
    }

    if (username.trim().length < 3) {
      throw new Error("Username must be at least 3 characters.");
    }

    if (password.length < 4) {
      throw new Error("Password must be at least 4 characters.");
    }

    const users = await window.CampusConnectFirebase.firestore.getDocs("users");
    const existing = users.find(u => 
      (u.email && u.email.toLowerCase() === email.trim().toLowerCase()) ||
      (u.username && u.username.toLowerCase() === username.trim().toLowerCase())
    );

    if (existing) {
      throw new Error("An account with that email or username already exists.");
    }

    // Supported user roles for self-registration: student or staff
    const assignedRole = (role === "staff") ? "staff" : "student";

    const newUser = {
      uid: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: email.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
      displayName: displayName ? displayName.trim() : username.trim(),
      role: assignedRole,
      department: department ? department.trim() : "General",
      semester: semester || (assignedRole === "student" ? "Semester 1" : ""),
      status: "active",
      password: password,
      createdAt: new Date().toISOString()
    };

    await window.CampusConnectFirebase.firestore.addDoc("users", newUser);

    // Auto-login newly registered user
    return this.login(newUser.username, password);
  }

  async logout() {
    if (this.currentUser) {
      await window.CampusConnectDB.logAudit({
        action: "user_logout",
        targetType: "user",
        targetId: this.currentUser.uid,
        details: `User ${this.currentUser.username} logged out.`
      });
    }
    this.currentUser = null;
    localStorage.removeItem(this.sessionKey);
    window.location.href = "/login";
  }

  getDashboardUrl(role) {
    switch (role) {
      case "admin":
        return "/admin";
      case "staff":
        return "/staff";
      case "student":
      default:
        return "/student";
    }
  }

  /**
   * Route Guard: verifies authentication and permitted roles.
   * Redirects to /login if unauthenticated, or to appropriate role dashboard if forbidden.
   */
  requireRole(allowedRoles = []) {
    if (!this.isAuthenticated()) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(this.currentUser.role)) {
      alert(`Access Restricted: This page requires ${allowedRoles.join(" or ")} privileges.`);
      window.location.href = this.getDashboardUrl(this.currentUser.role);
      return false;
    }

    return true;
  }
}

window.CampusConnectAuth = new AuthManager();
