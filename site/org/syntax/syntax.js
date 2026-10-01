// Opens the "Advanced Usage" box (a <details>) that holds the element a link points at, so that
// #links, #save and the like land on something visible. No other behaviour.
(function () {
  function reveal() {
    var id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!id) return;
    var el = document.getElementById(id) || document.querySelector('a[name="' + id.replace(/"/g, '') + '"]');
    if (!el) return;
    var opened = false;
    for (var d = el.parentNode; d; d = d.parentNode) if (d.tagName === 'DETAILS' && !d.open) { d.open = true; opened = true; }
    if (opened) el.scrollIntoView();
  }
  reveal();
  window.addEventListener('hashchange', reveal);
})();
