const navbar = document.querySelector('.navbar');
const toggle = navbar.querySelector('.navbar-toggle');
const links = document.getElementById('primary-navigation');
const mobile = window.matchMedia('(max-width: 760px)');

function setOpen(open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

toggle.addEventListener('click', () => {
  setOpen(toggle.getAttribute('aria-expanded') !== 'true');
});

navbar.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    setOpen(false);
    toggle.focus();
  }
});

document.addEventListener('click', (event) => {
  if (!navbar.contains(event.target)) setOpen(false);
});

navbar.addEventListener('focusout', (event) => {
  if (!navbar.contains(event.relatedTarget)) setOpen(false);
});

links.addEventListener('click', (event) => {
  if (event.target.closest('a')) setOpen(false);
});

mobile.addEventListener('change', () => {
  if (mobile.matches && links.contains(document.activeElement)) toggle.focus();
  if (!mobile.matches && document.activeElement === toggle) {
    navbar.querySelector('.navbar-home').focus();
  }
  setOpen(false);
});

// Keep the links available if JavaScript is disabled or fails to load.
navbar.classList.add('navbar--collapsible');
toggle.hidden = false;
