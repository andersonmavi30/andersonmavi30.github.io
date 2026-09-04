(function portfolioApp() {
  const concepts = [
    ["Network Operations Center","Centro de operaciones con telemetría y módulos densos.","Operations center with telemetry and dense modules."],
    ["Terminal Portfolio","Consola Linux, comandos y salida estructurada.","Linux console, commands and structured output."],
    ["Cyberpunk NetDevOps","Neón, capas angulares y energía futurista.","Neon, angular layers and futuristic energy."],
    ["Cisco Blueprint","Plano técnico inspirado en topologías de red.","Technical blueprint inspired by network topologies."],
    ["Bento Tech","Bloques editoriales, amplios y modulares.","Large, modular editorial blocks."],
    ["Developer Documentation","Portafolio que se lee como documentación profesional.","A portfolio that reads like professional documentation."],
    ["Digital Lab Notebook","Cuaderno técnico para evidencias y aprendizaje.","Technical notebook for evidence and learning."],
    ["Infrastructure Command Center","Panel ejecutivo con señales de infraestructura.","Executive panel with infrastructure signals."],
    ["Swiss Tech Minimal","Tipografía protagonista, orden y contraste.","Type-led composition, order and contrast."],
    ["Hybrid Professional Geek","Profesional por fuera, terminal por dentro.","Professional outside, terminal inside."],
    ["Retro CRT Console","Monitor ámbar, scanlines y estética retrocomputing.","Amber monitor, scanlines and retro-computing aesthetics."],
    ["Packet Flow","El recorrido profesional como flujo de paquetes.","A professional journey shaped like packet flow."],
    ["Glass NOC","Capas translúcidas y profundidad de centro de datos.","Translucent layers and data-center depth."],
    ["Credentials First","Certificaciones y evidencia técnica en primer plano.","Certifications and technical evidence first."],
    ["Tech Magazine","Portada editorial para historias, labs y conocimiento.","Editorial cover for stories, labs and knowledge."],
    ["Corporate Technology","Presencia empresarial para soluciones, confianza y alcance.","Enterprise presence for solutions, trust and reach."],
    ["Expert Consultant","Autoridad técnica personal orientada a resolver problemas.","Personal technical authority focused on solving problems."],
    ["Open Source Academy","Comunidad, artículos, videos y formación práctica.","Community, articles, videos and hands-on training."],
    ["Cybersecurity Integrator","Servicios, fabricantes y continuidad operativa.","Services, vendors and operational continuity."],
    ["MV Networks Flagship","La síntesis premium de marca personal y ecosistema técnico.","The premium synthesis of personal brand and technical ecosystem."]
  ];

  const badges = [
    ["Fortinet NSE 7","Secure Networking","https://www.credly.com/badges/dd862eb2-e088-40f6-bfd2-e24dae6854ca","https://images.credly.com/size/340x340/images/78002279-deb4-4dea-9610-71ece769fb8e/blob"],
    ["Fortinet NSE 6","Secure Networking","https://www.credly.com/badges/4a205998-a8e1-44ec-9ee5-4e4658b78954","https://images.credly.com/size/340x340/images/f9429e70-1150-4cea-9e73-f0758b32624b/blob"],
    ["Fortinet NSE 5","Security Operations","https://www.credly.com/badges/0a661582-2c06-4c59-8a75-08280ad3725c","https://images.credly.com/size/340x340/images/93c253eb-be01-4541-a48c-c66a6cfd9ffd/blob"],
    ["Fortinet NSE 4","FortiOS","https://www.credly.com/badges/23a0abd6-02cb-4e96-9275-03be39aa98ac","https://images.credly.com/size/340x340/images/7413400c-4630-40ab-b8ac-200eaee90e58/blob"],
    ["LPIC-1","Linux Professional","https://www.credly.com/badges/3e068b47-80ea-421d-8a18-fdf2dc1bf034","https://images.credly.com/size/340x340/images/82e8df94-e88e-4f3b-b247-8ca5f8a5b6d4/blob"]
  ];

  const videos = [
    ["RFqPiwiMiE8","Automatización de redes Cisco con Ansible","Cisco network automation with Ansible","ANSIBLE"],
    ["j3kJNs3oHP8","Publicación de servicios web","Web service publishing","FORTIWEB · WAF"],
    ["sbXFHW9OGwY","Ataque DoS y política IPS","DoS attack and IPS policy","FIREWALL ADMINISTRATION"]
  ];

  const links = [
    ["LinkedIn","Trayectoria profesional","Professional journey","https://www.linkedin.com/in/anderson-martinez-virviescas-b5b79b106/?skipRedirect=true","in"],
    ["GitHub","Código y proyectos","Code and projects","https://github.com/andersonmavi30","GH"],
    ["GitLab","Repositorios y CI/CD","Repositories and CI/CD","https://gitlab.com/andersonmavi30","GL"],
    ["Docker Hub","Imágenes y contenedores","Images and containers","https://hub.docker.com/u/andersonmavi30","DH"]
  ];

  const n = Number(document.body.dataset.concept || 1);
  const c = concepts[n-1] || concepts[0];
  document.title = `${String(n).padStart(2,"0")} · ${c[0]} — Anderson Martinez Virviescas`;

  const badgeHTML = badges.map(b => `<a class="badge" href="${b[2]}" target="_blank" rel="noopener"><img src="${b[3]}" alt="${b[0]} badge" loading="lazy"><span><strong>${b[0]}</strong><small>${b[1]}</small></span></a>`).join("");
  const videoHTML = videos.map(v => `<article class="video-card"><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${v[0]}" title="${v[1]}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="video-copy"><small>${v[3]}</small><h3 data-es="${v[1]}" data-en="${v[2]}">${v[1]}</h3><a href="https://youtu.be/${v[0]}" target="_blank" rel="noopener"><span data-es="Ver en YouTube" data-en="Watch on YouTube">Ver en YouTube</span> ↗</a></div></article>`).join("");
  const linkHTML = links.map(l => `<a class="profile-link" href="${l[3]}" target="_blank" rel="noopener"><b>${l[4]}</b><span><strong>${l[0]}</strong><small data-es="${l[1]}" data-en="${l[2]}">${l[1]}</small></span><i>↗</i></a>`).join("");

  document.getElementById("app").innerHTML = `
    <div class="ambient" aria-hidden="true"></div>
    <header class="topbar">
      <a class="brand" href="../../"><span>AM</span><b>Anderson Martinez Virviescas</b></a>
      <nav class="design-nav" aria-label="Design navigation">
        <a href="../" title="Todos los diseños">▦</a>
        <a href="../${String(n === 1 ? 20 : n-1).padStart(2,"0")}/" aria-label="Diseño anterior">←</a>
        <strong>${String(n).padStart(2,"0")} / 20</strong>
        <a href="../${String(n === 20 ? 1 : n+1).padStart(2,"0")}/" aria-label="Diseño siguiente">→</a>
      </nav>
      <div class="controls">
        <button id="language" type="button" aria-label="Cambiar idioma">EN</button>
        <button id="theme" type="button" aria-label="Cambiar tema"><span class="sun">☀</span><span class="moon">☾</span></button>
      </div>
    </header>

    <main>
      <section class="hero section-shell">
        <div class="hero-kicker"><span>${String(n).padStart(2,"0")}</span> ${c[0]}</div>
        <div class="hero-copy">
          <p class="eyebrow">NETWORK AUTOMATION · NETDEVOPS · DEVNET · NETWORK ADMINISTRATION · FIREWALL ADMINISTRATION · LINUX ADMINISTRATION</p>
          <h1><span data-es="Hola, soy" data-en="Hi, I'm">Hola, soy</span><em>Anderson Martinez Virviescas.</em></h1>
          <p class="lede" data-es="Administrador de redes y especialista en infraestructura que documenta proyectos, laboratorios y aprendizaje técnico con evidencia real." data-en="Network administrator and infrastructure specialist documenting projects, labs and technical learning through real evidence.">Administrador de redes y especialista en infraestructura que documenta proyectos, laboratorios y aprendizaje técnico con evidencia real.</p>
          <div class="hero-actions">
            <a class="primary" href="#work" data-es="Explorar mi trabajo" data-en="Explore my work">Explorar mi trabajo</a>
            <a class="secondary" href="#connect" data-es="Conectar" data-en="Connect">Conectar</a>
          </div>
        </div>
        <aside class="hero-signal">
          <div><small>STATUS</small><b><i></i> ONLINE</b></div>
          <div><small>FOCUS</small><b>INFRA + CODE</b></div>
          <div><small>LANG</small><b>ES / EN</b></div>
          <div class="signal-lines"><span></span><span></span><span></span><span></span><span></span></div>
        </aside>
      </section>

      <section class="intro section-shell" id="profile">
        <div class="section-head"><span>01</span><p data-es="PRESENTACIÓN PROFESIONAL" data-en="PROFESSIONAL PROFILE">PRESENTACIÓN PROFESIONAL</p><h2 data-es="Experiencia, CV y certificaciones" data-en="Experience, résumé and certifications">Experiencia, CV y certificaciones</h2></div>
        <div class="intro-grid">
          <article class="info-card about"><small data-es="PRESENTACIÓN" data-en="PROFILE">PRESENTACIÓN</small><h3 data-es="Sobre mí" data-en="About me">Sobre mí</h3><p data-es="Experiencia en routing, switching, firewalls, Linux, virtualización y automatización. Conecto operación, seguridad y código para construir infraestructura más confiable." data-en="Experience in routing, switching, firewalls, Linux, virtualization and automation. I connect operations, security and code to build more reliable infrastructure.">Experiencia en routing, switching, firewalls, Linux, virtualización y automatización. Conecto operación, seguridad y código para construir infraestructura más confiable.</p></article>
          <article class="info-card cv"><small data-es="EXPERIENCIA Y CV" data-en="EXPERIENCE & RÉSUMÉ">EXPERIENCIA Y CV</small><h3 data-es="Trayectoria profesional" data-en="Professional journey">Trayectoria profesional</h3><p data-es="Administración de redes, seguridad perimetral, Linux y automatización aplicada a entornos reales." data-en="Network administration, perimeter security, Linux and automation applied to real environments.">Administración de redes, seguridad perimetral, Linux y automatización aplicada a entornos reales.</p><a href="#connect" data-es="Solicitar CV →" data-en="Request résumé →">Solicitar CV →</a></article>
          <article class="info-card stack"><small>CORE STACK</small><h3 data-es="Tecnologías" data-en="Technologies">Tecnologías</h3><div class="chips"><span>Cisco</span><span>Fortinet</span><span>Linux</span><span>Python</span><span>Ansible</span><span>Docker</span><span>GitLab CI/CD</span><span>PNETLab</span></div></article>
        </div>
        <div class="credentials">
          <div class="credentials-title"><span>5</span><h3 data-es="Credenciales verificables" data-en="Verifiable credentials">Credenciales verificables</h3><p data-es="Selecciona cualquier badge para comprobarlo en Credly." data-en="Select any badge to verify it on Credly.">Selecciona cualquier badge para comprobarlo en Credly.</p></div>
          <div class="badge-grid">${badgeHTML}</div>
        </div>
      </section>

      <section class="work section-shell" id="work">
        <div class="section-head"><span>02</span><p data-es="TRABAJO DEMOSTRABLE" data-en="DEMONSTRABLE WORK">TRABAJO DEMOSTRABLE</p><h2 data-es="Proyectos y laboratorios" data-en="Projects and labs">Proyectos y laboratorios</h2></div>
        <div class="project-grid">
          <a class="project p1" href="https://user.pnetlab.com/store/labs/detail?id=16035210484490" target="_blank" rel="noopener"><span>LAB 01</span><small>DEVNET · CISCO SWITCHING</small><h3>Network Automation with Python</h3><p data-es="Automatización reproducible sobre una topología de laboratorio." data-en="Repeatable automation on a lab topology.">Automatización reproducible sobre una topología de laboratorio.</p><b>PNETLab ↗</b></a>
          <a class="project p2" href="https://user.pnetlab.com/store/labs/detail?id=16029901299799" target="_blank" rel="noopener"><span>LAB 02</span><small>FORTINET</small><h3>Deployment and Implementation of FortiGate</h3><p data-es="Despliegue, políticas y operación de firewall." data-en="Firewall deployment, policies and operations.">Despliegue, políticas y operación de firewall.</p><b>PNETLab ↗</b></a>
          <article class="project p3"><span>FIELD 03</span><small>LINUX · VIRTUALIZATION</small><h3 data-es="Infraestructura de laboratorio" data-en="Lab infrastructure">Infraestructura de laboratorio</h3><p data-es="Entornos para probar, romper, entender y documentar." data-en="Environments built to test, break, understand and document.">Entornos para probar, romper, entender y documentar.</p><b data-es="DOCUMENTACIÓN EN PROGRESO" data-en="DOCUMENTATION IN PROGRESS">DOCUMENTACIÓN EN PROGRESO</b></article>
        </div>
      </section>

      <section class="knowledge section-shell">
        <div class="section-head"><span>03</span><p data-es="CONOCIMIENTO ABIERTO" data-en="OPEN KNOWLEDGE">CONOCIMIENTO ABIERTO</p><h2 data-es="Blog, YouTube y cursos" data-en="Blog, YouTube and courses">Blog, YouTube y cursos</h2></div>
        <div class="knowledge-strip">
          <article><small data-es="BLOG TÉCNICO" data-en="TECHNICAL BLOG">BLOG TÉCNICO</small><h3 data-es="Notas de campo" data-en="Field notes">Notas de campo</h3><p data-es="Problemas reales, decisiones, soluciones y lecciones aprendidas." data-en="Real problems, decisions, solutions and lessons learned.">Problemas reales, decisiones, soluciones y lecciones aprendidas.</p></article>
          <article><small>YOUTUBE</small><h3>Anderson MV Networks</h3><p data-es="Demostraciones y explicaciones técnicas orientadas a resultados." data-en="Technical demonstrations and explanations focused on outcomes.">Demostraciones y explicaciones técnicas orientadas a resultados.</p><a href="https://www.youtube.com/@andersonmvnetworks" target="_blank" rel="noopener" data-es="Visitar el canal ↗" data-en="Visit channel ↗">Visitar el canal ↗</a></article>
          <article><small data-es="ACADEMIA" data-en="ACADEMY">ACADEMIA</small><h3 data-es="Training en español" data-en="Training in Spanish">Training en español</h3><p data-es="Futuras rutas prácticas de redes, automatización y Linux." data-en="Future hands-on paths for networking, automation and Linux.">Futuras rutas prácticas de redes, automatización y Linux.</p></article>
        </div>
        <div class="video-grid">${videoHTML}</div>
      </section>

      <section class="connect section-shell" id="connect">
        <div class="connect-copy"><small data-es="CONTACTO Y ECOSISTEMA" data-en="CONTACT & ECOSYSTEM">CONTACTO Y ECOSISTEMA</small><h2 data-es="Conectemos." data-en="Let's connect.">Conectemos.</h2><p data-es="Código, laboratorios, contenedores y trayectoria profesional en un solo lugar." data-en="Code, labs, containers and professional journey in one place.">Código, laboratorios, contenedores y trayectoria profesional en un solo lugar.</p></div>
        <div class="profile-grid">${linkHTML}</div>
      </section>
    </main>

    <footer><p>© <span id="year"></span> Anderson Martinez Virviescas</p><a href="../" data-es="Comparar los 20 diseños ↑" data-en="Compare all 20 designs ↑">Comparar los 15 diseños ↑</a></footer>`;

  const root = document.documentElement;
  const langButton = document.getElementById("language");
  const themeButton = document.getElementById("theme");
  const applyLanguage = lang => {
    root.lang = lang;
    root.dataset.lang = lang;
    document.querySelectorAll("[data-es][data-en]").forEach(el => { el.textContent = el.dataset[lang]; });
    langButton.textContent = lang === "es" ? "EN" : "ES";
    langButton.setAttribute("aria-label", lang === "es" ? "Cambiar a inglés" : "Switch to Spanish");
    localStorage.setItem("amv-design-lang", lang);
  };
  const applyTheme = theme => {
    root.dataset.theme = theme;
    themeButton.setAttribute("aria-label", theme === "light" ? "Activar modo oscuro" : "Activar modo claro");
    localStorage.setItem("amv-design-theme", theme);
  };
  langButton.addEventListener("click", () => applyLanguage(root.dataset.lang === "es" ? "en" : "es"));
  themeButton.addEventListener("click", () => applyTheme(root.dataset.theme === "light" ? "dark" : "light"));
  applyLanguage(localStorage.getItem("amv-design-lang") || "es");
  applyTheme(localStorage.getItem("amv-design-theme") || "light");
  document.getElementById("year").textContent = new Date().getFullYear();
})();