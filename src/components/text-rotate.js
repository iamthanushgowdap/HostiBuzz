/**
 * TextRotate component (Vanilla JS version)
 * Rotates through an array of words with an animation.
 * Features a persistent background box that resizes to fit each word.
 */
export function initTextRotate(elementId, texts, interval = 2500) {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Create the persistent container
  // whitespace-pre ensures spaces are preserved in the ghost measurement
  element.innerHTML = `
    <span class="rotate-box inline-flex items-center justify-center px-6 py-2 bg-[#ff5941] text-white rounded-[1.5rem] md:rounded-[2.5rem] italic shadow-[0_10px_40px_rgba(255,89,65,0.3)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative overflow-hidden">
      <span class="rotate-text-container relative flex items-center justify-center">
        <!-- Ghost span to maintain size dynamically based on the current word -->
        <span class="ghost-text invisible pointer-events-none whitespace-pre font-headline font-bold italic translate-y-[0.05em]"></span>
        <!-- Visible animating texts will be injected as absolute children -->
      </span>
    </span>
  `;

  const container = element.querySelector('.rotate-text-container');
  const ghost = element.querySelector('.ghost-text');
  let currentIndex = 0;

  function updateDisplay(index) {
    const word = texts[index];
    
    // Update ghost text to resize the box naturally via flex-flow
    ghost.textContent = word;
    
    // Create new visible text element
    const newText = document.createElement('span');
    // Using opacity-0 and translate-y-[100%] for entry animation
    newText.className = 'absolute inset-0 whitespace-pre transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform translate-y-[100%] opacity-0 flex items-center justify-center font-headline font-bold italic translate-y-[0.05em]';
    newText.textContent = word;
    
    container.appendChild(newText);
    
    // Trigger animations in the next frame
    setTimeout(() => {
      const children = Array.from(container.children);
      children.forEach(child => {
        // Slide out old text elements
        if (child !== newText && child !== ghost) {
          child.classList.add('translate-y-[-140%]', 'opacity-0');
          setTimeout(() => child.remove(), 600);
        }
      });

      // Slide in the new text element
      newText.classList.remove('translate-y-[100%]', 'opacity-0');
      newText.classList.add('translate-y-0', 'opacity-100');
    }, 50);
  }

  // Initial render
  updateDisplay(currentIndex);

  const rotationInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % texts.length;
    updateDisplay(currentIndex);
  }, interval);

  return () => clearInterval(rotationInterval);
}
