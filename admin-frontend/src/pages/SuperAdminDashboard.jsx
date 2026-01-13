// src/pages/SuperAdminDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api"; // baseURL already set in your project
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo-surjit.png";
import * as XLSX from 'xlsx';

const SuperAdminDashboard = () => {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  // Tabs: admins management, dealers, recent activity, summary
  const [tab, setTab] = useState("admins");

  // Admins data
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Available workflow stages (actual processing stages, not application statuses)
  // Note: Also accept "disbursed" as alias for "disbursement"
  const availableWorkflows = [
    "contact creation",
    "cibil",
    "housevisit",
    "document collection",
    "credit sanction",
    "agreement",
    "pre-disbursement documentation",
    "disbursement"
  ];

  // Map aliases to canonical names (e.g., "disbursed" -> "disbursement")
  const workflowAliases = {
    "disbursed": "disbursement"
  };

  // Create admin form
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin",
    selectedWorkflows: ["contact creation", "cibil", "housevisit", "document collection", "credit sanction", "agreement", "pre-disbursement documentation", "disbursement"], // All workflow stages by default
  });

  // Edit admin state
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin",
    selectedWorkflows: [],
  });

  // Password visibility states
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Dealers data
  const [dealers, setDealers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  
  // Create dealer form (single)
  const [dealerForm, setDealerForm] = useState({
    email: "",
    password: "",
    UserId: "",
    name: "",
    District: "",
    Branch: "",
    Contact: "",
  });
  const [showDealerPassword, setShowDealerPassword] = useState(false);

  // Bulk create dealer form
  // const [bulkDealersText, setBulkDealersText] = useState("");
  const [bulkCreateMode, setBulkCreateMode] = useState("single"); // "single" or "bulk"
  const [bulkUploadMode, setBulkUploadMode] = useState("text"); // "text" or "excel"
  const [bulkDealersData, setBulkDealersData] = useState([]);
  const fileInputRef = useRef(null);
  const [nextUserId, setNextUserId] = useState(1000);

  // Edit dealer state
  const [editingDealer, setEditingDealer] = useState(null);
  const [editDealerForm, setEditDealerForm] = useState({
    email: "",
    password: "",
    UserId: "",
    name: "",
    District: "",
    Branch: "",
    Contact: "",
  });
  const [showEditDealerPassword, setShowEditDealerPassword] = useState(false);

  // Update edit form when editingAdmin changes
  useEffect(() => {
    if (editingAdmin) {
      // console.log("========== EDIT ADMIN DEBUG ==========");
      // console.log("Admin name:", editingAdmin.name);
      // console.log("Admin workflows (raw):", editingAdmin.workflows);
      // console.log("Admin workflows type:", typeof editingAdmin.workflows);
      // console.log("Admin workflows isArray:", Array.isArray(editingAdmin.workflows));
      // console.log("Admin workflows JSON:", JSON.stringify(editingAdmin.workflows));

      // Normalize workflows: handle nested arrays and ensure all are strings
      let workflows = [];
      const normalizedAvailable = availableWorkflows.map(w => w.trim().toLowerCase());
      
      // Helper to normalize a workflow value
      const normalizeWorkflowValue = (value) => {
        if (typeof value === 'string') {
          // Remove quotes if present
          let cleaned = value.trim().replace(/^["']|["']$/g, '');
          cleaned = cleaned.trim().toLowerCase();
          
          // Map aliases to canonical names
          if (workflowAliases[cleaned]) {
            cleaned = workflowAliases[cleaned];
          }
          
          return cleaned;
        }
        return (value?.toString() || '').trim().toLowerCase();
      };
      
      if (Array.isArray(editingAdmin.workflows)) {
        // Flatten nested arrays and normalize strings
        const flattened = editingAdmin.workflows.flat(); // Flatten nested arrays like [["contact creation", ...]]
        // console.log("useEffect: flattened workflows:", flattened);
        
        workflows = flattened
          .map(w => {
            let normalized = normalizeWorkflowValue(w);
            // Map to canonical name (e.g., "disbursed" -> "disbursement")
            if (workflowAliases[normalized]) {
              console.log(`  Mapping alias: "${normalized}" -> "${workflowAliases[normalized]}"`);
              normalized = workflowAliases[normalized];
            }
            // console.log(`  Processing: "${w}" -> "${normalized}"`);
            return normalized;
          })
          .filter(w => {
            const isValid = w && normalizedAvailable.includes(w);
            if (!isValid && w) {
              console.log(`  ⚠️ Filtered out: "${w}" (not in available workflows)`);
              console.log(`  Available workflows:`, normalizedAvailable);
            }
            return isValid;
          });
      } else if (typeof editingAdmin.workflows === 'string') {
        console.log("Workflows is a string, attempting to parse...");
        // Try to parse as JSON first, then fall back to comma-separated
        let workflowArray = [];
        try {
          const parsed = JSON.parse(editingAdmin.workflows);
          console.log("  Parsed as JSON:", parsed);
          workflowArray = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          console.log("  Not valid JSON, treating as comma-separated string");
          // Remove surrounding brackets/quotes if present
          let cleaned = editingAdmin.workflows.trim();
          cleaned = cleaned.replace(/^\[|\]$/g, ''); // Remove array brackets
          cleaned = cleaned.replace(/^"|"$/g, ''); // Remove surrounding quotes
          workflowArray = cleaned.split(/[,\n]+/).filter(w => w.trim());
        }
        
        console.log("  workflowArray:", workflowArray);
        
        workflows = workflowArray
          .map(w => {
            let normalized = normalizeWorkflowValue(w);
            // Map to canonical name
            if (workflowAliases[normalized]) {
              normalized = workflowAliases[normalized];
            }
            return normalized;
          })
          .filter(w => {
            const isValid = w && normalizedAvailable.includes(w);
            if (!isValid && w) {
              console.log(`  ⚠️ Filtered out: "${w}" (not in available workflows)`);
            }
            return isValid;
          });
      } else if (editingAdmin.workflows) {
        console.log("Workflows is other type, attempting to convert...");
        workflows = [editingAdmin.workflows]
          .flat()
          .map(w => normalizeWorkflowValue(w))
          .filter(w => w && normalizedAvailable.includes(w));
      }
      
      // console.log("Final processed workflows:", workflows);
      // console.log("Normalized available workflows:", normalizedAvailable);
      // console.log("=====================================");

      // console.log("useEffect: processed workflows (normalized):", workflows);
      // console.log("useEffect: availableWorkflows:", availableWorkflows);

      setEditForm({
        name: editingAdmin.name || "",
        email: editingAdmin.email || "",
        password: "",
        role: editingAdmin.role || "admin",
        selectedWorkflows: workflows,
      });

      // console.log("useEffect: edit form updated with selectedWorkflows:", workflows);
    } else {
      // Reset form when not editing
      setEditForm({
        name: "",
        email: "",
        password: "",
        role: "admin",
        selectedWorkflows: [],
      });
    }
  }, [editingAdmin]);

  // Recent logs + summary
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const [summary, setSummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Stats data
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);

  // Files data
  const [allFiles, setAllFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesTab, setFilesTab] = useState("pending"); // pending, approved, rejected

  // Admin activity modal
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminActivity, setAdminActivity] = useState({ files: [], totalActions: 0, admin: null });
  const [loadingAdminActivity, setLoadingAdminActivity] = useState(false);

  const [busy, setBusy] = useState(false);

  const gridRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  // Get selected workflows for the current form
  const stageArray = useMemo(
    () => editingAdmin ? editForm.selectedWorkflows : form.selectedWorkflows,
    [form.selectedWorkflows, editForm.selectedWorkflows, editingAdmin]
  );

  const styles = {
    userBtn: {
      border: "1px solid #e5e7eb",
      background: "#fff",
      padding: "8px 10px",
      borderRadius: 10,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
  };

  const authHeaders = () => {
    const token = localStorage.getItem("adminToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
    // NOTE: your protect middleware reads Bearer token; this matches your Admin dashboard pattern
  };

  // ===== API Calls (keep identical patterns to your Admin Dashboard) =====
  const fetchAdmins = React.useCallback(async () => {
    try {
      setLoadingAdmins(true);
      const { data } = await API.get("/superadmin/admins", {
        headers: authHeaders(),
      });
      setAdmins(Array.isArray(data?.admins) ? data.admins : []);
    } catch (err) {
      console.error("Failed to load admins", err?.response?.data || err.message);
      setAdmins([]);
    } finally {
      setLoadingAdmins(false);
    }
  }, []);

  const fetchRecent = React.useCallback(async () => {
    try {
      setLoadingRecent(true);
      const { data } = await API.get("/superadmin/dashboard/recent?limit=25", {
        headers: authHeaders(),
      });
      setRecent(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      console.error("Failed to load recent activity", err?.response?.data || err.message);
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const fetchSummary = React.useCallback(async () => {
    try {
      setLoadingSummary(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const qs = params.toString();
      const { data } = await API.get(`/superadmin/dashboard/summary${qs ? `?${qs}` : ""}`, {
        headers: authHeaders(),
      });
      setSummary(Array.isArray(data?.summary) ? data.summary : []);
    } catch (err) {
      console.error("Failed to load summary", err?.response?.data || err.message);
      setSummary([]);
    } finally {
      setLoadingSummary(false);
    }
  }, [dateFrom, dateTo]);

  const fetchStats = React.useCallback(async () => {
    try {
      setLoadingStats(true);
      const { data } = await API.get("/superadmin/dashboard/stats", {
        headers: authHeaders(),
      });
      setStats(data?.stats || {});
    } catch (err) {
      console.error("Failed to load stats", err?.response?.data || err.message);
      setStats({});
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchAllFiles = React.useCallback(async (type = "pending") => {
    try {
      setLoadingFiles(true);
      const { data } = await API.get(`/superadmin/files/${type}`, {
        headers: authHeaders(),
      });
      setAllFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Failed to load ${type} files`, err?.response?.data || err.message);
      setAllFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const fetchDealers = React.useCallback(async () => {
    try {
      setLoadingDealers(true);
      const { data } = await API.get("/superadmin/dealers", {
        headers: authHeaders(),
      });
      setDealers(Array.isArray(data?.dealers) ? data.dealers : []);
    } catch (err) {
      console.error("Failed to load dealers", err?.response?.data || err.message);
      setDealers([]);
    } finally {
      setLoadingDealers(false);
    }
  }, []);

  const fetchAdminActivity = React.useCallback(async (adminId) => {
    try {
      setLoadingAdminActivity(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const qs = params.toString();
      const { data } = await API.get(`/superadmin/dashboard/admin/${adminId}/activity${qs ? `?${qs}` : ""}`, {
        headers: authHeaders(),
      });
      setAdminActivity({
        files: Array.isArray(data?.files) ? data.files : [],
        totalActions: data?.totalActions || 0,
        admin: data?.admin || null
      });
    } catch (err) {
      console.error("Failed to load admin activity", err?.response?.data || err.message);
      setAdminActivity({ files: [], totalActions: 0, admin: null });
    } finally {
      setLoadingAdminActivity(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    // Gate: only superadmin should see this page. If not, bounce.
    if (!admin) {
      navigate("/");
      return;
    }
    if (admin?.role !== "superadmin") {
      navigate("/"); // or to /admin-dashboard if you prefer
      return;
    }
    // load initial tab
    fetchAdmins();
    fetchRecent();
    fetchSummary();
    fetchStats();
    fetchDealers();
  }, [admin, navigate, fetchAdmins, fetchRecent, fetchSummary, fetchStats, fetchDealers]);

  // Auto-fetch files when switching to Files tab or changing the files sub-tab
  useEffect(() => {
    if (tab === "files") {
      fetchAllFiles(filesTab);
    }
  }, [tab, filesTab, fetchAllFiles]);

  // Auto-fetch dealers when switching to Dealers tab
  useEffect(() => {
    if (tab === "dealers") {
      fetchDealers();
    }
  }, [tab, fetchDealers]);

  // Update edit dealer form when editingDealer changes
  useEffect(() => {
    if (editingDealer) {
      setEditDealerForm({
        email: editingDealer.email || "",
        password: "",
        UserId: editingDealer.UserId || "",
        name: editingDealer.name || "",
        District: editingDealer.District || "",
        Branch: editingDealer.Branch || "",
        Contact: editingDealer.Contact || "",
      });
      setShowEditDealerPassword(false);
    } else {
      setEditDealerForm({
        email: "",
        password: "",
        UserId: "",
        name: "",
        District: "",
        Branch: "",
        Contact: "",
      });
    }
  }, [editingDealer]);

  // ===== Handlers =====
  const handleLogout = () => {
    try {
      if (typeof logout === "function") logout();
    } catch (e) {
      console.warn("logout() threw:", e);
    }
    try {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminInfo");
    } catch (err) {
      console.warn("Failed to clear admin tokens:", err);
    }
    navigate("/");
  };

  const createAdmin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await API.post(
        "/superadmin/admins",
        {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          workflows: stageArray,
        },
        { headers: authHeaders() }
      );
      // reset name/email/password, keep workflows text as-is for faster multiple entries
      setForm((f) => ({ ...f, name: "", email: "", password: "" }));
      setShowCreatePassword(false);
      await fetchAdmins();
      setTab("admins");
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: "smooth" }), 120);
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create admin");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id, isActive) => {
    if (!id) {
      alert("Admin ID is missing");
      return;
    }
    
    // Ensure isActive is a boolean
    const newActiveStatus = Boolean(isActive);
    
    setBusy(true);
    try {
      const response = await API.patch(
        "/superadmin/admins/toggle",
        { adminId: id, isActive: newActiveStatus },
        { headers: authHeaders() }
      );
      await fetchAdmins();
      alert(response?.data?.message || "Admin status updated successfully");
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to toggle";
      console.error("Toggle error:", err?.response?.data || err);
      alert(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (applicationId) => {
    if (!confirm("Are you sure you want to revoke this rejection and move the application back to pending?")) {
      return;
    }

    setBusy(true);
    try {
      await API.post(
        "/superadmin/applications/revoke",
        { applicationId },
        { headers: authHeaders() }
      );
      // Refresh the current files tab
      fetchAllFiles(filesTab);
      fetchStats(); // Refresh stats too
      alert("Application revoked and moved back to pending");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to revoke");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!confirm("Are you sure you want to delete this admin? This action cannot be undone.")) {
      return;
    }

    setBusy(true);
    try {
      await API.delete(`/superadmin/admins/${adminId}`, {
        headers: authHeaders()
      });
      await fetchAdmins();
      alert("Admin deleted successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to delete admin");
    } finally {
      setBusy(false);
    }
  };

  const handleEditAdmin = (admin) => {
    if (!admin) {
      console.error("handleEditAdmin called with undefined admin");
      return;
    }

    // console.log("handleEditAdmin called for:", admin.name);
    // console.log("Full admin object:", admin);
    // console.log("Admin workflows:", admin.workflows);
    // console.log("Admin workflows type:", typeof admin.workflows);
    // console.log("Admin workflows isArray:", Array.isArray(admin.workflows));

    // Just set the editing admin - useEffect will handle updating the form
    setEditingAdmin(admin);
  };

  const updateAdmin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updateData = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        workflows: stageArray,
      };
      
      // Only include password if it's been provided
      if (editForm.password && editForm.password.trim() !== "") {
        updateData.password = editForm.password;
      }
      
      await API.patch(
        `/superadmin/admins/${editingAdmin._id}`,
        updateData,
        { headers: authHeaders() }
      );
      setEditingAdmin(null);
      setEditForm({ name: "", email: "", password: "", role: "admin", selectedWorkflows: [] });
      await fetchAdmins();
      alert("Admin updated successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to update admin");
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditingAdmin(null);
    setEditForm({
      name: "",
      email: "",
      password: "",
      role: "admin",
      selectedWorkflows: [],
    });
    setShowEditPassword(false);
  };

  // Dealer creation handlers
  const createDealer = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await API.post(
        "/superadmin/dealers",
        dealerForm,
        { headers: authHeaders() }
      );
      setDealerForm({
        email: "",
        password: "",
        UserId: "",
        name: "",
        District: "",
        Branch: "",
        Contact: "",
      });
      setShowDealerPassword(false);
      await fetchDealers();
      alert("Dealer created successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create dealer");
    } finally {
      setBusy(false);
    }
  };

  // Generate UserId if not provided
  const generateUserId = () => {
    const id = `USER${String(nextUserId).padStart(6, '0')}`;
    setNextUserId(nextUserId + 1);
    return id;
  };

  // Handle Excel file upload
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          alert("Excel file is empty");
          return;
        }

        // Process the data and generate IDs where needed
        const processedData = jsonData.map((row) => ({
          email: row.email || row.Email || "",
          password: row.password || row.Password || "",
          UserId: row.UserId || row.userid || row.Userid || generateUserId(),
          name: row.name || row.Name || "",
          District: row.District || row.district || "",
          Branch: row.Branch || row.branch || "",
          Contact: row.Contact || row.contact || row.Phone || row.phone || "",
        }));

        setBulkDealersData(processedData);
        alert(`Successfully loaded ${processedData.length} records from Excel file`);
      } catch (err) {
        alert("Error reading Excel file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // Reset file input
  };

  // Handle text input with ID generation
  // const generateIdsFromText = () => {
  //   if (!bulkDealersText.trim()) {
  //     alert("Please enter dealer data");
  //     return;
  //   }

  //   try {
  //     const lines = bulkDealersText.trim().split('\n').filter(line => line.trim());
  //     const dealers = lines.map((line, index) => {
  //       const parts = line.split(',').map(p => p.trim());
  //       if (parts.length < 2) {
  //         throw new Error(`Line ${index + 1}: Email and password are required`);
  //       }
        
  //       // Generate UserId if not provided (parts[2] is empty or missing)
  //       let userId = parts[2];
  //       if (!userId || userId === "") {
  //         userId = generateUserId();
  //       }
        
  //       return {
  //         email: parts[0],
  //         password: parts[1],
  //         UserId: userId,
  //         name: parts[3] || "",
  //         District: parts[4] || "",
  //         Branch: parts[5] || "",
  //         Contact: parts[6] || "",
  //       };
  //     });

  //     setBulkDealersData(dealers);
  //     alert(`Successfully generated IDs for ${dealers.length} records`);
  //   } catch (err) {
  //     alert(err.message);
  //   }
  // };

  const bulkCreateDealers = async (e) => {
    e.preventDefault();
    
    const dealers = bulkDealersData;
    
    if (dealers.length === 0) {
      alert("Please load dealer data first");
      return;
    }

    setBusy(true);
    try {
      // Validate required fields
      for (let i = 0; i < dealers.length; i++) {
        const d = dealers[i];
        if (!d.email || !d.password) {
          alert(`Record ${i + 1}: Email and password are required`);
          setBusy(false);
          return;
        }
      }

      const { data } = await API.post(
        "/superadmin/dealers/bulk",
        { dealers },
        { headers: authHeaders() }
      );
      
      // setBulkDealersText("");
      setBulkDealersData([]);
      setNextUserId(1000);
      await fetchDealers();
      
      const message = `Bulk creation completed!\n${data.results.success.length} succeeded\n${data.results.failed.length} failed`;
      if (data.results.failed.length > 0) {
        const failedDetails = data.results.failed.map(f => `- ${f.email}: ${f.error}`).join('\n');
        alert(message + '\n\nFailed:\n' + failedDetails);
      } else {
        alert(message);
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create dealers");
    } finally {
      setBusy(false);
    }
  };

  const handleEditDealer = (dealer) => {
    if (!dealer) {
      console.error("handleEditDealer called with undefined dealer");
      return;
    }
    setEditingDealer(dealer);
  };

  const updateDealer = async (e) => {
    e.preventDefault();
    if (!editingDealer?._id) return;
    
    setBusy(true);
    try {
      const updateData = {
        email: editDealerForm.email,
        UserId: editDealerForm.UserId,
        name: editDealerForm.name,
        District: editDealerForm.District,
        Branch: editDealerForm.Branch,
        Contact: editDealerForm.Contact,
      };
      
      // Only include password if it's been provided
      if (editDealerForm.password && editDealerForm.password.trim() !== "") {
        updateData.password = editDealerForm.password;
      }
      
      await API.patch(
        `/superadmin/dealers/${editingDealer._id}`,
        updateData,
        { headers: authHeaders() }
      );
      setEditingDealer(null);
      setEditDealerForm({ email: "", password: "", UserId: "", name: "", District: "", Branch: "", Contact: "" });
      setShowEditDealerPassword(false);
      await fetchDealers();
      alert("Dealer updated successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to update dealer");
    } finally {
      setBusy(false);
    }
  };

  const cancelEditDealer = () => {
    setEditingDealer(null);
    setEditDealerForm({ email: "", password: "", UserId: "", name: "", District: "", Branch: "", Contact: "" });
    setShowEditDealerPassword(false);
  };

  const toggleDealerActive = async (dealerId, isActive) => {
    if (!dealerId) {
      alert("Dealer ID is missing");
      return;
    }
    
    setBusy(true);
    try {
      await API.patch(
        "/superadmin/dealers/toggle",
        { dealerId, isActive: !isActive },
        { headers: authHeaders() }
      );
      await fetchDealers();
      alert("Dealer status updated successfully");
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to toggle";
      console.error("Toggle error:", err?.response?.data || err);
      alert(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDealer = async (dealerId) => {
    if (!confirm("Are you sure you want to delete this dealer? This action cannot be undone.")) {
      return;
    }

    setBusy(true);
    try {
      await API.delete(`/superadmin/dealers/${dealerId}`, {
        headers: authHeaders()
      });
      await fetchDealers();
      alert("Dealer deleted successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to delete dealer");
    } finally {
      setBusy(false);
    }
  };

  // Helper functions for workflow checkboxes
  const handleWorkflowChange = (workflow, isChecked, isEdit = false) => {
    const targetForm = isEdit ? editForm : form;
    const setTargetForm = isEdit ? setEditForm : setForm;

    let normalizedWorkflow = workflow.trim().toLowerCase();
    // Map to canonical name
    if (workflowAliases[normalizedWorkflow]) {
      normalizedWorkflow = workflowAliases[normalizedWorkflow];
    }

    const updatedWorkflows = isChecked
      ? [...targetForm.selectedWorkflows, normalizedWorkflow]
      : targetForm.selectedWorkflows.filter(w => {
          let normalizedW = typeof w === 'string' ? w.trim().toLowerCase() : String(w || '').trim().toLowerCase();
          // Map to canonical name for comparison
          if (workflowAliases[normalizedW]) {
            normalizedW = workflowAliases[normalizedW];
          }
          return normalizedW !== normalizedWorkflow;
        });

    console.log(`handleWorkflowChange: ${workflow} ${isChecked ? 'checked' : 'unchecked'}`);
    console.log("  normalizedWorkflow:", normalizedWorkflow);
    console.log("  updatedWorkflows:", updatedWorkflows);

    setTargetForm({
      ...targetForm,
      selectedWorkflows: updatedWorkflows
    });
  };

  const isWorkflowSelected = (workflow, isEdit = false) => {
    const targetForm = isEdit ? editForm : form;
    let normalizedWorkflow = workflow.trim().toLowerCase();
    
    // Map aliases to canonical names
    if (workflowAliases[normalizedWorkflow]) {
      normalizedWorkflow = workflowAliases[normalizedWorkflow];
    }
    
    // Normalize all selected workflows for comparison
    const normalizedSelected = (targetForm.selectedWorkflows || []).map(w => {
      const val = typeof w === 'string' ? w : (w?.toString() || '');
      let normalized = val.trim().toLowerCase();
      // Apply alias mapping
      if (workflowAliases[normalized]) {
        normalized = workflowAliases[normalized];
      }
      return normalized;
    });
    
    const selected = normalizedSelected.includes(normalizedWorkflow);

    if (isEdit && selected) {
      // console.log(`✅ isWorkflowSelected("${workflow}", edit=true):`, selected);
      // console.log("  normalizedWorkflow:", normalizedWorkflow);
      // console.log("  normalizedSelected:", normalizedSelected);
    }

    return selected;
  };

  // ===== UI pieces (cards, same style system) =====
  const SuperAdminFileCard = ({ app, type }) => {
    const navigate = useNavigate();

    const handleViewDetails = () => {
      // Navigate to a detailed view - for now, let's use the existing ApplicationView
      navigate(`/application/${app._id}`);
    };

    return (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900, color: "#111827" }}>
            {app?.formId || "—"}
          </div>
          <span className={`tag ${
            type === "pending" ? "tag-pending" :
            type === "approved" ? "tag-approved" : "tag-rejected"
          }`}>
            {type === "pending" ? "Pending" :
             type === "approved" ? "Approved" : "Rejected"}
          </span>
        </div>

        <div style={{ fontSize: 16, fontWeight: 800 }}>
          {app?.applicant?.applicant?.name || app?.applicant?.name || "—"}
        </div>
        <div className="meta">
          Stage: <b style={{ color: "#111" }}>
            {app?.workflowStage || "—"}
          </b>
        </div>

        <div className="row2">
          <div><span className="k">Dealer</span><div className="v">{app?.dealerDetails?.name || "—"}</div></div>
          <div><span className="k">Branch</span><div className="v">{app?.dealerDetails?.branch || "—"}</div></div>
          <div><span className="k">District</span><div className="v">{app?.dealerDetails?.district || "—"}</div></div>
        </div>

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={handleViewDetails}
          >
            View Details
          </button>
          {type === "rejected" && (
            <button
              className="btn btn-outline"
              onClick={() => handleRevoke(app._id)}
              style={{ marginLeft: 8 }}
            >
              Revoke
            </button>
          )}
        </div>
      </div>
    );
  };

  const AdminCard = ({ a }) => (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900, color: "#111827" }}>{a?.name || "—"}</div>
        <span className={`tag ${a?.isActive ? "tag-approved" : "tag-rejected"}`}>
          {a?.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="meta">Email: <b style={{ color: "#111" }}>{a?.email || "—"}</b></div>
      <div className="meta">Role: <b style={{ color: "#111" }}>{a?.role || "—"}</b></div>
      <div className="meta">
        Last Login: <b style={{ color: "#111" }}>
          {a?.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : "—"}
        </b>
      </div>
      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={() => toggleActive(a?._id, !a?.isActive)}
          disabled={busy}
        >
          {a?.isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            if (a && a._id) {
              handleEditAdmin(a);
            } else {
              console.error("Cannot edit admin: invalid admin object", a);
            }
          }}
          disabled={busy || !a || !a._id}
          style={{ marginLeft: 8 }}
        >
          Edit
        </button>
        <button
          className="btn"
          onClick={() => handleDeleteAdmin(a?._id)}
          disabled={busy}
          style={{ marginLeft: 8, backgroundColor: "#ef4444", color: "white", borderColor: "#ef4444" }}
        >
          Delete
        </button>
      </div>
    </div>
  );

  const LogCard = ({ r }) => (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900, color: "#111827" }}>
          {r?.action || "—"}
        </div>
        <span className="tag tag-pending">
          {new Date(r?.at || r?.createdAt || Date.now()).toLocaleString()}
        </span>
      </div>

      <div className="meta">
        Admin: <b style={{ color: "#111" }}>
          {r?.adminId?.name} ({r?.adminId?.email})
        </b>
      </div>

      <div className="row2">
        <div><span className="k">From</span><div className="v">{r?.fromStage || "—"}</div></div>
        <div><span className="k">To</span><div className="v">{r?.toStage || "—"}</div></div>
        <div><span className="k">Application</span><div className="v">{r?.applicationId?._id || r?.applicationId || "—"}</div></div>
      </div>

      {!!r?.notes && (
        <div className="meta" style={{ marginTop: 4 }}>
          Notes: <b style={{ color: "#111" }}>{r.notes}</b>
        </div>
      )}
    </div>
  );

  const SummaryCard = ({ s, onClick }) => (
    <div 
      className="card" 
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <div style={{ fontWeight: 900, color: "#111827", marginBottom: 6 }}>
        {s?.name} <span className="meta">({s?.email})</span>
      </div>
      <div className="row2">
        <div><span className="k">Total</span><div className="v">{s?.totalActions ?? 0}</div></div>
        <div><span className="k">Updates</span><div className="v">{s?.updates ?? 0}</div></div>
        <div><span className="k">Approvals</span><div className="v">{s?.approvals ?? 0}</div></div>
        <div><span className="k">Rejections</span><div className="v">{s?.rejections ?? 0}</div></div>
      </div>
      <div className="meta" style={{ marginTop: 4 }}>
        Last: <b style={{ color: "#111" }}>
          {s?.lastActionAt ? new Date(s.lastActionAt).toLocaleString() : "—"}
        </b>
      </div>
    </div>
  );

  // Which collection to show in the grid for this tab
  const cards =
    tab === "admins" ? admins
    : tab === "recent" ? recent
    : summary;

  return (
    <div className="dash-wrap">
      {/* local styles match your Admin Dashboard */}
      <style>{`
:root{
  --bg-grad: linear-gradient(180deg,#f8fafc 0%, #ffffff 60%);
  --muted: #6b7280;
  --ink: #0f172a;
  --card-ring: 0 12px 32px rgba(15,23,42,.06);
  --glass: rgba(255,255,255,0.8);
  --blue: #2563eb;
  --green: #16a34a;
  --red: #ef4444;
  --amber: #f59e0b;

  --radius-lg: 14px;
  --radius-md: 10px;
  --pad-md: 16px;
  --shadow-soft: 0 8px 20px rgba(12,18,33,0.06);
  --transition: 180ms cubic-bezier(.2,.9,.3,1);
}

/* Page shell */
.dash-wrap{
  min-height: 100vh;
  padding: 24px;
  background: var(--bg-grad);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  color: var(--ink);
  box-sizing: border-box;
}

/* Top bar */
.dash-bar{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  padding:12px 18px;
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, rgba(255,255,255,0.8), rgba(250,250,250,0.9));
  border: 1px solid rgba(14,20,36,0.04);
  box-shadow: var(--card-ring);
  margin-bottom: 18px;
}

/* segmented controls */
.seg{ display:inline-flex; padding:6px; background: rgba(241,245,249,0.7); border-radius:999px; gap:6px; }
.seg button{
  border:0; background:transparent; padding:8px 14px; border-radius:999px; font-weight:700; color:var(--muted);
  cursor: pointer; transition: all var(--transition);
  letter-spacing: .2px;
}
.seg button.active{
  background: #fff;
  color: var(--ink);
  box-shadow: var(--shadow-soft);
  transform: translateY(-1px);
}

/* counts / badges */
.badge{ display:inline-block; font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px; margin-left:8px; background: #eef2ff; color: var(--blue); }

/* responsive grid */
.grid{
  display:grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}
@media (max-width: 992px){ .grid{ grid-template-columns: repeat(6,1fr); } }
@media (max-width: 576px){ .grid{ grid-template-columns: repeat(2,1fr); } }

/* cards */
.card{
  grid-column: span 4;
  background: linear-gradient(180deg, #fff, #fcfdff);
  border: 1px solid rgba(14,20,36,0.04);
  border-radius: var(--radius-lg);
  box-shadow: var(--card-ring);
  padding: var(--pad-md);
  display:flex;
  flex-direction:column;
  gap:10px;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
}
.card:hover{
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(15,23,42,0.08);
  border-color: rgba(14,20,36,0.06);
}

/* smaller card variant for inner stat cards */
.card.card-compact{ padding:12px; grid-column: span 3; }

/* meta text */
.meta{ color:var(--muted); font-size:13px; line-height:1.35; }
.row2{ display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
.k{ color:var(--muted); font-weight:700; font-size:12px; }
.v{ color:var(--ink); font-weight:800; font-size:14px; }

/* action buttons */
.actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:8px; }
.btn{
  border:1px solid rgba(14,20,36,0.06);
  background:#fff;
  color:var(--ink);
  padding:8px 12px;
  border-radius: var(--radius-md);
  font-weight:700;
  cursor:pointer;
  transition: all var(--transition);
}
.btn:disabled{ opacity:0.6; cursor:not-allowed; transform:none; }
.btn:hover:not(:disabled){ transform: translateY(-2px); box-shadow: var(--shadow-soft); }

/* primary / outline */
.btn-primary{
  border-color: rgba(37,99,235,0.12);
  background: linear-gradient(180deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02));
  color: var(--blue);
}
.btn-outline{
  background: transparent;
  border-color: rgba(14,20,36,0.06);
}

/* small tags for states */
.tag{ font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px; display:inline-block; }
.tag-pending{ background: #fff7ed; color:#92400e; border:1px solid #fde3bf; }
.tag-approved{ background:#ecfdf5; color:#065f46; border:1px solid #d1fae5; }
.tag-rejected{ background:#fff1f2; color:#7f1d1d; border:1px solid #fecaca; }

/* empty / loading placeholders */
.empty{
  padding:20px;
  border-radius:12px;
  border: 1px dashed rgba(14,20,36,0.06);
  text-align:center;
  background: rgba(255,255,255,0.7);
  color: var(--muted);
  font-weight:700;
}

/* forms */
.form{ display:grid; gap:12px; }
.input{
  border:1px solid rgba(14,20,36,0.06);
  border-radius:10px;
  padding:10px 12px;
  background: #fff;
  font-size:14px;
  outline: none;
  transition: box-shadow var(--transition), border-color var(--transition);
}
.input:focus{ box-shadow: 0 6px 20px rgba(37,99,235,0.06); border-color: rgba(37,99,235,0.25); }

/* label */
.label{ font-size:13px; color:var(--muted); font-weight:700; }

/* checkbox rows */
label > input[type="checkbox"]{
  width:16px; height:16px; accent-color: var(--blue);
}

/* small responsive tweaks */
@media (max-width: 880px){
  .card{ grid-column: span 6; }
  .card.card-compact{ grid-column: span 3; }
}
@media (max-width: 520px){
  .card{ grid-column: span 12; }
  .seg{ display:flex; gap:4px; overflow:auto; padding:4px 6px; }
  .seg button{ padding:6px 10px; font-size:13px; }
}

/* modal */
.modal-overlay{
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 24px;
}
.modal-content{
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  padding: 24px;
  overflow-y: auto;
}
      `}</style>

      {/* Top bar */}
      <div className="dash-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logo} alt="Logo" style={{ height: 40, marginBottom: 4 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="seg">
            <button className={tab === "admins" ? "active" : ""} onClick={() => setTab("admins")}>
              Admins <span className="badge b-approved">{admins.length}</span>
            </button>
            <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>
              Summary <span className="badge b-approved">{summary.length}</span>
            </button>
            <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>
              Stats
            </button>
            <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
              Files
            </button>
            <button className={tab === "dealers" ? "active" : ""} onClick={() => setTab("dealers")}>
              Dealers <span className="badge b-approved">{dealers.length}</span>
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <button
              ref={btnRef}
              onClick={() => setOpen((v) => !v)}
              style={styles.userBtn}
              aria-haspopup="menu"
              aria-expanded={open ? "true" : "false"}
              title="Account"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 12a5 5 0 100-10 5 5 0 000 10zM21 22a9 9 0 10-18 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            {open && (
              <div
                ref={menuRef}
                style={{
                  position: "absolute",
                  right: 0,
                  marginTop: 8,
                  minWidth: 200,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 10px 30px rgba(2,6,23,0.08)",
                  padding: 10,
                  zIndex: 9999,
                }}
                role="menu"
                aria-label="Account menu"
              >
                <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                  {admin?.name || "Super Admin"}
                </div>
                {admin?.email && (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{admin.email}</div>
                )}
                <button
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "#ef4444",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {tab === "admins" && (
        <>
          {/* Create Admin */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 900, color: "#111827" }}>Create Admin</div>
            <form className="form" onSubmit={createAdmin}>
              <input
                className="input"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showCreatePassword ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={showCreatePassword ? "Hide password" : "Show password"}
                >
                  {showCreatePassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>

              <div>
                <div className="label">Workflow Access (check to grant access)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginTop: "8px" }}>
                  {availableWorkflows.map(workflow => (
                    <label key={workflow} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={isWorkflowSelected(workflow)}
                        onChange={(e) => handleWorkflowChange(workflow, e.target.checked)}
                      />
                      <span style={{ fontSize: "14px" }}>{workflow}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="actions">
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? "Please wait…" : "Create"}
                </button>
              </div>
            </form>
          </div>

          {/* Edit Admin Form */}
          {editingAdmin && editingAdmin._id && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: "#111827", marginBottom: 8 }}>
                Edit Admin: {editingAdmin.name || "—"}
              </div>
              <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: 16 }}>
                <strong>Current Access:</strong> {Array.isArray(editingAdmin.workflows) && editingAdmin.workflows.length > 0 ? editingAdmin.workflows.join(", ") : "None"}
              </div>
              <form className="form" onSubmit={updateAdmin}>
                <input
                  className="input"
                  placeholder="Name"
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
                <input
                  className="input"
                  type="email"
                  placeholder="Email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showEditPassword ? "text" : "password"}
                    placeholder="New Password (leave empty to keep current)"
                    value={editForm.password || ""}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showEditPassword ? "Hide password" : "Show password"}
                  >
                    {showEditPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <select
                  className="input"
                  value={editForm.role || "admin"}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>

                <div>
                  <div className="label">Workflow Access (check to grant access)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginTop: "8px" }}>
                    {availableWorkflows.map(workflow => {
                      const isChecked = isWorkflowSelected(workflow, true);

                      return (
                        <label key={workflow} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleWorkflowChange(workflow, e.target.checked, true)}
                          />
                          <span style={{
                            fontSize: "14px",
                            fontWeight: isChecked ? "bold" : "normal",
                            color: isChecked ? "#16a34a" : "#6b7280"
                          }}>
                            {workflow}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="actions">
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "Updating…" : "Update"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={cancelEdit}
                    disabled={busy}
                    style={{ marginLeft: 8 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Admins list */}
          {loadingAdmins ? (
            <div className="empty">Loading admins…</div>
          ) : admins.length === 0 ? (
            <div className="empty">No admins found</div>
          ) : (
            <div className="grid" ref={gridRef}>
              {admins.map((a) => (
                <AdminCard key={a._id} a={a} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Recent tab is commented out */}

      {tab === "summary" && (
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 900, color: "#111827", marginBottom: 8 }}>
              Summary Filters
            </div>
            <div className="row2">
              <div>
                <div className="label">From</div>
                <input
                  type="date"
                  className="input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <div className="label">To</div>
                <input
                  type="date"
                  className="input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="actions" style={{ marginLeft: "auto" }}>
                <button className="btn btn-primary" onClick={fetchSummary} disabled={loadingSummary}>
                  {loadingSummary ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          {loadingSummary ? (
            <div className="empty">Loading summary…</div>
          ) : summary.length === 0 ? (
            <div className="empty">No summary data</div>
          ) : (
            <div className="grid" ref={gridRef}>
              {summary.map((s) => (
                <SummaryCard 
                  key={String(s.adminId)} 
                  s={s}
                  onClick={() => {
                    setSelectedAdmin(s);
                    fetchAdminActivity(s.adminId);
                  }}
                />
              ))}
            </div>
          )}

          {/* Admin Activity Modal */}
          {selectedAdmin && (
            <div 
              className="modal-overlay"
              onClick={(e) => {
                if (e.target.classList.contains("modal-overlay")) {
                  setSelectedAdmin(null);
                  setAdminActivity({ files: [], totalActions: 0, admin: null });
                }
              }}
            >
              <div className="modal-content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h2 style={{ margin: 0, color: "#111827" }}>
                      {selectedAdmin.name} - Activity History
                    </h2>
                    <div className="meta" style={{ marginTop: 4 }}>
                      {selectedAdmin.email} • Total Actions: {adminActivity.totalActions}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setSelectedAdmin(null);
                      setAdminActivity({ files: [], totalActions: 0, admin: null });
                    }}
                    style={{ padding: "8px 16px" }}
                  >
                    ✕ Close
                  </button>
                </div>

                {loadingAdminActivity ? (
                  <div className="empty">Loading activity…</div>
                ) : adminActivity.files.length === 0 ? (
                  <div className="empty">No activity found for this admin</div>
                ) : (
                  <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
                    {adminActivity.files.map((file, idx) => (
                      <div key={idx} className="card" style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontWeight: 900, color: "#111827" }}>
                            Form ID: {file.formId}
                          </div>
                          <span className={`tag ${
                            file.status === "approved" ? "tag-approved" :
                            file.status === "rejected" ? "tag-rejected" : "tag-pending"
                          }`}>
                            {file.status || "Pending"}
                          </span>
                        </div>
                        <div className="meta" style={{ marginBottom: 8 }}>
                          Applicant: <b style={{ color: "#111" }}>{file.applicant}</b>
                        </div>
                        <div className="meta" style={{ marginBottom: 12 }}>
                          Stage: <b style={{ color: "#111" }}>{file.workflowStage}</b>
                        </div>
                        <div style={{ borderTop: "1px solid rgba(14,20,36,0.06)", paddingTop: 12 }}>
                          <div className="label" style={{ marginBottom: 8 }}>Actions on this file:</div>
                          {file.actions.map((action, actionIdx) => (
                            <div 
                              key={actionIdx} 
                              style={{ 
                                padding: "8px 12px", 
                                marginBottom: 8, 
                                background: "rgba(241,245,249,0.5)",
                                borderRadius: 8,
                                borderLeft: `3px solid ${
                                  action.action === "APPROVE" ? "#16a34a" :
                                  action.action === "REJECT" ? "#ef4444" :
                                  action.action === "UPDATE_STAGE" ? "#2563eb" : "#6b7280"
                                }`
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ 
                                  fontWeight: 700, 
                                  color: action.action === "APPROVE" ? "#16a34a" :
                                         action.action === "REJECT" ? "#ef4444" :
                                         action.action === "UPDATE_STAGE" ? "#2563eb" : "#6b7280"
                                }}>
                                  {action.action === "APPROVE" ? " Approved" :
                                   action.action === "REJECT" ? " Rejected" :
                                   action.action === "UPDATE_STAGE" ? " Updated" :
                                   action.action === "EDIT_FIELDS" ? " Edited" : action.action}
                                </span>
                                <span className="meta" style={{ fontSize: 11 }}>
                                  {new Date(action.at).toLocaleString()}
                                </span>
                              </div>
                              {action.fromStage && action.toStage && (
                                <div className="meta" style={{ fontSize: 12 }}>
                                  {action.fromStage} → {action.toStage}
                                </div>
                              )}
                              {action.notes && (
                                <div className="meta" style={{ fontSize: 12, marginTop: 4 }}>
                                  Notes: {action.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "stats" && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 900, color: "#111827", marginBottom: 16 }}>
              Application Statistics
            </div>

            {loadingStats ? (
              <div className="empty">Loading statistics…</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { setTab("files"); setFilesTab("pending"); }}>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#f59e0b", marginBottom: 8 }}>
                    {stats.pending || 0}
                  </div>
                  <div style={{ fontWeight: "600", color: "#111827" }}>Pending Applications</div>
                  <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: 4 }}>Click to view details</div>
                </div>

                <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { setTab("files"); setFilesTab("approved"); }}>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#16a34a", marginBottom: 8 }}>
                    {stats.approved || 0}
                  </div>
                  <div style={{ fontWeight: "600", color: "#111827" }}>Approved Applications</div>
                  <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: 4 }}>Click to view details</div>
                </div>

                <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { setTab("files"); setFilesTab("rejected"); }}>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#ef4444", marginBottom: 8 }}>
                    {stats.rejected || 0}
                  </div>
                  <div style={{ fontWeight: "600", color: "#111827" }}>Rejected Applications</div>
                  <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: 4 }}>Click to view details</div>
                </div>

                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#2563eb", marginBottom: 8 }}>
                    {stats.total || 0}
                  </div>
                  <div style={{ fontWeight: "600", color: "#111827" }}>Total Applications</div>
                  <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: 4 }}>All time</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "files" && (
        <>
          {/* File Type Tabs */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: 16 }}>
              <button
                className={`btn ${filesTab === "pending" ? "btn-primary" : "btn-outline"}`}
                onClick={() => { setFilesTab("pending"); fetchAllFiles("pending"); }}
              >
                Pending ({stats.pending || 0})
              </button>
              <button
                className={`btn ${filesTab === "approved" ? "btn-primary" : "btn-outline"}`}
                onClick={() => { setFilesTab("approved"); fetchAllFiles("approved"); }}
              >
                Approved ({stats.approved || 0})
              </button>
              <button
                className={`btn ${filesTab === "rejected" ? "btn-primary" : "btn-outline"}`}
                onClick={() => { setFilesTab("rejected"); fetchAllFiles("rejected"); }}
              >
                Rejected ({stats.rejected || 0})
              </button>
            </div>

            {/* Files List */}
            {loadingFiles ? (
              <div className="empty">Loading files…</div>
            ) : allFiles.length === 0 ? (
              <div className="empty">No {filesTab} files found</div>
            ) : (
              <div className="grid" ref={gridRef}>
                {allFiles.map((app) => (
                  <SuperAdminFileCard key={app._id} app={app} type={filesTab} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "dealers" && (
        <>
          {/* Mode Toggle */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: 16 }}>
              <button
                className={`btn ${bulkCreateMode === "single" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setBulkCreateMode("single")}
              >
                Single Create
              </button>
              <button
                className={`btn ${bulkCreateMode === "bulk" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setBulkCreateMode("bulk")}
              >
                Bulk Create
              </button>
            </div>

            {/* Single Create Form */}
            {bulkCreateMode === "single" && (
              <form className="form" onSubmit={createDealer}>
                <div style={{ fontWeight: 900, color: "#111827", marginBottom: 8 }}>Create Dealer</div>
                <input
                  className="input"
                  type="email"
                  placeholder="Email *"
                  value={dealerForm.email}
                  onChange={(e) => setDealerForm({ ...dealerForm, email: e.target.value })}
                  required
                />
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showDealerPassword ? "text" : "password"}
                    placeholder="Password *"
                    value={dealerForm.password}
                    onChange={(e) => setDealerForm({ ...dealerForm, password: e.target.value })}
                    required
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDealerPassword(!showDealerPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showDealerPassword ? "Hide password" : "Show password"}
                  >
                    {showDealerPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <input
                  className="input"
                  placeholder="User ID"
                  value={dealerForm.UserId}
                  onChange={(e) => setDealerForm({ ...dealerForm, UserId: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Name"
                  value={dealerForm.name}
                  onChange={(e) => setDealerForm({ ...dealerForm, name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="District"
                  value={dealerForm.District}
                  onChange={(e) => setDealerForm({ ...dealerForm, District: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Branch"
                  value={dealerForm.Branch}
                  onChange={(e) => setDealerForm({ ...dealerForm, Branch: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Contact"
                  value={dealerForm.Contact}
                  onChange={(e) => setDealerForm({ ...dealerForm, Contact: e.target.value })}
                />
                <div className="actions">
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "Creating…" : "Create Dealer"}
                  </button>
                </div>
              </form>
            )}

            {/* Bulk Create Form */}
            {bulkCreateMode === "bulk" && (
              <div>
                <div className="card" style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 900, color: "#111827", marginBottom: 12 }}>Bulk Create Dealers</div>
                  
                  {/* Upload Mode Tabs */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: 16 }}>
                    {/* <button
                      type="button"
                      className={`btn ${bulkUploadMode === "text" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setBulkUploadMode("text")}
                    >
                      Text Input
                    </button> */}
                    <button
                      type="button"
                      className={`btn ${bulkUploadMode === "excel" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setBulkUploadMode("excel")}
                    >
                      Excel Upload
                    </button>
                  </div>

                  {/* Text Input Mode */}
                  {/* {bulkUploadMode === "text" && (
                    <div>
                      <div className="label" style={{ marginBottom: 8 }}>
                        Format: email,password,UserId,name,District,Branch,Contact (one per line)
                      </div>
                      <div className="label" style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
                        💡 Leave UserId empty to auto-generate (e.g., USER001000, USER001001...)
                      </div>
                      <textarea
                        className="input"
                        placeholder={`dealer1@example.com,password123,,Dealer Name,District,Branch,1234567890\ndealer2@example.com,password456,,Another Dealer,Another Dist,Branch2,9876543210`}
                        value={bulkDealersText}
                        onChange={(e) => setBulkDealersText(e.target.value)}
                        rows={10}
                        style={{ fontFamily: "monospace", fontSize: "13px", marginBottom: 12 }}
                      />
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={generateIdsFromText}
                          disabled={!bulkDealersText.trim()}
                        >
                          Generate IDs & Preview
                        </button>
                      </div>
                    </div>
                  )} */}

                  {/* Excel Upload Mode */}
                  {bulkUploadMode === "excel" && (
                    <div>
                      <div className="label" style={{ marginBottom: 8 }}>
                        Upload Excel file with columns: email, password, name, District, Branch, Contact, UserId (optional)
                      </div>
                      <div className="label" style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
                        📋 UserId will be auto-generated if not provided in the Excel file
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleExcelUpload}
                          accept=".xlsx,.xls,.csv"
                          style={{
                            padding: "10px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "block",
                            width: "100%"
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Data Preview */}
                  {bulkDealersData.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                        Preview ({bulkDealersData.length} records):
                      </div>
                      <div style={{
                        maxHeight: "300px",
                        overflowY: "auto",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        marginBottom: 12
                      }}>
                        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                          <thead style={{ position: "sticky", top: 0, backgroundColor: "#f3f4f6" }}>
                            <tr>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>#</th>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Email</th>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>UserId</th>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Name</th>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>District</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkDealersData.map((dealer, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                <td style={{ padding: "8px" }}>{idx + 1}</td>
                                <td style={{ padding: "8px" }}>{dealer.email}</td>
                                <td style={{ padding: "8px", fontWeight: 600 }}>{dealer.UserId}</td>
                                <td style={{ padding: "8px" }}>{dealer.name || "—"}</td>
                                <td style={{ padding: "8px" }}>{dealer.District || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          className="btn btn-primary"
                          onClick={bulkCreateDealers}
                          disabled={busy || bulkDealersData.length === 0}
                        >
                          {busy ? "Creating…" : `Create ${bulkDealersData.length} Dealers`}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setBulkDealersData([]);
                            // setBulkDealersText("");
                            setNextUserId(1000);
                          }}
                          disabled={busy}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {bulkDealersData.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                      {bulkUploadMode === "text" 
                        ? ""
                        : "Upload an Excel file to preview records"
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Edit Dealer Form */}
          {editingDealer && editingDealer._id && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: "#111827", marginBottom: 8 }}>
                Edit Dealer: {editingDealer.name || editingDealer.email || "—"}
              </div>
              <form className="form" onSubmit={updateDealer}>
                <input
                  className="input"
                  type="email"
                  placeholder="Email *"
                  value={editDealerForm.email || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, email: e.target.value })}
                  required
                />
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showEditDealerPassword ? "text" : "password"}
                    placeholder="New Password (leave empty to keep current)"
                    value={editDealerForm.password || ""}
                    onChange={(e) => setEditDealerForm({ ...editDealerForm, password: e.target.value })}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditDealerPassword(!showEditDealerPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showEditDealerPassword ? "Hide password" : "Show password"}
                  >
                    {showEditDealerPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <input
                  className="input"
                  placeholder="User ID"
                  value={editDealerForm.UserId || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, UserId: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Name"
                  value={editDealerForm.name || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="District"
                  value={editDealerForm.District || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, District: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Branch"
                  value={editDealerForm.Branch || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, Branch: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Contact"
                  value={editDealerForm.Contact || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, Contact: e.target.value })}
                />
                <div className="actions">
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "Updating…" : "Update Dealer"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={cancelEditDealer}
                    disabled={busy}
                    style={{ marginLeft: 8 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Dealers List */}
          {loadingDealers ? (
            <div className="empty">Loading dealers…</div>
          ) : dealers.length === 0 ? (
            <div className="empty">No dealers found</div>
          ) : (
            <div className="grid" ref={gridRef}>
              {dealers.map((dealer) => (
                <div key={dealer._id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 900, color: "#111827" }}>
                      {dealer.name || "—"}
                    </div>
                    <span className={`tag ${dealer.isActive !== false ? "tag-approved" : "tag-rejected"}`}>
                      {dealer.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="meta">Email: <b style={{ color: "#111" }}>{dealer.email || "—"}</b></div>
                  {dealer.UserId && (
                    <div className="meta">User ID: <b style={{ color: "#111" }}>{dealer.UserId}</b></div>
                  )}
                  <div className="row2">
                    {dealer.District && (
                      <div><span className="k">District</span><div className="v">{dealer.District}</div></div>
                    )}
                    {dealer.Branch && (
                      <div><span className="k">Branch</span><div className="v">{dealer.Branch}</div></div>
                    )}
                    {dealer.Contact && (
                      <div><span className="k">Contact</span><div className="v">{dealer.Contact}</div></div>
                    )}
                  </div>
                  <div className="meta" style={{ marginTop: 4 }}>
                    Created: <b style={{ color: "#111" }}>
                      {dealer.createdAt ? new Date(dealer.createdAt).toLocaleString() : "—"}
                    </b>
                  </div>
                  <div className="actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => toggleDealerActive(dealer._id, dealer.isActive !== false)}
                      disabled={busy}
                    >
                      {dealer.isActive !== false ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleEditDealer(dealer)}
                      disabled={busy}
                      style={{ marginLeft: 8 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      onClick={() => handleDeleteDealer(dealer._id)}
                      disabled={busy}
                      style={{ marginLeft: 8, backgroundColor: "#ef4444", color: "white", borderColor: "#ef4444" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
