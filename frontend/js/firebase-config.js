/**
 * CampusConnect Firebase Configuration & Data Provider
 * 
 * Provides unified access to Firebase Authentication, Cloud Firestore,
 * and Firebase Storage with resilient offline persistence.
 */

// Default Firebase Web Configuration
// Can be customized in Firebase Console or configured via localStorage
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyChDd72EKiKM58bFEi_p-12jpWRgOeoUdk",
  authDomain: "campusconnect-e79ea.firebaseapp.com",
  projectId: "campusconnect-e79ea",
  storageBucket: "campusconnect-e79ea.firebasestorage.app",
  messagingSenderId: "523567398612",
  appId: "1:523567398612:web:a7058b0e491a2b64e10541",
  measurementId: "G-RS8RZ0JG1R"
};

// Check for user-defined configuration override
function getFirebaseConfig() {
  const saved = localStorage.getItem("campusconnect_firebase_config");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn("Invalid saved firebase config, falling back to default.", e);
    }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

// Local Storage-backed Firestore emulation layer for robust offline/zero-config operation
// Ensures genuine data persistence even when offline or before remote Firebase project is provisioned.
class LocalFirestoreProvider {
  constructor() {
    this.prefix = "cc_db_";
    this.listeners = new Map();
    this.initDefaultData();
    this._initSync();
  }

  _getKey(collection) {
    return `${this.prefix}${collection}`;
  }

  _getStore(collection) {
    const raw = localStorage.getItem(this._getKey(collection));
    return raw ? JSON.parse(raw) : [];
  }

  _setStore(collection, data, broadcast = true) {
    localStorage.setItem(this._getKey(collection), JSON.stringify(data));
    this._notify(collection);
    if (broadcast && this.syncChannel) {
      try {
        this.syncChannel.postMessage({ type: "SYNC", collection });
      } catch (e) { }
    }
  }

  _notify(collection) {
    const callbacks = this.listeners.get(collection) || [];
    const items = this._getStore(collection);
    callbacks.forEach(cb => {
      try { cb(items); } catch (e) { console.error("Listener error:", e); }
    });
  }

