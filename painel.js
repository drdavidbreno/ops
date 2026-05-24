const coupleEl = document.querySelector("#panel-couple");
const countdownEl = document.querySelector("#panel-countdown");
const titleEl = document.querySelector("#panel-title");
const subtitleEl = document.querySelector("#panel-subtitle");
const contentEl = document.querySelector("#panel-content");
const openSiteEl = document.querySelector("#panel-open-site");
const shareEl = document.querySelector("#panel-share");
const menuButton = document.querySelector(".panel-menu");
const sidebar = document.querySelector(".panel-sidebar");

function getSiteSlug() {
  return new URLSearchParams(window.location.search).get("site") || "";
}

function readSites() {
  try {
    return JSON.parse(localStorage.getItem("casamentoSites") || "{}");
  } catch {
    return {};
  }
}

function stripLargeDataUrls(value) {
  if (Array.isArray(value)) {
    return value.map(stripLargeDataUrls).filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, stripLargeDataUrls(item)])
        .filter(([, item]) => item !== undefined)
    );
  }

  if (typeof value === "string" && value.startsWith("data:image/")) {
    return "";
  }

  return value;
}

function writeSites(sites) {
  try {
    localStorage.setItem("casamentoSites", JSON.stringify(stripLargeDataUrls(sites)));
    return true;
  } catch (error) {
    console.warn("Nao foi possivel salvar no navegador.", error);
    return false;
  }
}

