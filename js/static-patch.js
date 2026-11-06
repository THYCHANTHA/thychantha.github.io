/* Static-hosting behaviour: the contact form opens the visitor's email app (no server on GitHub Pages). */
(function () {
  var form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault(); e.stopImmediatePropagation();
    var f = new FormData(form);
    var name = (f.get('name') || '').toString().trim(), email = (f.get('email') || '').toString().trim();
    var subject = (f.get('subject') || '').toString().trim(), message = (f.get('message') || '').toString().trim();
    var status = document.getElementById('formStatus');
    if (!name || !email || !subject || !message) {
      if (status) { status.className = 'form-status err'; status.textContent = 'Please complete all fields before sending.'; }
      return;
    }
    var body = message + '\n\n' + name + '\n' + email;
    window.location.href = 'mailto:thychanthaitc@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    if (status) { status.className = 'form-status ok'; status.textContent = 'Opening your email app. If nothing opens, write to thychanthaitc@gmail.com.'; }
  }, true);
})();
