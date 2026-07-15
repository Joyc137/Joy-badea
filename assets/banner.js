/**
 * banner.js
 * Handles any banner interactions that CSS alone can't cover —
 * e.g. triggering the CTA animation on scroll into view.
 * If the animation is achievable purely with CSS :hover/:active,
 * this file can be omitted entirely.
 */

document.addEventListener('DOMContentLoaded', initBanner);

/**
 * Sets up an IntersectionObserver to add a class when the banner
 * scrolls into the viewport, allowing a one-time entrance animation
 * separate from the hover/active states handled in CSS.
 */
function initBanner() {
  const banner = document.querySelector('.custom-banner');
  if (!banner) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          banner.classList.add('custom-banner--visible');
          observer.unobserve(entry.target); // only animate once
        }
      });
    },
    { threshold: 0.2 }
  );

  observer.observe(banner);
}