function compressImageDataUrl(dataUrl, maxSide = 1400, quality = 0.78) {
  if (!dataUrl || !String(dataUrl).startsWith("data:image/")) return Promise.resolve(dataUrl || "");

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function readCompressedFile(file) {
  if (!file) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      resolve(await compressImageDataUrl(dataUrl));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function saveSiteToCloud(site) {
  if (!site?.slug) return;
  window.OpsFirebaseData?.saveSite?.(site);
}

function getSite(slug) {
  const sites = readSites();
  return sites[slug] || null;
}

function createDraftSite(slug = "meu-site") {
  const safeSlug = slugify(slug);
  const site = {
    slug: safeSlug,
    couple: "David & Marilia",
    date: "2027-02-16",
    place: "Espaco Jardim das Flores",
    theme: "forest",
    style: "forest",
    color: "#6A0F23",
    photoShape: "soft",
    message: "A melhor forma de compartilhar esse momento com voces e unindo sonhos.",
    tagline: "Com amor, esperamos voce",
    showGifts: true,
    showRsvp: true,
    createdAt: new Date().toISOString()
  };
  const sites = readSites();
  sites[safeSlug] = site;
  writeSites(sites);
  saveSiteToCloud(site);
  return site;
}

function updateSite(slug, patch) {
  const sites = readSites();
  if (!sites[slug]) return null;
  sites[slug] = { ...sites[slug], ...patch, updatedAt: new Date().toISOString() };
  if (!writeSites(sites)) return null;
  saveSiteToCloud(sites[slug]);
  return sites[slug];
}

function replaceSiteSlug(oldSlug, newSlug, patch = {}) {
  const sites = readSites();
  const current = sites[oldSlug];
  if (!current) return null;
  const safeSlug = slugify(newSlug || oldSlug);
  delete sites[oldSlug];
  sites[safeSlug] = { ...current, ...patch, slug: safeSlug, updatedAt: new Date().toISOString() };
  if (!writeSites(sites)) return null;
  window.OpsFirebaseData?.replaceSiteSlug?.(oldSlug, safeSlug, sites[safeSlug]);
  return sites[safeSlug];
}

function formatDate(value) {
  if (!value) return "";
  // value: YYYY-MM-DD
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / 86400000);
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "nosso-site";
}

function setHeader(title, subtitle) {
  titleEl.textContent = title;
  subtitleEl.textContent = subtitle || "";
}

function setActivePanel(key) {
  document.querySelectorAll(".panel-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.panel === key);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderEmptyState() {
  contentEl.innerHTML = `
    <div class="panel-card">
      <h2>Nenhum site encontrado</h2>
      <p>Crie um site primeiro e volte para personalizar.</p>
      <div class="panel-card-actions">
        <a class="button button-primary" href="index.html#criar">Criar site</a>
      </div>
    </div>
  `;
}

function renderSitePanel(site) {
  setHeader("Site", "Personalize e edite cada detalhe");
  contentEl.innerHTML = `
    <div class="panel-grid">
      <section class="panel-card">
        <h2>Resumo</h2>
        <div class="panel-kv">
          <div><span>Casal</span><strong>${escapeHtml(site.couple || "—")}</strong></div>
          <div><span>Data</span><strong>${escapeHtml(formatDate(site.date) || "—")}</strong></div>
          <div><span>Local</span><strong>${escapeHtml(site.place || "—")}</strong></div>
          <div><span>Tema</span><strong>${escapeHtml(site.theme || site.style || "—")}</strong></div>
        </div>
        <div class="panel-card-actions">
          <button class="button button-outline" type="button" data-nav="layout">Personalizar layout</button>
          <a class="button button-primary" href="site.html?site=${encodeURIComponent(site.slug)}">Ver seu site</a>
        </div>
      </section>

      <section class="panel-card">
        <h2>Prévia</h2>
        <div class="panel-preview">
          <iframe title="Prévia do site" src="site.html?site=${encodeURIComponent(site.slug)}"></iframe>
        </div>
      </section>
    </div>
  `;
}

function renderLayoutPanel(site) {
  setHeader("Personalizar layout", "Ajuste tema, cores e fotos");
  contentEl.innerHTML = `
    <div class="panel-grid panel-grid-tight">
      <section class="panel-card">
        <h2>Template atual</h2>
        <div class="panel-form">
          <label>Tema
            <select id="layout-theme">
              <option value="forest">Clássico</option>
              <option value="classic">Preto e branco</option>
              <option value="photo">Editorial</option>
              <option value="blush">Minimal</option>
            </select>
          </label>
          <label>Cor principal
            <input id="layout-color" type="color" value="${escapeHtml(site.color || "#6A0F23")}">
          </label>
          <label>Formato da foto
            <select id="layout-photoShape">
              <option value="soft">Cantos suaves</option>
              <option value="round">Redonda</option>
              <option value="square">Quadrada</option>
            </select>
          </label>
          <label>Imagem de capa
            <input id="layout-heroPhoto" type="file" accept="image/*">
          </label>
          <label>Imagem da história
            <input id="layout-storyPhoto" type="file" accept="image/*">
          </label>
          <div class="panel-card-actions">
            <button class="button button-primary" type="button" id="layout-save">Salvar alterações</button>
            <a class="button button-outline" href="site.html?site=${encodeURIComponent(site.slug)}">Abrir em nova aba</a>
          </div>
          <p class="panel-hint" id="layout-hint" aria-live="polite"></p>
        </div>
      </section>

      <section class="panel-card">
        <h2>Prévia</h2>
        <div class="panel-preview">
          <iframe id="layout-preview" title="Prévia do site" src="site.html?site=${encodeURIComponent(site.slug)}"></iframe>
        </div>
      </section>
    </div>
  `;

  const themeSelect = document.querySelector("#layout-theme");
  const colorInput = document.querySelector("#layout-color");
  const shapeSelect = document.querySelector("#layout-photoShape");
  const heroInput = document.querySelector("#layout-heroPhoto");
  const storyInput = document.querySelector("#layout-storyPhoto");
  const hintEl = document.querySelector("#layout-hint");
  const saveBtn = document.querySelector("#layout-save");
  const preview = document.querySelector("#layout-preview");

  themeSelect.value = site.theme || (site.style === "classic" ? "classic" : "forest");
  shapeSelect.value = site.photoShape || "soft";

  async function fileToDataUrl(input) {
    const file = input.files && input.files[0];
    return readCompressedFile(file);
  }

  saveBtn.addEventListener("click", async () => {
    try {
    hintEl.textContent = "Salvando...";
    const patch = {
      theme: themeSelect.value,
      style: themeSelect.value,
      color: colorInput.value,
      photoShape: shapeSelect.value
    };

    const heroPhoto = await fileToDataUrl(heroInput);
    const storyPhoto = await fileToDataUrl(storyInput);
    if (heroPhoto) {
      patch.heroPhoto = heroPhoto;
    } else if (site.heroPhoto?.startsWith("data:image/")) {
      patch.heroPhoto = await compressImageDataUrl(site.heroPhoto);
    }
    if (storyPhoto) {
      patch.storyPhoto = storyPhoto;
    } else if (site.storyPhoto?.startsWith("data:image/")) {
      patch.storyPhoto = await compressImageDataUrl(site.storyPhoto);
    }

    const updated = updateSite(site.slug, patch);
    if (!updated) {
      hintEl.textContent = "Não foi possível salvar agora.";
      return;
    }

    hintEl.textContent = "Alterações salvas.";
    Object.assign(site, updated);
    preview?.contentWindow?.location?.reload();

    if (heroPhoto) {
      window.OpsFirebaseData?.uploadSiteImage?.(site.slug, "heroPhoto", heroPhoto)
        .then((url) => url && url !== heroPhoto && updateSite(site.slug, { heroPhoto: url }));
    }
    if (storyPhoto) {
      window.OpsFirebaseData?.uploadSiteImage?.(site.slug, "storyPhoto", storyPhoto)
        .then((url) => url && url !== storyPhoto && updateSite(site.slug, { storyPhoto: url }));
    }
    } catch (error) {
      console.error("Erro ao salvar layout:", error);
      hintEl.textContent = "Nao foi possivel salvar essa foto. Tente uma imagem menor.";
    }
  });
}

function renderPlaceholder(title, subtitle, message) {
  setHeader(title, subtitle);
  contentEl.innerHTML = `
    <div class="panel-card">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message || "Em breve.")}</p>
    </div>
  `;
}

function renderPagesPanel(site) {
  setHeader("Paginas", "Habilite, ordene e personalize as paginas");
  const pages = site.pages || [
    { title: "Pagina inicial", subtitle: "Apresentacao do casal", active: true },
    { title: "Nossa historia", subtitle: "Texto sobre a caminhada do casal", active: true },
    { title: "Mensagens", subtitle: "Recados dos convidados", active: true },
    { title: "Cerimonia", subtitle: "Local, data e horario", active: true },
    { title: "Festa", subtitle: "Recepcao e detalhes do evento", active: true },
    { title: "Presentes", subtitle: "Lista virtual e cotas", active: true },
    { title: "Padrinhos", subtitle: "Pessoas especiais", active: false }
  ];

  contentEl.innerHTML = `
    <div class="panel-card">
      <div class="panel-section-head">
        <div>
          <h2>Paginas do site</h2>
          <p>Escolha o que aparece para os convidados.</p>
        </div>
        <button class="button button-primary button-small" type="button" id="pages-save">Salvar paginas</button>
      </div>
      <div class="panel-list">
        ${pages.map((page, index) => `
          <article class="panel-list-row">
            <span class="panel-drag" aria-hidden="true">=</span>
            <div>
              <strong contenteditable="true" data-page-title="${index}">${escapeHtml(page.title)}</strong>
              <small contenteditable="true" data-page-subtitle="${index}">${escapeHtml(page.subtitle || "")}</small>
            </div>
            <label class="panel-switch">
              <input type="checkbox" data-page-active="${index}" ${page.active ? "checked" : ""}>
              <span></span>
            </label>
          </article>
        `).join("")}
      </div>
      <p class="panel-hint" id="pages-hint" aria-live="polite"></p>
    </div>
  `;

  document.querySelector("#pages-save").addEventListener("click", () => {
    const updatedPages = pages.map((page, index) => ({
      title: document.querySelector(`[data-page-title="${index}"]`)?.textContent?.trim() || page.title,
      subtitle: document.querySelector(`[data-page-subtitle="${index}"]`)?.textContent?.trim() || "",
      active: document.querySelector(`[data-page-active="${index}"]`)?.checked || false
    }));
    Object.assign(site, updateSite(site.slug, { pages: updatedPages }) || site);
    document.querySelector("#pages-hint").textContent = "Paginas atualizadas.";
  });
}

function renderMonogramPanel(site) {
  setHeader("Monograma", "Crie uma marca simples para o casal");
  const initials = String(site.monogram || site.couple || "D M")
    .split(/\s+|&|\+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join(" + ")
    .toUpperCase();

  contentEl.innerHTML = `
    <div class="panel-grid panel-grid-tight">
      <section class="panel-card">
        <h2>Marca do casal</h2>
        <div class="panel-form">
          <label>Iniciais
            <input id="monogram-input" type="text" value="${escapeHtml(initials)}" maxlength="12">
          </label>
          <label>Estilo
            <select id="monogram-style">
              <option value="classic">Classico</option>
              <option value="romantic">Romantico</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
          <button class="button button-primary" type="button" id="monogram-save">Salvar monograma</button>
          <p class="panel-hint" id="monogram-hint" aria-live="polite"></p>
        </div>
      </section>
      <section class="panel-card">
        <h2>Previa</h2>
        <div class="panel-monogram-preview" id="monogram-preview">${escapeHtml(initials)}</div>
      </section>
    </div>
  `;

  const input = document.querySelector("#monogram-input");
  const preview = document.querySelector("#monogram-preview");
  input.addEventListener("input", () => {
    preview.textContent = input.value || "D + M";
  });
  document.querySelector("#monogram-save").addEventListener("click", () => {
    Object.assign(site, updateSite(site.slug, { monogram: input.value }) || site);
    document.querySelector("#monogram-hint").textContent = "Monograma salvo.";
  });
}

function renderAddressPanel(site) {
  setHeader("Endereco personalizado", "Defina o link do seu site");
  contentEl.innerHTML = `
    <div class="panel-grid panel-grid-tight">
      <section class="panel-card">
        <h2>Endereco do site</h2>
        <div class="panel-form">
          <label>Link personalizado
            <span class="panel-url-field">
              <span>opscasei.com/</span>
              <input id="address-slug" type="text" value="${escapeHtml(site.slug || "")}">
            </span>
          </label>
          <p class="panel-hint">Use letras, numeros e hifens. Exemplo: ana-e-miguel.</p>
          <div class="panel-card-actions">
            <button class="button button-primary" type="button" id="address-save">Salvar endereco</button>
            <a class="button button-outline" href="site.html?site=${encodeURIComponent(site.slug)}">Ver atual</a>
          </div>
          <p class="panel-hint" id="address-hint" aria-live="polite"></p>
        </div>
      </section>
      <section class="panel-card panel-address-preview">
        <h2>Como seus convidados verao</h2>
        <strong id="address-preview">opscasei.com/${escapeHtml(site.slug)}</strong>
        <p>Um endereco curto ajuda os convidados a encontrar o site, a lista e a confirmacao de presenca.</p>
      </section>
    </div>
  `;

  const input = document.querySelector("#address-slug");
  const preview = document.querySelector("#address-preview");
  input.addEventListener("input", () => {
    preview.textContent = `opscasei.com/${slugify(input.value)}`;
  });
  document.querySelector("#address-save").addEventListener("click", () => {
    const updated = replaceSiteSlug(site.slug, input.value);
    if (!updated) {
      document.querySelector("#address-hint").textContent = "Nao foi possivel salvar.";
      return;
    }
    Object.assign(site, updated);
    window.history.replaceState({}, "", `painel.html?site=${encodeURIComponent(site.slug)}`);
    openSiteEl.setAttribute("href", `site.html?site=${encodeURIComponent(site.slug)}`);
    shareEl.setAttribute("href", `site.html?site=${encodeURIComponent(site.slug)}`);
    document.querySelector("#address-hint").textContent = "Endereco atualizado.";
  });
}

function renderAlbumsPanel(site) {
  setHeader("Albuns de fotos", "Organize lembrancas para os convidados");
  const photos = [site.heroPhoto, site.storyPhoto, ...(site.gallery || [])].filter(Boolean);
  contentEl.innerHTML = `
    <div class="panel-card">
      <div class="panel-section-head">
        <div>
          <h2>Galeria</h2>
          <p>Adicione fotos especiais e escolha as melhores para aparecer no site.</p>
        </div>
        <label class="button button-primary button-small">
          Adicionar foto
          <input class="panel-hidden-file" id="album-upload" type="file" accept="image/*">
        </label>
      </div>
      <div class="panel-gallery" id="album-gallery">
        ${photos.length ? photos.map((photo, index) => `
          <figure>
            <img src="${escapeHtml(photo)}" alt="Foto ${index + 1}">
            <figcaption>Foto ${index + 1}</figcaption>
          </figure>
        `).join("") : `<div class="panel-empty">Nenhuma foto adicionada ainda.</div>`}
      </div>
      <p class="panel-hint" id="album-hint" aria-live="polite"></p>
    </div>
  `;

  document.querySelector("#album-upload").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = await compressImageDataUrl(String(reader.result || ""));
      const gallery = [...(site.gallery || []), dataUrl];
      Object.assign(site, updateSite(site.slug, { gallery }) || site);
      renderAlbumsPanel(site);
      window.OpsFirebaseData?.uploadSiteImage?.(site.slug, "gallery", dataUrl)
        .then((url) => {
          if (!url || url === dataUrl) return;
          const nextGallery = (site.gallery || []).map((photo) => photo === dataUrl ? url : photo);
          Object.assign(site, updateSite(site.slug, { gallery: nextGallery }) || site);
        });
    };
    reader.readAsDataURL(file);
  });
}

