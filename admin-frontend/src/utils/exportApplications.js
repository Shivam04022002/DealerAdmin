import * as XLSX from "xlsx";

const formatDate = (val) => {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(val);
  }
};

const isoDate = (val) => {
  if (!val) return "";
  try {
    return new Date(val).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const getApplicantName = (app) =>
  app?.applicant?.applicant?.name || app?.applicant?.name || "—";

const getDealerName = (app) =>
  app?.dealerDetails?.name || app?.dealer?.name || "—";

const getBranch = (app) =>
  app?.branchName ||
  app?.dealerDetails?.branch ||
  app?.dealerDetails?.Branch ||
  app?.dealer?.Branch ||
  app?.dealer?.branch ||
  "—";

const getMobile = (app) =>
  app?.applicant?.applicant?.mobileNumber ||
  app?.applicant?.mobileNumber ||
  app?.applicant?.applicant?.mobile ||
  app?.applicant?.mobile ||
  "—";

const getVehicle = (app) =>
  app?.applicant?.applicant?.vehicleName ||
  app?.applicant?.vehicleName ||
  app?.applicant?.applicant?.vehicle ||
  app?.applicant?.vehicle ||
  "—";

const buildRows = (applications, status) =>
  applications.map((app) => ({
    "Application ID": app?.formId || app?._id || "—",
    "Applicant Name": getApplicantName(app),
    Branch: getBranch(app),
    "Dealer Name": getDealerName(app),
    "Mobile Number": getMobile(app),
    "Vehicle Name": getVehicle(app),
    Status: status.charAt(0).toUpperCase() + status.slice(1),
    // Server-generated createdAt — the same value shown in the table's Created column.
    "Created Date": formatDate(app?.createdAt),
    "Updated Date": formatDate(app?.updatedAt),
  }));

const COL_WIDTHS = [
  { wch: 20 }, // Application ID
  { wch: 28 }, // Applicant Name
  { wch: 18 }, // Branch
  { wch: 28 }, // Dealer Name
  { wch: 18 }, // Mobile Number
  { wch: 25 }, // Vehicle Name
  { wch: 12 }, // Status
  { wch: 24 }, // Created Date
  { wch: 24 }, // Updated Date
];

const buildDateSuffix = (dateFrom, dateTo) => {
  const from = dateFrom ? isoDate(dateFrom) : "";
  const to = dateTo ? isoDate(dateTo) : "";
  if (from && to && from !== to) return `_${from}_to_${to}`;
  if (from) return `_${from}`;
  return "";
};

export const exportApplicationsToExcel = (applications, status, dateFrom = null, dateTo = null) => {
  if (!applications || applications.length === 0) {
    alert(`No ${status} applications to export.`);
    return;
  }

  const rows = buildRows(applications, status);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = COL_WIDTHS;

  const wb = XLSX.utils.book_new();
  const sheetName = status.charAt(0).toUpperCase() + status.slice(1) + " Applications";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const suffix = buildDateSuffix(dateFrom, dateTo);
  const filename = `${status.charAt(0).toUpperCase()}${status.slice(1)}_Applications${suffix}.xlsx`;
  XLSX.writeFile(wb, filename);
};

export const exportAllToExcel = (pendingApps, approvedApps, rejectedApps, dateFrom = null, dateTo = null) => {
  const total = (pendingApps?.length || 0) + (approvedApps?.length || 0) + (rejectedApps?.length || 0);
  if (total === 0) {
    alert("No applications to export.");
    return;
  }

  const wb = XLSX.utils.book_new();

  const addSheet = (apps, status) => {
    const rows = buildRows(apps || [], status);
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ "Application ID": "No data" }]);
    ws["!cols"] = COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, ws, status.charAt(0).toUpperCase() + status.slice(1));
  };

  addSheet(pendingApps, "pending");
  addSheet(approvedApps, "approved");
  addSheet(rejectedApps, "rejected");

  const suffix = buildDateSuffix(dateFrom, dateTo);
  XLSX.writeFile(wb, `Applications${suffix}.xlsx`);
};
