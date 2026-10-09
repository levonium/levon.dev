export const $ = (sel) =>
  sel.startsWith("#")
    ? document.getElementById(sel.slice(1))
    : document.querySelector(sel);

export const $$ = (sel) => document.querySelectorAll(sel);

export const show = (el) => el && el.classList.remove("hidden");
export const hide = (el) => el && el.classList.add("hidden");

export function openLink(url) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener,noreferrer";
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyEmail() {
  try {
    await navigator.clipboard.writeText(["levon", "levon.dev"].join("@"));
  } catch {
    alert("Could not copy email. Make sure the page is served over HTTPS.");
  }
}