function renderMessagesPanel(site) {
  setHeader("Mensagens", "Recados recebidos dos convidados");
  const messages = site.messages || [
    { name: "Familia Rocha", text: "Que esse dia seja leve, lindo e cheio de amor." },
    { name: "Camila", text: "Estamos contando os dias para celebrar com voces." }
  ];
  contentEl.innerHTML = `
    <div class="panel-grid panel-grid-tight">
      <section class="panel-card">
        <h2>Recados</h2>
        <div class="panel-list">
          ${messages.map((message) => `
            <article class="panel-message">
              <strong>${escapeHtml(message.name)}</strong>
              <p>${escapeHtml(message.text)}</p>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="panel-card">
        <h2>Adicionar mensagem teste</h2>
        <div class="panel-form">
          <label>Nome
            <input id="message-name" type="text" placeholder="Ex: Maria">
          </label>
          <label>Mensagem
            <input id="message-text" type="text" placeholder="Escreva um recado carinhoso">
          </label>
          <button class="button button-primary" type="button" id="message-add">Adicionar</button>
          <p class="panel-hint" id="message-hint" aria-live="polite"></p>
        </div>
      </section>
    </div>
  `;

  document.querySelector("#message-add").addEventListener("click", () => {
    const name = document.querySelector("#message-name").value.trim() || "Convidado";
    const text = document.querySelector("#message-text").value.trim();
    if (!text) {
      document.querySelector("#message-hint").textContent = "Escreva uma mensagem antes.";
      return;
    }
    Object.assign(site, updateSite(site.slug, { messages: [{ name, text }, ...messages] }) || site);
    renderMessagesPanel(site);
  });
}

function renderPollsPanel(site) {
  setHeader("Enquetes", "Perguntas rapidas para os convidados");
  const polls = site.polls || [
    { question: "Qual musica nao pode faltar?", options: ["Classicos", "Sertanejo", "Pop"] },
    { question: "Qual lembrancinha combina mais?", options: ["Velas", "Doces", "Mini flores"] }
  ];
  contentEl.innerHTML = `
    <div class="panel-grid panel-grid-tight">
      <section class="panel-card">
        <h2>Enquetes ativas</h2>
        <div class="panel-list">
          ${polls.map((poll) => `
            <article class="panel-poll">
              <strong>${escapeHtml(poll.question)}</strong>
              <div>${poll.options.map((option) => `<span>${escapeHtml(option)}</span>`).join("")}</div>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="panel-card">
        <h2>Nova enquete</h2>
        <div class="panel-form">
          <label>Pergunta
            <input id="poll-question" type="text" placeholder="Ex: Qual sabor de bolo?">
          </label>
          <label>Opcoes
            <input id="poll-options" type="text" placeholder="Chocolate, Baunilha, Frutas">
          </label>
          <button class="button button-primary" type="button" id="poll-add">Criar enquete</button>
          <p class="panel-hint" id="poll-hint" aria-live="polite"></p>
        </div>
      </section>
    </div>
  `;

  document.querySelector("#poll-add").addEventListener("click", () => {
    const question = document.querySelector("#poll-question").value.trim();
    const options = document.querySelector("#poll-options").value.split(",").map((item) => item.trim()).filter(Boolean);
    if (!question || options.length < 2) {
      document.querySelector("#poll-hint").textContent = "Preencha a pergunta e pelo menos duas opcoes.";
      return;
    }
    Object.assign(site, updateSite(site.slug, { polls: [{ question, options }, ...polls] }) || site);
    renderPollsPanel(site);
  });
}

function renderAboutPanel(site) {
  setHeader("Detalhes", "Textos e informacoes do casamento");
  contentEl.innerHTML = `
    <div class="panel-card">
      <h2>Editar conteudo principal</h2>
      <div class="panel-form panel-form-grid">
        <label>Nome do casal
          <input id="about-couple" type="text" value="${escapeHtml(site.couple || "")}">
        </label>
        <label>Data
          <input id="about-date" type="date" value="${escapeHtml(site.date || "")}">
        </label>
        <label>Local
          <input id="about-place" type="text" value="${escapeHtml(site.place || "")}">
        </label>
        <label>Frase curta
          <input id="about-tagline" type="text" value="${escapeHtml(site.tagline || "")}">
        </label>
        <label class="panel-wide">Mensagem principal
          <textarea id="about-message" rows="5">${escapeHtml(site.message || "")}</textarea>
        </label>
        <div class="panel-card-actions panel-wide">
          <button class="button button-primary" type="button" id="about-save">Salvar detalhes</button>
        </div>
        <p class="panel-hint panel-wide" id="about-hint" aria-live="polite"></p>
      </div>
    </div>
  `;

  document.querySelector("#about-save").addEventListener("click", () => {
    Object.assign(site, updateSite(site.slug, {
      couple: document.querySelector("#about-couple").value.trim(),
      date: document.querySelector("#about-date").value,
      place: document.querySelector("#about-place").value.trim(),
      tagline: document.querySelector("#about-tagline").value.trim(),
      message: document.querySelector("#about-message").value.trim()
    }) || site);
    coupleEl.textContent = site.couple || "Seu site";
    document.querySelector("#about-hint").textContent = "Detalhes salvos.";
  });
}

function renderSettingsPanel(site) {
  setHeader("Configuracoes", "Preferencias e visibilidade");
  contentEl.innerHTML = `
    <div class="panel-grid panel-grid-tight">
      <section class="panel-card">
        <h2>Recursos visiveis</h2>
        <div class="panel-toggle-list">
          <label><span>Lista de presentes</span><input id="settings-gifts" type="checkbox" ${site.showGifts ? "checked" : ""}></label>
          <label><span>Confirmacao de presenca</span><input id="settings-rsvp" type="checkbox" ${site.showRsvp ? "checked" : ""}></label>
          <label><span>Recados dos convidados</span><input id="settings-notes" type="checkbox" ${site.showNotes !== false ? "checked" : ""}></label>
        </div>
        <button class="button button-primary" type="button" id="settings-save">Salvar configuracoes</button>
        <p class="panel-hint" id="settings-hint" aria-live="polite"></p>
      </section>
      <section class="panel-card">
        <h2>Dados do painel</h2>
        <div class="panel-kv">
          <div><span>Criado em</span><strong>${escapeHtml(new Date(site.createdAt || Date.now()).toLocaleDateString("pt-BR"))}</strong></div>
          <div><span>Atualizado</span><strong>${escapeHtml(site.updatedAt ? new Date(site.updatedAt).toLocaleDateString("pt-BR") : "Hoje")}</strong></div>
          <div><span>Slug</span><strong>${escapeHtml(site.slug)}</strong></div>
          <div><span>Status</span><strong>Publicado</strong></div>
        </div>
      </section>
    </div>
  `;

  document.querySelector("#settings-save").addEventListener("click", () => {
    Object.assign(site, updateSite(site.slug, {
      showGifts: document.querySelector("#settings-gifts").checked,
      showRsvp: document.querySelector("#settings-rsvp").checked,
      showNotes: document.querySelector("#settings-notes").checked
    }) || site);
    document.querySelector("#settings-hint").textContent = "Configuracoes salvas.";
  });
}

function navigate(key, site) {
  try {
  setActivePanel(key);

  if (!site) {
    renderEmptyState();
    return;
  }

  if (key === "pages") return renderPagesPanel(site);
  if (key === "monogram") return renderMonogramPanel(site);
  if (key === "address") return renderAddressPanel(site);
  if (key === "albums") return renderAlbumsPanel(site);
  if (key === "messages") return renderMessagesPanel(site);
  if (key === "polls") return renderPollsPanel(site);
  if (key === "about") return renderAboutPanel(site);
  if (key === "settings") return renderSettingsPanel(site);

  const routes = {
    site: () => renderSitePanel(site),
    pages: () => renderPlaceholder("Páginas", "Organize as páginas do seu site", "Aqui você vai poder ativar/desativar páginas e reordenar seções."),
    layout: () => renderLayoutPanel(site),
    monogram: () => renderPlaceholder("Monograma", "Sua marca do casal", "Vamos criar um monograma com as iniciais e aplicar no topo do site."),
    intro: () => renderPlaceholder("Introdução animada", "Abertura do site", "Recurso desativado nesta versão."),
    address: () => renderPlaceholder("Endereço personalizado", "Defina o link do seu site", "Aqui você escolheria um endereço curto e fácil de lembrar."),
    albums: () => renderPlaceholder("Álbuns de fotos", "Organize suas fotos", "Crie álbuns, adicione fotos e compartilhe com os convidados."),
    messages: () => renderPlaceholder("Mensagens", "Recados recebidos", "Veja e modere mensagens dos convidados."),
    polls: () => renderPlaceholder("Enquetes", "Perguntas para os convidados", "Crie enquetes para confirmar escolhas e preferências."),
    music: () => renderPlaceholder("Músicas", "Playlist do casal", "Recurso desativado nesta versão."),
    about: () => renderPlaceholder("Detalhes", "Informações do casamento", "Edite cerimônia, recepção e textos do site."),
    settings: () => renderPlaceholder("Configurações", "Preferências do painel", "Ajustes gerais do seu site e conta.")
  };

  (routes[key] || routes.site)();
  } catch (error) {
    console.error("Erro ao abrir tela do painel:", error);
    setHeader("Ops", "Nao foi possivel abrir essa tela agora");
    contentEl.innerHTML = `
      <div class="panel-card">
        <h2>Algo travou nesta tela</h2>
        <p>As outras opcoes continuam funcionando. Tente abrir outra area do painel.</p>
      </div>
    `;
  }
}

function bindNav(site) {
  document.querySelector(".panel-nav")?.addEventListener("click", (event) => {
    const button = event.target.closest(".panel-item[data-panel]");
    if (!button) return;
    navigate(button.dataset.panel, site);
  });

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (!nav) return;
    navigate(String(nav.dataset.nav || "site"), site);
  });
}

