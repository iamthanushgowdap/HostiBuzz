/* ── Global Footer Component ────────────────────────── */
export function renderFooter() {
  return `
    <footer class="hb-footer" id="hb-global-footer">
      <!-- Spider Clock side (35%) -->
      <div class="hb-footer__clock" id="footer-clock-area">
        <div id="footer-spider-wBody">
          <div id="footer-spider-watch">
            <svg id="footer-spider-svg" overflow="visible" viewBox="-380 -100 850 350">
              <use class="footer-cog footer-cw footer-t24" fill-opacity="0.55" href="#spider-cog1" />
              <use class="footer-cog footer-ccw footer-t12" fill-opacity="0.45" href="#spider-cog2" />
              <g transform="matrix(0.93,0,0,0.93,9.46,5.75)">
                <use class="footer-cog footer-cw footer-t24" fill-opacity="0.4" href="#spider-cog1" transform="rotate(-51.81,132.28,-30.52)" />
              </g>
              <g transform="rotate(-3.76,160.79,349.23)">
                <use class="footer-cog footer-cw footer-t20" fill-opacity="0.4" href="#spider-cog5" />
              </g>
              <use id="footer-clockFace" fill="#a7a5ff" fill-opacity="0.15" stroke="none" href="#spider-arabic" filter="url(#spider-shadow)" />
              <g id="footer-spiderGroup" transform="matrix(3.7795276,0,0,3.7795276,0,0)">
                <path fill="#a7a5ff" stroke="none" filter="url(#spider-shadow)"
                  d="m 33.5,21.4 -3.7,8.4 c -0.1,0.3 -0.1,0.5 0,0.7 l 1.4,6.4 6,1.8 -6,1.9 -1.4,4.7 c -0.1,0.3 -0.1,0.5 0.1,0.8 l 3.6,5.7 0.5,-0.2 c -2.1,-3.6 -2.9,-5.2 -2.8,-5.9 0.8,-4.4 1.5,-3.3 8.5,-5.3 7,2 7.3,0.8 8.5,5.3 0.2,0.7 -0.3,1.8 -2.8,5.9 l 0.5,0.2 3.5,-5.7 c 0.1,-0.2 0.2,-0.4 0.1,-0.7 l -1.3,-4.8 -6,-1.9 6,-1.8 1.4,-6.4 c 0.1,-0.3 0.1,-0.4 0,-0.7 l -3.7,-8.4 -0.5,0.2 c 1.8,4.3 3,7.6 2.9,8.4 -0.4,6.2 -1.5,5.1 -8.6,7.1 -7.1,-2 -8.2,-0.9 -8.6,-7.1 -0.1,-0.7 1.1,-4.1 2.9,-8.4 z" />
                <g id="footer-hr">
                  <circle fill="#a7a5ff" fill-opacity="0" cx="39.75" cy="39.14" r="56.37" />
                  <path id="footer-hand-hr" fill="#a7a5ff" stroke="none" filter="url(#spider-shadow)" d="" />
                </g>
                <g id="footer-min">
                  <circle fill="#a7a5ff" fill-opacity="0" cx="39.75" cy="39.14" r="56.37" />
                  <path id="footer-hand-min" fill="#a7a5ff" stroke="none" filter="url(#spider-shadow)" d="" />
                </g>
                <g id="footer-sec">
                  <circle fill="#53ddfc" fill-opacity="0" cx="39.75" cy="39.14" r="56.37" />
                  <path id="footer-hand-sec" fill="#53ddfc" stroke="none" filter="url(#spider-shadow)" d="" />
                </g>
                <path fill="#a7a5ff" stroke="none" filter="url(#spider-shadow2)"
                  d="m 38.3,32.5 c -0.8,0.4 -4.1,4.1 -1.3,8 -0.3,1.1 0,4.1 2.6,4.2 2.6,0.1 3.1,-3 2.6,-4.2 2.5,-3.5 0.1,-7.3 -0.9,-8 -1.2,-1 -1.7,-1.1 -3,0 z" />
                <path id="footer-face" fill="#a7a5ff" stroke="none" filter="url(#spider-shadow2)" d="" />
                <path fill="#0a0e19" stroke="none"
                  d="m 42,43.2 c -0.2,0.5 -1.2,1.6 -2.4,1.6 -1.1,0 -2,-1.1 -2.3,-1.7 -0.3,-0.5 1.1,-1.2 2.3,-1.2 1.1,0 2.6,0.7 2.4,1.2 z" />
              </g>
            </svg>
          </div>
        </div>
        <p class="hb-footer__clock-label">SYSTEM TIME</p>
      </div>

      <!-- Details side (65%) -->
      <div class="hb-footer__details">
        <div class="hb-footer__brand">
          <span class="hb-footer__brand-name">HostiBuzz</span>
          <span class="hb-footer__brand-version">v2.1.0</span>
        </div>
        <div class="hb-footer__author">
          <span class="hb-footer__author-name">Tanush Gowda P</span>
          <span class="hb-footer__author-title">Lead Technical Architect &amp; Developer</span>
        </div>
        <p class="hb-footer__copy">© 2026 · HostiBuzz Platform · Open Source Project Obsidian</p>
      </div>
    </footer>
  `;
}

