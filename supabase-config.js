window.CHAMPION_SUPABASE_CONFIG = {
  url: "https://zahskmumgqbhkvcgtamk.supabase.co",
  anonKey: "sb_publishable_-DE_STI_AAD4A34Tii1MbQ_lQlm1I5n",
  academySlug: "champion-team-jiu-jitsu"
};

// V40.4: imagem exata do lutador fornecida pelo usuário.
(() => {
  const version = "40.4";
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = `mobile-first-v38.css?v=${version}`;
  document.head.appendChild(css);

  window.addEventListener("load", () => {
    const script = document.createElement("script");
    script.src = `mobile-first-v38.js?v=${version}`;
    script.defer = true;
    document.body.appendChild(script);
  }, { once: true });
})();