function toggleSidebar() {
  const open = document.body.classList.toggle("panel-nav-open");
  menuButton?.setAttribute("aria-expanded", String(open));
}

menuButton?.addEventListener("click", toggleSidebar);

function hydratePanelSite(site) {
  coupleEl.textContent = site.couple || "Seu site";
  const d = daysUntil(site.date);
  countdownEl.textContent = d == null ? "Data nao definida" : `Faltam ${d} dias para o casamento`;
  openSiteEl.setAttribute("href", `site.html?site=${encodeURIComponent(site.slug)}`);
  shareEl.setAttribute("href", `site.html?site=${encodeURIComponent(site.slug)}`);
}

(function init() {
  const slug = getSiteSlug();
  let site = slug ? getSite(slug) : null;

  if (!site) {
    site = createDraftSite(slug || "meu-site");
    window.history.replaceState({}, "", `painel.html?site=${encodeURIComponent(site.slug)}`);
  }

  if (!site) {
    coupleEl.textContent = "Seu site";
    countdownEl.textContent = "Crie um site para começar";
    openSiteEl.setAttribute("href", "index.html#criar");
    shareEl.setAttribute("href", "index.html#criar");
    bindNav(null);
    navigate("site", null);
    return;
  }

  coupleEl.textContent = site.couple || "Seu site";
  const d = daysUntil(site.date);
  countdownEl.textContent = d == null ? "Data não definida" : `Faltam ${d} dias para o casamento`;

  openSiteEl.setAttribute("href", `site.html?site=${encodeURIComponent(site.slug)}`);
  shareEl.setAttribute("href", `site.html?site=${encodeURIComponent(site.slug)}`);

  bindNav(site);
  navigate("site", site);

  // desktop: sidebar aberta por padrão
  document.body.classList.add("panel-nav-open");
})();
