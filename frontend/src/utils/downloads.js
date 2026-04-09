import api from "../api/client";

function getFilenameFromDisposition(contentDisposition, fallbackFilename) {
  if (!contentDisposition) {
    return fallbackFilename;
  }

  const utf8FilenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8FilenameMatch?.[1]) {
    try {
      return decodeURIComponent(utf8FilenameMatch[1]);
    } catch {
      return utf8FilenameMatch[1];
    }
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] || fallbackFilename;
}

function buildExportPath(resourcePath, scopedQuery) {
  const params = new URLSearchParams(scopedQuery.startsWith("?") ? scopedQuery.slice(1) : scopedQuery);
  params.set("export_format", "csv");

  const queryString = params.toString();
  return `/${resourcePath}/export/${queryString ? `?${queryString}` : ""}`;
}

export async function downloadCsvExport(resourcePath, scopedQuery, fallbackFilename) {
  const response = await api.get(buildExportPath(resourcePath, scopedQuery), {
    responseType: "blob",
  });

  const filename = getFilenameFromDisposition(
    response.headers["content-disposition"],
    fallbackFilename,
  );
  const blob = new Blob([response.data], {
    type: response.headers["content-type"] || "text/csv;charset=utf-8",
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}