export function initFooterClock() {
  if (typeof gsap === 'undefined' || !document.getElementById('footer-spider-svg')) return;

  const face01d = document.getElementById('spider-face01')?.getAttribute('d');
  const face02d = document.getElementById('spider-face02')?.getAttribute('d');
  const handSec01d = document.getElementById('spider-handSec01')?.getAttribute('d');
  const handMin01d = document.getElementById('spider-handMin01')?.getAttribute('d');
  const handHr01d  = document.getElementById('spider-handHr01')?.getAttribute('d');
  if (!face01d) return;

  if (typeof MorphSVGPlugin !== 'undefined') gsap.registerPlugin(MorphSVGPlugin);

  gsap.set('#footer-face',     { attr: { d: face01d } });
  gsap.set('#footer-hand-sec', { attr: { d: handSec01d } });
  gsap.set('#footer-hand-min', { attr: { d: handMin01d } });
  gsap.set('#footer-hand-hr',  { attr: { d: handHr01d  } });

  const sec = document.getElementById('footer-sec');
  const min = document.getElementById('footer-min');
  const hr  = document.getElementById('footer-hr');

  function secRot() {
    const r = new Date().getSeconds() * 6;
    const sx = gsap.getProperty(sec, 'scaleX');
    if (r >= 180 && r < 360 && sx === 1) gsap.to(sec, { scaleX: -1, duration: 0.2 });
    else if ((r < 180 || r >= 360) && sx === -1) gsap.to(sec, { scaleX: 1, duration: 0.2 });
    return r;
  }
  function minRot() {
    const d = new Date(); return d.getMinutes() * 6 + d.getSeconds() * 6 / 59;
  }
  function hrRot() {
    const d = new Date(); return (d.getHours() % 12) * 30 + d.getMinutes() * 0.5;
  }

  gsap.set(sec, { rotation: secRot, transformOrigin: '50% 50%' });
  gsap.set(min, { rotation: minRot, transformOrigin: '50% 50%' });
  gsap.set(hr,  { rotation: hrRot,  transformOrigin: '50% 50%' });

  gsap.to('.footer-cw.footer-t24',  1, { rotation: '-=15', transformOrigin: '50% 50%', ease: 'bounce', onComplete() { this.invalidate().delay(1).restart(true); } });
  gsap.to('.footer-cw.footer-t20',  1, { rotation: '-=18', transformOrigin: '50% 50%', ease: 'bounce', onComplete() { this.invalidate().delay(1).restart(true); } });
  gsap.to('.footer-ccw.footer-t12', 1, { rotation: '+=30', transformOrigin: '50% 50%', ease: 'bounce', onComplete() { this.invalidate().delay(1).restart(true); } });

  gsap.to(sec, 0.5, {
    rotation: secRot, transformOrigin: '50% 50%', ease: 'bounce',
    onComplete() {
      secRot();
      if (gsap.getProperty(sec, 'rotation') >= 360) gsap.set(sec, { rotation: 0, transformOrigin: '50% 50%' });
      this.invalidate().delay(0).restart(true);
    }
  });
  gsap.to(min, 0.5, {
    rotation: minRot, transformOrigin: '50% 50%', ease: 'none',
    onComplete() {
      if (gsap.getProperty(min, 'rotation') >= 360) gsap.set(min, { rotation: 0, transformOrigin: '50% 50%' });
      this.invalidate().delay(5).restart(true);
    }
  });
  gsap.to(hr, 0.5, {
    rotation: hrRot, transformOrigin: '50% 50%', ease: 'none',
    onComplete() {
      if (gsap.getProperty(hr, 'rotation') >= 360) gsap.set(hr, { rotation: 0, transformOrigin: '50% 50%' });
      this.invalidate().delay(30).restart(true);
    }
  });

  if (typeof MorphSVGPlugin !== 'undefined') {
    gsap.timeline({ repeat: -1, repeatDelay: 5 })
      .to('#footer-face', { duration: 0.5, morphSVG: '#spider-face02', repeat: 4, yoyo: true, ease: 'power1.out' });
  }

  document.getElementById('footer-clock-area')?.classList.add('footer-clock-ready');
}
