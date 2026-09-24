(() => {
  const projects = {
    outpost: {
      kicker: "01 / ROCKBITE GAMES / CURRENT",
      title: "Idle Outpost",
      description: "A business at the end of the world. Trade with survivors, recruit heroes, and build something worth defending.",
      image: "assets/games/idle-outpost.webp",
      url: "https://rockbitegames.com/games/idleoutpost",
      section: ".project-outpost"
    },
    sandship: {
      kicker: "02 / ROCKBITE GAMES / SHIPPED",
      title: "Sandship",
      description: "A moving factory in a strange desert, built around crafting and automation.",
      image: "assets/games/sandship.webp",
      url: "https://rockbitegames.com/games/sandship",
      section: ".project-sandship"
    },
    battle: {
      kicker: "03 / ROCKBITE GAMES / SHIPPED",
      title: "Battle Cards",
      description: "A fast PvP card battler starring heroic ducks. It grew from a game jam prototype into a full release.",
      image: "assets/games/battle-cards.webp",
      url: "https://apps.apple.com/app/id1600226027",
      section: ".project-battle"
    },
    wizard: {
      kicker: "04 / BROWSER GAME / PLAYABLE NOW",
      title: "Idle Wizard",
      description: "A magical idle adventure I'm building now. Meet Elara Starbrew and see where the story goes.",
      image: "assets/games/idle-wizard.webp",
      url: "https://idlewizard.pages.dev/",
      section: ".wizard-card"
    }
  };

  const portals = document.getElementById("world-portals");
  const panel = document.getElementById("discovery-panel");
  const closeButton = document.getElementById("discovery-close");
  const image = document.getElementById("discovery-image");
  const kicker = document.getElementById("discovery-kicker");
  const title = document.getElementById("discovery-title");
  const description = document.getElementById("discovery-description");
  const link = document.getElementById("discovery-link");
  const pageButton = document.getElementById("discovery-page");
  let activeProject = null;
  let lastTrigger = null;

  function closePanel(restoreFocus = true) {
    if (panel.hidden) return;
    panel.hidden = true;
    activeProject = null;
    if (restoreFocus && lastTrigger && document.body.classList.contains("ui-hidden")) lastTrigger.focus();
  }

  function openPanel(key, trigger) {
    const project = projects[key];
    if (!project) return;
    activeProject = project;
    lastTrigger = trigger;
    image.src = project.image;
    kicker.textContent = project.kicker;
    title.textContent = project.title;
    description.textContent = project.description;
    link.href = project.url;
    link.setAttribute("aria-label", "Open " + project.title + " in a new tab");
    panel.hidden = false;
    closeButton.focus();
  }

  portals.addEventListener("click", (event) => {
    const portal = event.target.closest("[data-project]");
    if (portal) openPanel(portal.dataset.project, portal);
  });
  closeButton.addEventListener("click", () => closePanel());
  pageButton.addEventListener("click", () => {
    if (!activeProject) return;
    const destination = document.querySelector(activeProject.section);
    closePanel(false);
    document.getElementById("hud-ui").click();
    destination?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  document.getElementById("explore-world-note")?.addEventListener("click", () => document.getElementById("explore-world").click());
  document.getElementById("mobile-world-enter")?.addEventListener("click", () => document.getElementById("explore-world").click());

  // A portal click should activate its destination, not start a camera drag.
  for (const surface of [portals, panel]) {
    surface.addEventListener("mousedown", (event) => event.stopPropagation());
    surface.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.stopImmediatePropagation();
      closePanel();
    }
  }, true);

  function syncExploreMode() {
    const exploring = document.body.classList.contains("ui-hidden");
    portals.inert = !exploring;
    portals.setAttribute("aria-hidden", String(!exploring));
    if (!exploring) closePanel(false);
  }
  new MutationObserver(syncExploreMode).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  syncExploreMode();
})();
