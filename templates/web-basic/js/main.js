/**
 * Punto de entrada de JavaScript.
 * Se carga como módulo (type="module"), así que puedes usar import/export
 * para dividir el código en varios archivos dentro de /js.
 */

function init() {
  setCurrentYear();
  setupDemoButton();
}

function setCurrentYear() {
  const yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

function setupDemoButton() {
  const button = document.getElementById("demo-button");
  const output = document.getElementById("demo-output");
  if (!button || !output) return;

  let clicks = 0;
  button.addEventListener("click", () => {
    clicks += 1;
    output.textContent = `JavaScript funciona. Clics: ${clicks}`;
  });
}

init();
