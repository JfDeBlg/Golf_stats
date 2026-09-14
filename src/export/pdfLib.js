// Chargement paresseux partagé de jsPDF (vendoré, src/lib/jspdf.umd.min.js, build UMD,
// jamais chargé depuis un CDN) — utilisé par roundPdf.js (export de partie) et statsPdf.js
// (export de statistiques). Injecté via un <script> classique à la demande, jamais au
// démarrage de l'app — même précaution que pdf.js/JSZip (cf. README.md, 1.2.5).

let jsPDFLoadPromise = null;

export function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPDFLoadPromise) {
    jsPDFLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../lib/jspdf.umd.min.js', import.meta.url).href;
      script.onload = () => resolve(window.jspdf?.jsPDF);
      script.onerror = () => reject(new Error('Impossible de charger jsPDF.'));
      document.head.appendChild(script);
    });
  }
  return jsPDFLoadPromise;
}
