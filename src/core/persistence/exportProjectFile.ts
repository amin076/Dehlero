export function exportProjectFile(filename: string, data: unknown) {
  const safeName =
    filename.trim().replace(/[\\/:*?"<>|]/g, "-") || "dehlero-project";

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.dehlero.json`;
  link.click();

  URL.revokeObjectURL(url);
}
