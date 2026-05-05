export async function ensureThree() {
  if (window.THREE) return window.THREE;
  try {
    const three = await import("https://unpkg.com/three@0.165.0/build/three.module.js");
    window.THREE = three;
    return three;
  } catch {
    await loadClassicThree();
    return window.THREE;
  }
}

function loadClassicThree() {
  return new Promise((resolve, reject) => {
    if (window.THREE) {
      resolve(window.THREE);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js";
    script.async = true;
    script.onload = () => {
      if (window.THREE) resolve(window.THREE);
      else reject(new Error("Three.js loaded without a global THREE export."));
    };
    script.onerror = () => reject(new Error("Three.js failed to load."));
    document.head.appendChild(script);
  });
}
