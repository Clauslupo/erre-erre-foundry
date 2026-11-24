/* Lo mínimo de rr.js que usa el builder (el menú ya lo pone la web de fuera). */
window.RR = window.RR || {};
(function () {
  RR.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  RR.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  RR.ARROW = '<svg class="arrow" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1"><path d="M1.5 8.5 8.5 1.5M3 1.5h5.5V7"/></svg>';
  let toastEl, toastT;
  RR.toast = (msg) => {
    if (!toastEl) { toastEl = RR.h('<div class="toast t1"></div>'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600);
  };
  RR.isTyping = (e) => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
  RR.header = () => null;
})();