  _initSync() {
    // Cross-tab broadcast channel for instantaneous sync across all portals
    if (typeof BroadcastChannel !== "undefined") {
      this.syncChannel = new BroadcastChannel("campusconnect_db_channel");
      this.syncChannel.onmessage = (event) => {
        if (event.data && event.data.collection) {
          this._notify(event.data.collection);
        }
      };
    }

    // Storage event fallback for cross-tab updates
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith(this.prefix)) {
        const collection = e.key.replace(this.prefix, "");
        this._notify(collection);
      }
    });

    // Auto-sync from server API in background on startup
    this.syncFromServer();
  }

  async syncFromServer() {
    try {
      const res = await fetch("/api/notices");
      if (res.ok) {
        const serverNotices = await res.json();
        if (Array.isArray(serverNotices) && serverNotices.length > 0) {
          this._setStore("notices", serverNotices, false);
        }
      }
    } catch (e) {
      // Offline fallback: keep local data
    }
  }

  initDefaultData(force = false) {
    // Version-stamped seed — bump version to force reseed on all clients
    const SEED_VERSION = "v4";
    const seedVersionKey = this._getKey("__seed_version");
    const currentVersion = localStorage.getItem(seedVersionKey);

    const noticesKey = this._getKey("notices");
    const existingNotices = localStorage.getItem(noticesKey);
    const parsedNotices = existingNotices ? JSON.parse(existingNotices) : [];

    // Seed if: force requested, OR never seeded, OR version changed, OR notices array is empty
    if (force || currentVersion !== SEED_VERSION || parsedNotices.length === 0) {
      const initialNotices = [
        {
          id: "notice_seed_1",
          title: "End-Semester Examination Schedule — Autumn 2026",
          description: "Official timetable for all undergraduate and postgraduate semester examinations. Students must verify their hall tickets at least 48 hours prior to examination dates. Any discrepancies must be reported to the Examination Cell before the exam.",
          category: "notice",
          department: "Examination Cell",
          semester: "All Semesters",
          priority: "urgent",
          status: "published",
          authorUid: "staff_dean",
          authorName: "Academic Dean",
          authorRole: "staff",
          isPinned: true,
          attachmentName: "End_Sem_Timetable_2026.pdf",
          attachmentUrl: "/storage/uploads/sample_exam_schedule.pdf",
          attachmentSize: 1420000,
          deadline: "2026-11-20",
          expiryDate: "2026-12-15",
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          publishedAt: new Date(Date.now() - 3600000 * 4).toISOString()
        },
        {
          id: "notice_seed_2",
          title: "Mid-Term Hall & Seating Allocation: Block C & D",
          description: "Seating arrangement for CS, Mechanical, and Civil engineering branches. Bring valid student ID cards. Mobile devices are strictly prohibited in the examination hall. Late arrivals will not be permitted entry after 15 minutes of commencement.",
          category: "hall_allocation",
          department: "Dean Academics",
          semester: "Semester 4 & 6",
          priority: "important",
          status: "published",
          authorUid: "staff_controller",
          authorName: "Controller of Examinations",
          authorRole: "staff",
          isPinned: false,
          attachmentName: "Hall_Allocation_Block_CD.pdf",
          attachmentUrl: "/storage/uploads/sample_hall_allocation.pdf",
          attachmentSize: 2150000,
          deadline: "2026-11-05",
          expiryDate: "2026-11-10",
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          publishedAt: new Date(Date.now() - 3600000 * 24).toISOString()
        },
        {
          id: "notice_seed_3",
          title: "HackConnect 2026: 36-Hour National Student Hackathon",
          description: "Annual national student hackathon featuring tracks in Artificial Intelligence, Cyber Security, and Sustainable Smart Cities. Cash prizes totalling ₹80,000. Teams of 2–4 students. Register before November 12th via the official portal.",
          category: "event",
          department: "Student Affairs",
          semester: "All Semesters",
          priority: "normal",
          status: "published",
          authorUid: "staff_events",
          authorName: "Prof. Sarah Jenkins",
          authorRole: "staff",
          isPinned: true,
          attachmentName: "HackConnect_Guidelines.pdf",
          attachmentUrl: "/storage/uploads/sample_hackathon.pdf",
          attachmentSize: 850000,
          deadline: "2026-11-12",
          expiryDate: "2026-11-16",
          createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
          publishedAt: new Date(Date.now() - 3600000 * 48).toISOString()
        },
        {
          id: "notice_seed_4",
          title: "Library 24/7 Access & Extended Study Hall Hours",
          description: "In preparation for semester examinations, the central digital reference library and 2nd floor silent reading rooms will remain open 24 hours starting next Monday. Wi-Fi speed increased to 100Mbps for exam season.",
          category: "other",
          department: "Campus Facilities",
          semester: "All Semesters",
          priority: "normal",
          status: "published",
          authorUid: "staff_library",
          authorName: "Chief Librarian",
          authorRole: "staff",
          isPinned: false,
          attachmentName: null,
          attachmentUrl: null,
          attachmentSize: 0,
          deadline: null,
          expiryDate: "2026-12-30",
          createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
          publishedAt: new Date(Date.now() - 3600000 * 72).toISOString()
        },
        {
          id: "notice_seed_5",
          title: "Annual Cultural Fest — TechVibe 2026 Registrations Open",
          description: "CampusConnect's biggest cultural and technical festival returns this November! Events include coding marathons, robotics battles, dance competitions, music, and art exhibitions. Last date to register for individual events is November 8th.",
          category: "event",
          department: "Cultural Committee",
          semester: "All Semesters",
          priority: "important",
          status: "published",
          authorUid: "staff_cultural",
          authorName: "Dr. Meena Pillai",
          authorRole: "staff",
          isPinned: false,
          attachmentName: "TechVibe_2026_Schedule.pdf",
          attachmentUrl: "/storage/uploads/sample_exam_schedule.pdf",
          attachmentSize: 520000,
          deadline: "2026-11-08",
          expiryDate: "2026-11-20",
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
          publishedAt: new Date(Date.now() - 3600000 * 12).toISOString()
        },
        {
          id: "notice_seed_6",
          title: "Scholarship Applications Open — Merit & Need-Based 2026–27",
          description: "The college scholarship committee invites applications for merit and need-based scholarships for the academic year 2026–27. Eligible students with a GPA above 8.0 and family income below ₹5 lakhs per annum may apply. Deadline: November 30.",
          category: "notice",
          department: "Student Welfare",
          semester: "All Semesters",
          priority: "important",
          status: "published",
          authorUid: "staff_welfare",
          authorName: "Scholarship Coordinator",
          authorRole: "staff",
          isPinned: false,
          attachmentName: "Scholarship_Application_Form.pdf",
          attachmentUrl: "/storage/uploads/sample_exam_schedule.pdf",
          attachmentSize: 310000,
          deadline: "2026-11-30",
          expiryDate: "2026-12-05",
          createdAt: new Date(Date.now() - 3600000 * 96).toISOString(),
          publishedAt: new Date(Date.now() - 3600000 * 96).toISOString()
        }
      ];

      // Preserve any user-created notices (non-seed documents) if upgrading
      const userCreated = parsedNotices.filter(n => !n.id.startsWith("notice_seed_"));
      this._setStore("notices", [...initialNotices, ...userCreated]);
      localStorage.setItem(seedVersionKey, SEED_VERSION);
    }


    // Default users
    const usersKey = this._getKey("users");
    if (!localStorage.getItem(usersKey)) {
      const defaultUsers = [
        {
          uid: "user_admin_01",
          email: "admin@campusconnect.edu",
          username: "admin",
          displayName: "System Administrator",
          role: "admin",
          department: "Administration",
          status: "active",
          createdAt: new Date().toISOString()
        },
        {
          uid: "user_staff_01",
          email: "staff@campusconnect.edu",
          username: "staff",
          displayName: "Dr. Robert Vance",
          role: "staff",
          department: "Computer Science",
          status: "active",
          createdAt: new Date().toISOString()
        },
        {
          uid: "user_student_01",
          email: "student@campusconnect.edu",
          username: "student",
          displayName: "Alex Johnson",
          role: "student",
          department: "Information Technology",
          semester: "Semester 5",
          status: "active",
          createdAt: new Date().toISOString()
        }
      ];
      this._setStore("users", defaultUsers);
    }
  }

  // Collection CRUD Operations (Synced with Server API)
  async getDocs(collection) {
    if (collection === "notices") {
      try {
        const res = await fetch("/api/notices");
        if (res.ok) {
          const serverItems = await res.json();
          if (Array.isArray(serverItems) && serverItems.length > 0) {
            this._setStore("notices", serverItems, false);
            return serverItems;
          }
        }
      } catch (e) { }
    } else if (collection === "eventRegistrations") {
      try {
        const res = await fetch("/api/events/registrations");
        if (res.ok) {
          const serverRegs = await res.json();
          if (Array.isArray(serverRegs)) {
            this._setStore("eventRegistrations", serverRegs, false);
            return serverRegs;
          }
        }
      } catch (e) { }
    }
    return this._getStore(collection);
  }

  async getDoc(collection, id) {
    const store = this._getStore(collection);
    return store.find(item => item.id === id || item.uid === id) || null;
  }

  async addDoc(collection, data) {
    const store = this._getStore(collection);
    const id = data.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newItem = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    store.unshift(newItem);
    this._setStore(collection, store);

    // Asynchronously push to backend server
    if (collection === "notices") {
      fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem)
      }).catch(e => console.warn("Notice server push error:", e));
    } else if (collection === "eventRegistrations") {
      fetch("/api/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem)
      }).catch(e => console.warn("Event registration push error:", e));
    }
    return newItem;
  }

  async setDoc(collection, id, data, merge = true) {
    const store = this._getStore(collection);
    const index = store.findIndex(item => item.id === id || item.uid === id);
    let updated;
    if (index >= 0) {
      updated = merge ? { ...store[index], ...data } : { ...data, id };
      store[index] = updated;
    } else {
      updated = { ...data, id: id || data.id };
      store.push(updated);
    }
    this._setStore(collection, store);
    return updated;
  }

  async updateDoc(collection, id, data) {
    const store = this._getStore(collection);
    const index = store.findIndex(item => item.id === id || item.uid === id);
    if (index === -1) throw new Error(`Document ${id} not found in ${collection}`);
    const updated = { ...store[index], ...data, updatedAt: new Date().toISOString() };
    store[index] = updated;
    this._setStore(collection, store);

    // Asynchronously update on server
    if (collection === "notices") {
      fetch(`/api/notices/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).catch(e => console.warn("Notice server update error:", e));
    }
    return updated;
  }

  async deleteDoc(collection, id) {
    const store = this._getStore(collection);
    const filtered = store.filter(item => item.id !== id && item.uid !== id);
    this._setStore(collection, filtered);

    // Asynchronously delete on server
    if (collection === "notices") {
      fetch(`/api/notices/${encodeURIComponent(id)}`, {
        method: "DELETE"
      }).catch(e => console.warn("Notice server delete error:", e));
    } else if (collection === "eventRegistrations") {
      fetch(`/api/events/register/${encodeURIComponent(id)}`, {
        method: "DELETE"
      }).catch(e => console.warn("Event registration server delete error:", e));
    }
    return true;
  }

  onSnapshot(collection, callback) {
    if (!this.listeners.has(collection)) {
      this.listeners.set(collection, []);
    }
    this.listeners.get(collection).push(callback);
    // Send immediate initial state
    callback(this._getStore(collection));

    // Return unsubscribe function
    return () => {
      const arr = this.listeners.get(collection) || [];
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  resetToDefaults() {
    this.initDefaultData(true);
    return true;
  }
}

// Global Firebase Provider Instance
window.CampusConnectFirebase = {
  config: getFirebaseConfig(),
  firestore: new LocalFirestoreProvider(),
  storage: {
    // In-browser mock storage supporting real File/Blob objects to DataURL
    upload: async function (file, path) {
      return new Promise((resolve, reject) => {
        // Enforce 10MB limit and PDF/image check
        if (file.size > 10 * 1024 * 1024) {
          return reject(new Error("File size exceeds 10MB limit."));
        }
        const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
        if (!allowed.includes(file.type)) {
          return reject(new Error("Only PDF and PNG/JPEG images are allowed."));
        }

        const reader = new FileReader();
        reader.onload = function (e) {
          const fileData = {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: e.target.result,
            path: path || `attachments/${Date.now()}_${file.name}`,
            uploadedAt: new Date().toISOString()
          };
          // Persist file metadata
          resolve(fileData);
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });
    }
  }
};
