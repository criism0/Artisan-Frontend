/**
 * Crea un Google Spreadsheet con los datos dados y abre la URL en nueva pestaña.
 * @param {string} accessToken - Token OAuth2 del usuario (scope: spreadsheets)
 * @param {string} title - Título del spreadsheet
 * @param {Array<Array>} values - [[headers], [fila1], [fila2], ...]
 */
/**
 * @param {string} accessToken
 * @param {string} title
 * @param {Array<Array>} values - [[headers], [fila1], ...]
 * @param {Window|null} tab - ventana ya abierta síncronamente en el click handler
 */
export async function createAndOpenSheet(accessToken, title, values) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title } }),
  });
  if (!createRes.ok) throw new Error("No se pudo crear el spreadsheet");
  const { spreadsheetId } = await createRes.json();

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  if (!writeRes.ok) throw new Error("No se pudieron escribir los datos");

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
