function shuffleCovers(covers) {
  const shuffled = [...covers];
  for (let end = shuffled.length - 1; end > 0; end--) {
    const pick = Math.floor(Math.random() * (end + 1));
    [shuffled[end], shuffled[pick]] = [shuffled[pick], shuffled[end]];
  }
  return shuffled;
}

async function showAlbumCovers() {
  const response = await fetch("./album-covers.json");
  if (!response.ok) return;
  const covers = shuffleCovers(await response.json());
  if (!covers.length) return;

  const figure = document.createElement("figure");
  figure.className = "sidebar-figure";
  const caption = document.createElement("figcaption");
  const profile = document.createElement("a");
  profile.href = "https://www.last.fm/user/mg_james";
  profile.textContent = "Last.fm";
  caption.append("My 100 most-played albums over the past three months · ", profile);
  const slideshow = document.createElement("div");
  slideshow.className = "album-covers";
  const dissolveDuration = 4200;
  const coverInterval = 8000;
  slideshow.style.setProperty("--album-dissolve-duration", `${dissolveDuration}ms`);
  slideshow.insertAdjacentHTML("beforeend", `
    <svg width="0" height="0" aria-hidden="true" style="position:absolute">
      <defs>
        <filter id="album-sharpen" color-interpolation-filters="sRGB">
          <feConvolveMatrix kernelMatrix="0 -0.12 0 -0.12 1.48 -0.12 0 -0.12 0" preserveAlpha="true"/>
        </filter>
      </defs>
    </svg>`);
  figure.append(slideshow, caption);

  let current, next;
  let timer;
  let index = 0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  if (document.fullscreenEnabled) {
    const fullscreen = document.createElement("button");
    fullscreen.className = "album-fullscreen";
    fullscreen.type = "button";
    fullscreen.setAttribute("aria-label", "Show album covers fullscreen");
    fullscreen.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg>';
    fullscreen.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement === slideshow) await document.exitFullscreen();
        else await slideshow.requestFullscreen();
      } catch {
        // The browser can deny fullscreen in an embedded preview.
      }
    });
    document.addEventListener("fullscreenchange", () => {
      const active = document.fullscreenElement === slideshow;
      fullscreen.setAttribute("aria-label", active ? "Exit fullscreen" : "Show album covers fullscreen");
    });
    slideshow.append(fullscreen);
  }

  async function loadNext() {
    const cover = covers[index];
    index = (index + 1) % covers.length;
    const image = new Image();
    image.alt = cover.title;
    const original = cover.image.replace(/(\/i\/u\/)\d+x\d+\//, "$1");
    const sources = mobileLayout.matches && document.fullscreenElement !== slideshow
      ? [cover.image, original]
      : [original, cover.image];
    for (const source of new Set(sources)) {
      image.src = source;
      try {
        await image.decode();
        return image;
      } catch {
        // Try the other size before skipping unavailable artwork.
      }
    }
    return null;
  }

  function show(image) {
    const outgoing = current;
    current = image;
    slideshow.append(image);
    if (!outgoing) {
      image.classList.add("visible");
      placePageFigure(figure);
      return;
    }

    image.getBoundingClientRect();
    outgoing.setAttribute("aria-hidden", "true");
    outgoing.classList.replace("visible", "outgoing");
    image.classList.add("visible");
    setTimeout(() => outgoing.remove(), dissolveDuration);
  }

  function preload() {
    next = { ready: false, image: null };
    loadNext().then(image => {
      next.image = image;
      next.ready = true;
    });
  }

  function advance() {
    if (next.ready) {
      if (next.image) show(next.image);
      preload();
    }
  }

  for (let attempts = 0; attempts < covers.length; attempts++) {
    const image = await loadNext();
    if (!image) continue;
    show(image);
    if (covers.length > 1) {
      const playback = document.createElement("button");
      playback.className = "album-playback";
      playback.type = "button";
      playback.textContent = "Play slideshow";

      function setPlaying(playing) {
        clearInterval(timer);
        slideshow.classList.toggle("is-playing", playing);
        if (playing) {
          playback.remove();
          if (!next) preload();
          timer = setInterval(advance, coverInterval);
        } else {
          slideshow.append(playback);
        }
      }

      playback.addEventListener("click", () => setPlaying(true));
      reducedMotion.addEventListener("change", () => setPlaying(!reducedMotion.matches));
      setPlaying(!reducedMotion.matches);
    }
    break;
  }
}

showAlbumCovers().catch(() => {
  // The writing page remains usable if the cover feed is unavailable.
});
