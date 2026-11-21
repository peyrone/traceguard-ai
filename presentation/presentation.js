const slides = Array.from(document.querySelectorAll("main section"));
const links = Array.from(document.querySelectorAll("nav a"));
const back = document.querySelector("#back");
const forward = document.querySelector("#forward");
const dialog = document.querySelector("dialog");
const thumb = document.querySelector("#thumb");
const imageLabels = {
  verified: "ยืนยันการส่ง · Unauthorized transfer",
  missing: "หลักฐานขาด · Missing intermediate evidence",
};
let current = 0;

function render(focus = false) {
  const index = slides.findIndex((slide) => "#" + slide.id === location.hash);
  current = Math.max(index, 0);
  slides.forEach((slide, i) => {
    slide.hidden = i !== current;
    if (i === current) links[i].setAttribute("aria-current", "step");
    else links[i].removeAttribute("aria-current");
  });
  back.disabled = current === 0;
  forward.disabled = current === slides.length - 1;
  document.querySelector("#count").value = current + 1 + " / " + slides.length;
  if (focus) {
    const title = slides[current].querySelector("h1,h2");
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}
function step(delta) {
  const slide = slides[current + delta];
  if (slide) location.hash = slide.id;
}
back.onclick = () => step(-1);
forward.onclick = () => step(1);
window.addEventListener("hashchange", () => render(true));
window.addEventListener("keydown", (event) => {
  if (dialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    step(event.key === "ArrowRight" ? 1 : -1);
  }
});
document.querySelectorAll("[data-image]").forEach((button) => {
  button.onclick = () => {
    document
      .querySelectorAll("[data-image]")
      .forEach((other) =>
        other.setAttribute("aria-pressed", String(other === button)),
      );
    const name = button.dataset.image;
    thumb.src = "./assets/" + name + ".jpg";
    thumb.alt = "ภาพจากการซ้อม · " + imageLabels[name];
  };
});
document.querySelector("#preview").onclick = () => {
  document.querySelector("#large").src = thumb.src;
  document.querySelector("#large").alt = thumb.alt;
  document.querySelector("#caption").textContent = thumb.alt;
  dialog.showModal();
};
document.querySelector("#close").onclick = () => dialog.close();
render();
