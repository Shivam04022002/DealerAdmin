import React, { useState } from "react";

/**
 * Check if a URL points to a PDF file.
 */
const isPDF = (url) => {
  const cleanUrl = String(url || "").split("?")[0].split("#")[0].toLowerCase();
  return cleanUrl.endsWith(".pdf");
};

/**
 * Derive the file-serving base URL from VITE_API_BASE_URL.
 */
const getFileBaseUrl = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";
  try {
    const apiUrl = new URL(apiBaseUrl);
    return apiUrl.origin;
  } catch {
    return window.location.origin;
  }
};

/**
 * Check if a URL is a Cloudinary URL.
 */
const isCloudinaryUrl = (url) => {
  return /res\.cloudinary\.com/i.test(url);
};

/**
 * For Cloudinary URLs, ensure they serve as inline images by:
 * - Adding fl_attachment:false to prevent download
 * - Adding f_auto to auto-detect format
 * - If the URL ends with a non-image extension (like .ai), replace it
 */
const fixCloudinaryUrl = (url) => {
  if (!isCloudinaryUrl(url)) return url;

  let fixed = url;

  // If the URL ends with a non-image extension like .ai, .psd, etc., strip it
  // or add f_auto to force image delivery
  const nonImageExts = ['.ai', '.psd', '.eps', '.svg', '.tiff', '.bmp', '.raw'];
  const urlPath = fixed.split("?")[0].toLowerCase();
  const hasNonImageExt = nonImageExts.some(ext => urlPath.endsWith(ext));

  if (hasNonImageExt) {
    // Remove the extension and add .jpg to force image format
    fixed = fixed.replace(/\.[a-z]+$/i, '.jpg');
  }

  // Add Cloudinary transformations for inline display if not already present
  if (fixed.includes('/upload/') && !fixed.includes('fl_attachment')) {
    fixed = fixed.replace('/upload/', '/upload/f_auto,q_auto/');
  }

  return fixed;
};

/**
 * Turn any src value into a full URL.
 * - Already-absolute URLs → return as-is (with Cloudinary fixes).
 * - Relative paths → prepend the API origin.
 */
const normalizeFileUrl = (src) => {
  if (!src) return "";

  // Already a full URL
  if (/^https?:\/\//i.test(src)) {
    return fixCloudinaryUrl(src);
  }

  const baseUrl = getFileBaseUrl();
  const cleanedSrc = String(src).trim();

  if (cleanedSrc.startsWith("/")) {
    return `${baseUrl}${cleanedSrc}`;
  }

  return `${baseUrl}/${cleanedSrc.replace(/^\/+/, "")}`;
};

/**
 * FilePreview component — renders images inline, PDFs as clickable links,
 * and gracefully handles broken images / Cloudinary downloads.
 */
const FilePreview = ({ src, alt, style }) => {
  const [hasError, setHasError] = useState(false);
  const [retried, setRetried] = useState(false);

  if (!src) return null;

  const fileUrl = normalizeFileUrl(src);

  /**
   * Open the file in a new tab. For Cloudinary URLs that download instead
   * of displaying, open via an object URL or Google Docs viewer fallback.
   */
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPDF(fileUrl)) {
      // For PDFs, use Google Docs viewer for reliable inline viewing
      const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
      window.open(googleViewerUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // For images, open directly — most image URLs display fine in a new tab
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  /**
   * Open image via a fetched blob URL so the browser always displays it
   * inline instead of downloading.
   */
  const handleOpenAsBlob = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(fileUrl, { mode: "cors" });
      if (!response.ok) throw new Error("Fetch failed");

      const blob = await response.blob();
      // Force image MIME type if the server returned something generic
      const type = blob.type && blob.type.startsWith("image/")
        ? blob.type
        : "image/jpeg";
      const imageBlob = new Blob([blob], { type });
      const blobUrl = URL.createObjectURL(imageBlob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    } catch {
      // Fallback: just open the raw URL
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  // PDF rendering
  if (isPDF(fileUrl)) {
    return (
      <div
        style={{
          cursor: "pointer",
          color: "#2563eb",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "10px",
        }}
        onClick={handleClick}
        title={`View ${alt} PDF in new tab`}
      >
        <span style={{ fontSize: "24px" }}>📄</span>
        <span style={{ fontWeight: "bold", textDecoration: "underline" }}>
          View PDF
        </span>
      </div>
    );
  }

  // Broken image state — show a styled fallback with "View File" button
  if (hasError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          height: "100%",
          padding: 10,
        }}
      >
        <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
          Preview unavailable
        </span>
        <button
          onClick={handleOpenAsBlob}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Open File
        </button>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpenAsBlob}
          style={{
            fontSize: 11,
            color: "#6b7280",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Try Direct Link
        </a>
      </div>
    );
  }

  // Image rendering with retry logic
  return (
    <img
      src={fileUrl}
      alt={alt}
      title={`Click to view ${alt} in new tab`}
      onClick={handleClick}
      style={{ ...style, cursor: "pointer" }}
      onError={(e) => {
        // On first error, try appending .jpg for Cloudinary or retry once
        if (!retried && isCloudinaryUrl(fileUrl)) {
          setRetried(true);
          // Try with explicit .jpg format
          const retryUrl = fileUrl.includes('f_auto')
            ? fileUrl.replace('f_auto', 'f_jpg')
            : fileUrl + '.jpg';
          e.target.src = retryUrl;
          return;
        }
        // After retry (or non-Cloudinary), show error state
        setHasError(true);
      }}
    />
  );
};

export default FilePreview;
