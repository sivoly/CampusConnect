/**
 * CampusConnect Database Client (Firestore Operations)
 * 
 * Provides unified, verified CRUD functions, real-time subscriptions,
 * attachment management, bookmarking, and audit logging.
 */

class DatabaseClient {
  constructor() {
    this.fs = window.CampusConnectFirebase.firestore;
    this.storage = window.CampusConnectFirebase.storage;
  }

  /* ------------------- Notices Operations ------------------- */

  /**
   * Subscribe to real-time changes on the notices collection.
   */
  subscribeNotices(callback) {
    return this.fs.onSnapshot("notices", (allNotices) => {
      // Sort pinned notices first, then newest published/updated date
      const sorted = [...allNotices].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      callback(sorted);
    });
  }

  async getAllNotices() {
    return this.fs.getDocs("notices");
  }

  async getNoticeById(id) {
    return this.fs.getDoc("notices", id);
  }

  async createNotice(noticeData) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser || !["staff", "admin"].includes(authUser.role)) {
      throw new Error("Unauthorized: Only Staff and Admin accounts can publish or draft notices.");
    }

    if (!noticeData.title || noticeData.title.trim().length === 0) {
      throw new Error("Notice title is required.");
    }

    const payload = {
      ...noticeData,
      title: noticeData.title.trim(),
      description: noticeData.description ? noticeData.description.trim() : "",
      category: noticeData.category || "notice",
      department: noticeData.department || authUser.department || "General",
      semester: noticeData.semester || "All",
      priority: noticeData.priority || "normal",
      status: noticeData.status || "published", // 'draft' or 'published'
      authorUid: authUser.uid,
      authorName: authUser.displayName,
      authorRole: authUser.role,
      isPinned: Boolean(noticeData.isPinned),
      createdAt: new Date().toISOString(),
      publishedAt: noticeData.status === "published" ? new Date().toISOString() : null
    };

    const savedNotice = await this.fs.addDoc("notices", payload);

    await this.logAudit({
      action: "notice_create",
      targetType: "notice",
      targetId: savedNotice.id,
      details: `Created notice "${payload.title}" (${payload.status}).`
    });

    return savedNotice;
  }

  async updateNotice(id, updates) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser || !["staff", "admin"].includes(authUser.role)) {
      throw new Error("Unauthorized: Insufficient permissions to update notices.");
    }

    const existing = await this.getNoticeById(id);
    if (!existing) throw new Error("Notice not found.");

    if (updates.status === "published" && !existing.publishedAt) {
      updates.publishedAt = new Date().toISOString();
    }

    const updated = await this.fs.updateDoc("notices", id, updates);

    await this.logAudit({
      action: "notice_update",
      targetType: "notice",
      targetId: id,
      details: `Updated notice "${updated.title}".`
    });

    return updated;
  }

  async deleteNotice(id) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser || !["staff", "admin"].includes(authUser.role)) {
      throw new Error("Unauthorized: Only Staff or Admin can delete notices.");
    }

    const notice = await this.getNoticeById(id);
    await this.fs.deleteDoc("notices", id);

    await this.logAudit({
      action: "notice_delete",
      targetType: "notice",
      targetId: id,
      details: `Deleted notice "${notice ? notice.title : id}".`
    });

    return true;
  }

  /* ------------------- Attachments / Storage ------------------- */

  async uploadAttachment(file) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser || !["staff", "admin"].includes(authUser.role)) {
      throw new Error("Unauthorized to upload files.");
    }

    const result = await this.storage.upload(file);
    return {
      fileName: result.name,
      fileUrl: result.dataUrl,
      fileSize: result.size,
      fileType: result.type
    };
  }

  /* ------------------- Bookmarks ------------------- */

  async getBookmarks(userUid) {
    const all = await this.fs.getDocs("bookmarks");
    return all.filter(b => b.uid === userUid).map(b => b.noticeId);
  }

  async toggleBookmark(noticeId) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser) throw new Error("Must be logged in to bookmark notices.");

    const bookmarks = await this.fs.getDocs("bookmarks");
    const existing = bookmarks.find(b => b.uid === authUser.uid && b.noticeId === noticeId);

    if (existing) {
      await this.fs.deleteDoc("bookmarks", existing.id);
      return false; // Removed
    } else {
      await this.fs.addDoc("bookmarks", {
        uid: authUser.uid,
        noticeId: noticeId,
        createdAt: new Date().toISOString()
      });
      return true; // Added
    }
  }

  /* ------------------- Read Status Tracking ------------------- */

  async markAsRead(noticeId) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser) return;

    const reads = await this.fs.getDocs("readStatus");
    const existing = reads.find(r => r.uid === authUser.uid && r.noticeId === noticeId);
    if (!existing) {
      await this.fs.addDoc("readStatus", {
        uid: authUser.uid,
        noticeId: noticeId,
        readAt: new Date().toISOString()
      });
    }
  }

  async getReadNotices(userUid) {
    const all = await this.fs.getDocs("readStatus");
    return all.filter(r => r.uid === userUid).map(r => r.noticeId);
  }

  /* ------------------- User & Admin Management ------------------- */

  async getAllUsers() {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser || authUser.role !== "admin") {
      throw new Error("Unauthorized: Administrator access required.");
    }
    return this.fs.getDocs("users");
  }

  async updateUserRole(uid, newRole) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser || authUser.role !== "admin") {
      throw new Error("Unauthorized: Only administrators can assign roles.");
    }

    if (uid === authUser.uid && newRole !== "admin") {
      throw new Error("Self-Demotion Prevented: You cannot remove your own administrator status.");
    }

    const updated = await this.fs.updateDoc("users", uid, { role: newRole });

    await this.logAudit({
      action: "user_role_change",
      targetType: "user",
      targetId: uid,
      details: `Changed role of user ${updated.username || uid} to ${newRole}.`
    });

    return updated;
  }

  async toggleUserStatus(uid) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser || authUser.role !== "admin") {
      throw new Error("Unauthorized: Only administrators can modify account statuses.");
    }

    if (uid === authUser.uid) {
      throw new Error("Self-Deactivation Prevented: You cannot deactivate your own administrator account.");
    }

    const user = await this.fs.getDoc("users", uid);
    if (!user) throw new Error("User not found.");

    const newStatus = user.status === "active" ? "inactive" : "active";
    const updated = await this.fs.updateDoc("users", uid, { status: newStatus });

    await this.logAudit({
      action: "user_status_change",
      targetType: "user",
      targetId: uid,
      details: `Account status for ${user.username} set to ${newStatus}.`
    });

    return updated;
  }

  /* ------------------- Audit Logging ------------------- */

  async logAudit(logData) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    const entry = {
      actorUid: authUser ? authUser.uid : "system",
      actorName: authUser ? authUser.displayName : "System",
      actorRole: authUser ? authUser.role : "system",
      action: logData.action,
      targetType: logData.targetType,
      targetId: logData.targetId,
      details: logData.details,
      timestamp: new Date().toISOString()
    };
    return this.fs.addDoc("auditLogs", entry);
  }

  async getAuditLogs() {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser || authUser.role !== "admin") {
      throw new Error("Unauthorized: Only administrators can inspect audit records.");
    }
    const logs = await this.fs.getDocs("auditLogs");
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  /* ------------------- Event Registrations (RSVP) ------------------- */

  async getRegisteredEvents(userUid) {
    const all = await this.fs.getDocs("eventRegistrations");
    return all.filter(r => r.uid === userUid);
  }

  async isRegisteredForEvent(noticeId, userUid) {
    const all = await this.fs.getDocs("eventRegistrations");
    return all.some(r => r.uid === userUid && r.noticeId === noticeId);
  }

  async registerForEvent(noticeId, eventDetails = {}) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser) throw new Error("Must be logged in to register for events.");

    const registrations = await this.fs.getDocs("eventRegistrations");
    const existing = registrations.find(r => r.uid === authUser.uid && r.noticeId === noticeId);

    if (existing) {
      return existing;
    }

    const newRegistration = {
      uid: authUser.uid,
      userName: authUser.displayName,
      userEmail: authUser.email,
      department: authUser.department,
      noticeId: noticeId,
      eventTitle: eventDetails.title || "Campus Event",
      eventCategory: eventDetails.category || "event",
      eventDate: eventDetails.deadline || eventDetails.createdAt || new Date().toISOString(),
      eventDepartment: eventDetails.department || "Student Affairs",
      status: "confirmed",
      registeredAt: new Date().toISOString()
    };

    const saved = await this.fs.addDoc("eventRegistrations", newRegistration);

    await this.logAudit({
      action: "event_registration",
      targetType: "event",
      targetId: noticeId,
      details: `${authUser.displayName} registered for event "${newRegistration.eventTitle}".`
    });

    return saved;
  }

  async cancelEventRegistration(noticeId) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    if (!authUser) throw new Error("Must be logged in.");

    const registrations = await this.fs.getDocs("eventRegistrations");
    const existing = registrations.find(r => r.uid === authUser.uid && r.noticeId === noticeId);

    if (existing) {
      await this.fs.deleteDoc("eventRegistrations", existing.id);
      await this.logAudit({
        action: "event_cancel_registration",
        targetType: "event",
        targetId: noticeId,
        details: `${authUser.displayName} cancelled registration for event.`
      });
      return true;
    }
    return false;
  }

  async getRegisteredEvents(uid) {
    const authUser = window.CampusConnectAuth.getCurrentUser();
    const targetUid = uid || (authUser && authUser.uid);
    if (!targetUid) return [];
    const registrations = await this.fs.getDocs("eventRegistrations");
    return registrations.filter(r => r.uid === targetUid);
  }
}


window.CampusConnectDB = new DatabaseClient();
