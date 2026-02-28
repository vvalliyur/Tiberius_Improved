import { useRef, useEffect } from 'react';

export const useScrollbar = () => {
  const ref = useRef(null);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleScroll = () => {
      element.classList.add('scrolling');
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(() => {
        element.classList.remove('scrolling');
      }, 1000);
    };

    element.addEventListener('scroll', handleScroll);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  return ref;
};

