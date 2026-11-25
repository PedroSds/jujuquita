(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const targets = '.hero, .benefits, .categories, .category, .highlights, .product, .story, .faq, footer, #collection-page, #product-page, #product-form > details';
  const observed = new Set();
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const element = entry.target;
      element.dataset.motionSeen = '';
      // Replay on a genuine re-entry, not on every tiny scroll.
      element.classList.toggle('motion-enter', entry.isIntersecting && !preference.matches);
    }
  }, {threshold:0, rootMargin:'0px'}) : null;
  function observe() {
    if (!observer) return;
    for (const element of observed) {
      if (!element.isConnected) { observer.unobserve(element); observed.delete(element); }
    }
    for (const element of document.querySelectorAll(targets)) {
      if (observed.has(element)) continue;
      observed.add(element);
      observer.observe(element);
    }
  }
  preference.addEventListener?.('change', () => {
    for (const element of observed) {
      element.classList.remove('motion-enter');
      observer.unobserve(element);
    }
    observed.clear();
    observe();
  });
  window.storeMotion = {observe};
  observe();
})();
