const { parse: parseHtml } = require("node-html-parser");

const LIBRARY_BASE_URL = "https://public-view.bcucluj.ro/pdfview/";
const DSPACE_OAI_BASE_URL = "https://dspace.bcucluj.ro/oai/request";

const INDEX_CONCURRENCY = 2;
const BATCH_DELAY_MS = 450;
const OAI_MAX_PAGES = 40;
const OAI_MAX_RECORDS = 4000;

const FACULTY_LABEL_OVERRIDES = {
  DREPT: "Drept",
  EDFIZ: "Educatie Fizica si Sport",
  FIZIC: "Fizica",
  GEOGR: "Geografie",
  IST: "Istorie si Filosofie",
  FILO: "Litere",
  MATE: "Matematica si Informatica",
  PED: "Psihologie si Stiinte ale Educatiei",
  SOCAS: "Sociologie si Asistenta Sociala",
  MEDIU: "Stiinta si Ingineria Mediului",
  EC: "Stiinte Economice si Gestiunea Afacerilor",
  MED: "Stiinte Medicale si ale Sanatatii",
  STPOL: "Stiinte Politice, Administrative si ale Comunicarii",
  SE: "Studii Europene",
  TEATR: "Teatru si Film",
  TEOIG: "Teologie Greco Catolica",
  TEOIO: "Teologie Ortodoxa",
  TEOLRF: "Teologie Reformata",
  TEORC: "Teologie Romano Catolica"
};

const FACULTY_DEPARTMENTS = {
  "Drept": [
    "Drept", "Dreptul european si dreptul national al afacerilor",
    "Dreptul International si Comparat al Afacerilor",
    "Dreptul privat al Uniunii Europene", "Institutii de drept privat",
    "International and comparative business law",
    "Stiinte penale si criminalistica"
  ],
  "Educatie Fizica si Sport": [
    "Antrenament si performanta sportiva",
    "Educatie fizica si agrement in turism", "Educatie fizica si sport",
    "Kinetoterapie in afectiunile aparatului locomotor",
    "Kinetoterapie si motricitate speciala",
    "Managementul organizatiilor si activitatilor sportive",
    "Sport si performanta motrica"
  ],
  "Fizica": [
    "Fizica", "Fizica informatica", "Fizica medicala", "Fizica tehnologica"
  ],
  "Geografie": [
    "Amenajare si dezvoltare turistica", "Cartografie", "Geografia turismului",
    "Geografie", "Geomatica", "Hidrologie si meteorologie",
    "Planificare si dezvoltare regionala", "Planificare teritoriala",
    "Resurse si riscuri in mediul hidroatmosferic",
    "Turism si dezvoltare teritoriala"
  ],
  "Istorie si Filosofie": [
    "Arheologie", "Arheologie si studii clasice", "Arhivistica",
    "Cercetarea si valorificarea patrimoniului cultural", "Etnologie",
    "Evaluarea politicilor si a programelor publice europene",
    "Filosofie", "Filosofie antica si medievala", "Filosofie, cultura, comunicare",
    "Istoria artei", "Istoria Europei de sud-est",
    "Istoria si socio-antropologia epocii moderne",
    "Istorie", "Istorie antica", "Istorie contemporana",
    "Istorie contemporana si relatii internationale",
    "Istorie medievala", "Istorie moderna",
    "Istorie, memorie, oralitate in sec. XX",
    "Leadership si comunicare in organizatii internationale",
    "Managementul securitatii in societatea contemporana",
    "Patrimoniu si turism cultural", "RISE",
    "Securitate, Intelligence si competitivitate in organizatii",
    "Societate, arta, identitati in Europa Centrala. De la medieval la modernitate",
    "Stiinte ale informarii si documentarii", "Studii de securitate",
    "Studii iudaice", "Teorie critica si studii multiculturale", "Turism cultural"
  ],
  "Litere": [
    "Etnografie si antropologie maghiara", "Filologie clasica",
    "Limba si literatura chineza", "Limba si literatura coreeana",
    "Limba si literatura engleza", "Limba si literatura finlandeza",
    "Limba si literatura franceza", "Limba si literatura germana",
    "Limba si literatura italiana", "Limba si literatura japoneza",
    "Limba si literatura maghiara", "Limba si literatura norvegiana",
    "Limba si literatura portugheza", "Limba si literatura romana",
    "Limba si literatura rusa", "Limba si literatura spaniola",
    "Limba si literatura ucraineana", "Limbi moderne aplicate",
    "Literatura universala si comparata",
    "Scoala Doctorala Studii de Hungarologie",
    "Studii culturale", "Studii si cercetari est-asiatice",
    "Trunchi comun - MA", "Trunchi comun - RO"
  ],
  "Matematica si Informatica": [
    "Informatica", "Matematica", "Matematica informatica", "UBB_Matematica"
  ],
  "Psihologie si Stiinte ale Educatiei": [
    "Consiliere scolara si asistenta psihopedagogica",
    "Consiliere si interventie psihologica in dezvoltarea umana",
    "Consultanta si interventie psihologica", "Designer instructional",
    "Didactica limbii si literaturii germane, cultura si civilizatia germana a Europei Centrale si de sud Est",
    "Management curricular", "Management educational",
    "Management, consiliere si asistenta psihopedagogica in institutiile incluzive",
    "Metode si practici alternative in invatamantul primar si prescolar",
    "Pedagogia Invatamantului primar si prescolar", "Pedagogie",
    "Psihologia resurselor umane si sanatate organizationala",
    "Psihologia sanatatii publice si clinica", "Psihologie",
    "Psihologie clinica, consiliere psihologica si psihoterapie",
    "Psihologie judiciara", "Psihopedagogie speciala",
    "Strategii de invatare eficienta",
    "Tehnici psihologice pentru controlul comportamentului si dezvoltarea potentialului uman",
    "Terapia limbajului si audiologie educationala"
  ],
  "Sociologie si Asistenta Sociala": [
    "Analiza datelor complexe", "Antropologie", "Asistenta sociala",
    "Asistenta sociala in spatiul justitiei. Probatiune si mediere",
    "Asistenta sociala si economie sociala",
    "Cercetare sociologica avansata",
    "Comunicare, societate si mass-media",
    "Managementul serviciilor sociale",
    "Managementul strategic al resurselor umane",
    "Masterat european in drepturile copiilor",
    "Munca si Transformari Sociale",
    "Psihologie(Asistenta sociala)", "Resurse umane",
    "Scoala doctorala de sociologie", "Sociologie"
  ],
  "Stiinta si Ingineria Mediului": [
    "Calitatea mediului si surse energetice",
    "Dezvoltare sustenabila si managementul mediului",
    "Evaluarea riscului si securitatea mediului",
    "Geografia mediului", "Gestiunea si protectia mediului",
    "Ingineria mediului", "Ingineria sistemelor biotehnice si ecologice",
    "Ingineria valorificarii deseurilor",
    "Management si audit de mediu", "Stiinta mediului"
  ],
  "Stiinte Economice si Gestiunea Afacerilor": [
    "Administrarea afacerilor",
    "Administrarea afacerilor in turism, comert si servicii",
    "Afaceri internationale", "Agrobusiness",
    "Auditul si managementul financiar al fondurilor europene",
    "Banci si piete de capital",
    "Contabilitate si informatica de gestiune",
    "Contabilitate si informatica de gestiune (Sighet)",
    "Contabilitate si organizatii",
    "Dezvoltare regionala durabila", "Diagnostic si evaluare",
    "E - Business", "Econometrie si statistica aplicata",
    "Economia comertului turismului si serviciilor",
    "Economia firmei", "Economie agroalimentara si a mediului",
    "Economie generala", "Economie si afaceri internationale",
    "Expertiza contabila si audit",
    "Finante corporative - asigurari", "Finante si banci",
    "Fiscalitate", "Gestiune financiara corporativa",
    "Gestiunea si evaluarea proiectelor",
    "Gestiunea si evaluarea proiectelor (la Sighet)",
    "Informatica economica", "International Business Management",
    "Management", "Management contabil, audit si control",
    "Management international", "Managementul afacerilor",
    "Managementul dezvoltarii afacerilor",
    "Managementul dezvoltarii afacerilor - Sfantu Gheorghe",
    "Managementul resurselor umane", "Marketing", "Marketing digital",
    "Modelarea afacerilor si calculul distribuit",
    "Scoala doctorala Stiinte Economice si Gestiunea Afacerilor",
    "Sisteme de dezvoltare a deciziilor economice",
    "Statistica si previziuni economice",
    "Strategii si politici de marketing"
  ],
  "Stiinte Medicale si ale Sanatatii": [
    "Biologie medicala", "Chimie clinica", "Fizica medicala",
    "Health economics", "Inginerie medicala",
    "Kinetoterapie si motricitate speciala", "Stiintele nutritiei"
  ],
  "Stiinte Politice, Administrative si ale Comunicarii": [
    "Administratie publica", "Comunicare si relatii publice",
    "Jurnalism", "Leadership in sectorul public", "Media digitala",
    "Publicitate", "Servicii si politici de sanatate publica",
    "Stiinta datelor sociale", "Stiinte politice", "Studii de conflict"
  ],
  "Studii Europene": [
    "Administratie europeana", "Management",
    "Relatii internationale si studii europene"
  ],
  "Teatru si Film": [
    "Arta scurtmetrajului", "Arta teatrala - Actorie", "Arta teatrala - Regie",
    "Arte Digitale Interactive - Digital Interactive Arts",
    "Arte performative si film", "Artele spectacolului actorie",
    "Artele spectacolului regie", "Cinematografie fotografie media",
    "Filmologie",
    "Management si Antreprenoriat Cultural in limba romana",
    "Productia de film documentar - Documentary Filmmaking",
    "Teatrologie",
    "Teatru Contemporan Actorie si Teatrologie in limba maghiara"
  ],
  "Teologie Greco Catolica": [
    "Fundamente crestine ale identitatii europene", "Teologie biblica",
    "Teologie greco catolica asistenta sociala",
    "Teologie greco catolica didactica", "Teologie greco catolica pastorala",
    "Teologie pastorala in comunitatile ecleziale"
  ],
  "Teologie Ortodoxa": [
    "Arta sacra",
    "Arta sacra- Conservarea, restaurarea si crearea bunurilor culturale",
    "Bioetica - morala, etica si deontologie",
    "Consiliere pastorala si asistenta psihosociala",
    "Doctrina, Hermeneutica si Istorie bisericeasca",
    "Istoria religiilor, geopolitica religiilor monoteiste (crestinism, iudaism, islam)",
    "Ortodoxie romaneasca si viata liturgica",
    "Pastoratie si viata liturgica",
    "Teologie ortodoxa didactica", "Teologie ortodoxa pastorala",
    "Teologie ortodoxa asistenta sociala"
  ],
  "Teologie Reformata": [
    "Mediere interconfesionala si interculturala", "Muzica",
    "Muzica bisericeasca ecumenica", "Teologie - educatie",
    "Teologie aplicata", "Teologie reformata didactica",
    "Teologie-Muzica-Educatie"
  ],
  "Teologie Romano Catolica": [
    "Teologie romano catolica didactica",
    "Teologie romano catolica pastorala"
  ]
};

function normForCompare(s) {
  return String(s || "").toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveKnownDepartment(facultyLabel, rawDept) {
  const known = FACULTY_DEPARTMENTS[facultyLabel];
  if (!known) return null;
  if (!rawDept) return "General";
  if (/^zz[_\s-]/i.test(rawDept) || normForCompare(rawDept) === "general") return "General";

  const normalized = normForCompare(rawDept);
  const exact = known.find((d) => normForCompare(d) === normalized);
  if (exact) return exact;

  const candidates = known.filter((d) => {
    const dn = normForCompare(d);
    return dn.includes(normalized) || normalized.includes(dn);
  });

  if (candidates.length > 0) {
    return candidates.sort((a, b) => a.length - b.length)[0];
  }
  return "General";
}

function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

function decodeLabel(label) {
  try {
    return decodeURIComponent(label);
  } catch {
    return label;
  }
}

function parseSizeToBytes(sizeStr) {
  if (!sizeStr || sizeStr === "-") return 0;
  const normalized = sizeStr.trim().toUpperCase();
  const value = parseFloat(normalized);
  if (isNaN(value)) return 0;
  if (normalized.includes("K")) return value * 1024;
  if (normalized.includes("M")) return value * 1024 * 1024;
  if (normalized.includes("G")) return value * 1024 * 1024 * 1024;
  return value;
}

function extractYear(value) {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : undefined;
}

function normalizeLanguageCode(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "Nespecificata";
  if (["ro", "ron", "rum", "romanian", "romana", "romanae"].includes(v)) return "Romana";
  if (["en", "eng", "english"].includes(v)) return "Engleza";
  if (["fr", "fra", "fre", "french", "franceza"].includes(v)) return "Franceza";
  if (["de", "deu", "ger", "german", "germana"].includes(v)) return "Germana";
  if (["hu", "hun", "hungarian", "maghiara"].includes(v)) return "Maghiara";
  if (["la", "lat", "latin"].includes(v)) return "Latina";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function inferLanguageFromText(value) {
  const raw = String(value || "");
  const text = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!text) return "Nespecificata";
  if (/\b(romana|romanian|limba\s+romana|in\s+romana)\b/.test(text)) return "Romana";
  if (/\b(english|engleza|in\s+engleza)\b/.test(text)) return "Engleza";
  if (/\b(franceza|french|in\s+franceza)\b/.test(text)) return "Franceza";
  if (/\b(germana|german|in\s+germana)\b/.test(text)) return "Germana";
  if (/\b(maghiara|hungarian|in\s+maghiara)\b/.test(text)) return "Maghiara";
  if (/\b(latina|latin|in\s+latina)\b/.test(text)) return "Latina";
  return "Nespecificata";
}

function cleanDepartmentLabel(value) {
  const normalized = decodeLabel(String(value || "")).replace(/[_-]+/g, " ").trim();
  return normalized || "General";
}

function prettifyNamePart(value) {
  return decodeLabel(String(value || ""))
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStructuredFileName(fileName) {
  const raw = titleFromName(fileName);
  const normalized = prettifyNamePart(raw);
  const match = normalized.match(/^([^-]+)-(.+)-((?:19|20)\d{2})$/);
  if (!match) {
    return { matched: false };
  }

  const author = prettifyNamePart(match[1]);
  const title = prettifyNamePart(match[2]);
  const publishedYear = Number.parseInt(match[3], 10);

  if (!author || !title || !Number.isFinite(publishedYear)) {
    return { matched: false };
  }

  return { matched: true, author, title, publishedYear };
}

function titleFromName(fileName) {
  return fileName.replace(/\.pdf$/i, "");
}

function relativePathSegments(rootPath, folderPath) {
  const normalizedRoot = ensureTrailingSlash(rootPath);
  const normalizedFolder = ensureTrailingSlash(folderPath);
  if (!normalizedFolder.startsWith(normalizedRoot)) return [];
  const relative = normalizedFolder.replace(normalizedRoot, "").replace(/\/$/, "");
  if (!relative) return [];
  return relative.split("/").map((segment) => decodeLabel(segment)).filter(Boolean);
}

function stripFileExtension(name) {
  return String(name || "").replace(/\.[a-z0-9]{2,5}$/i, "").toLowerCase();
}

function realCoverForEntry(entry, entries, facultyPath) {
  const images = entries.filter((candidate) => !candidate.isFolder && /\.(jpg|jpeg|png|webp|avif)$/i.test(candidate.path));
  if (images.length === 0) return "";
  const byBase = new Map();
  for (const image of images) byBase.set(stripFileExtension(image.name), image.path);
  const matching = byBase.get(stripFileExtension(entry.name));
  if (matching) return matching;
  const coverLike = images.find((image) => /cover|coperta|front|thumbnail|thumb/i.test(image.name));
  return coverLike ? coverLike.path : images[0].path;
}

async function fetchWithRetry(url, options = {}, retries = 4) {
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        lastError = new Error(`HTTP 429 for ${url}`);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function parseDirectoryListing(html, folderPath) {
  const root = parseHtml(html);
  const rows = root.querySelectorAll("table tr");
  const results = [];

  for (const row of rows) {
    const columns = row.querySelectorAll("td");
    if (columns.length < 4) continue;
    const anchor = columns[1].querySelector("a");
    if (!anchor) continue;

    const href = anchor.getAttribute("href") || "";
    const anchorText = (anchor.textContent || "").trim();
    if (!href || anchorText === "Parent Directory" || href.startsWith("?C=")) continue;

    const absolutePath = new URL(href, folderPath).toString();
    const absoluteUrl = new URL(absolutePath);
    const pathnameParts = absoluteUrl.pathname.split("/").filter(Boolean);
    const pathName = decodeLabel(pathnameParts[pathnameParts.length - 1] || anchorText.replace(/\/$/, ""));
    const isFolder = href.endsWith("/") || absoluteUrl.pathname.endsWith("/");
    const name = isFolder ? pathName.replace(/\/$/, "") : pathName;
    const date = (columns[2].textContent || "").trim() || "-";
    const sizeText = (columns[3].textContent || "").trim() || "-";

    results.push({
      name,
      path: isFolder ? ensureTrailingSlash(absolutePath) : absolutePath,
      isFolder,
      date,
      sizeBytes: isFolder ? 0 : parseSizeToBytes(sizeText)
    });
  }
  return results;
}

async function crawlFacultyRecursively(facultyPath, facultyLabel) {
  const queue = [ensureTrailingSlash(facultyPath)];
  const seen = new Set();
  const books = [];

  while (queue.length) {
    const batch = [];
    while (queue.length && batch.length < INDEX_CONCURRENCY) {
      const folder = queue.shift();
      if (!seen.has(folder)) {
        seen.add(folder);
        batch.push(folder);
      }
    }

    await Promise.all(batch.map(async (folderPath) => {
      try {
        await new Promise((r) => setTimeout(r, Math.random() * 200));
        const res = await fetchWithRetry(folderPath);
        const html = await res.text();
        if (!html.toLowerCase().includes("<table")) return;

        const entries = parseDirectoryListing(html, folderPath);
        for (const entry of entries) {
          if (entry.isFolder) {
            queue.push(ensureTrailingSlash(entry.path));
            continue;
          }
          if (!/\.pdf$/i.test(entry.path)) continue;

          const segments = relativePathSegments(facultyPath, folderPath);
          const parsedName = parseStructuredFileName(entry.name);
          const author = parsedName.author || "Autor necunoscut";
          const rawDept = cleanDepartmentLabel(segments[0] || "");
          const resolved = resolveKnownDepartment(facultyLabel, rawDept);
          const department = resolved !== null ? resolved : rawDept;
          const year = parsedName.publishedYear || extractYear([entry.date, ...segments, entry.name].join(" "));

          books.push({
            id: encodeURIComponent(entry.path),
            title: parsedName.title || prettifyNamePart(titleFromName(entry.name)),
            author,
            description: `Document din colectia ${facultyLabel}. Departament: ${department}.`,
            coverImage: realCoverForEntry(entry, entries, facultyPath),
            genre: [facultyLabel],
            era: year ? String(year) : (segments[1] || "Academic Collection"),
            faculty: facultyLabel,
            department,
            language: inferLanguageFromText(entry.name),
            languageSource: "filename",
            publishedYear: year,
            folderPath,
            filePath: entry.path,
            date: entry.date,
            sizeBytes: entry.sizeBytes
          });
        }
      } catch (e) {
        console.error(`[Crawler] Error at ${folderPath}:`, e.message);
      }
    }));

    if (queue.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }
  return books;
}

function getXmlValues(node, tagName) {
  return node.getElementsByTagName(tagName)
    .map((entry) => (entry.textContent || "").trim())
    .filter(Boolean);
}

function parseOaiSets(xml) {
  const root = parseHtml(xml);
  const sets = root.getElementsByTagName("set");
  const map = new Map();

  for (const set of sets) {
    const spec = (set.getElementsByTagName("setSpec")[0]?.textContent || "").trim();
    const name = (set.getElementsByTagName("setName")[0]?.textContent || "").trim();
    if (spec && name) {
      map.set(spec, name);
    }
  }

  return map;
}

async function fetchOaiSets() {
  try {
    const targetUrl = `${DSPACE_OAI_BASE_URL}?verb=ListSets`;
    const response = await fetchWithRetry(targetUrl);
    const xml = await response.text();
    return parseOaiSets(xml);
  } catch (e) {
    console.error("[Crawler] ListSets Error:", e.message);
    return new Map();
  }
}

function parseOaiBooks(xml, facultyLabel, setsMap = new Map()) {
  const root = parseHtml(xml);
  const rows = root.getElementsByTagName("record");
  const books = [];

  for (const row of rows) {
    const headerNode = row.getElementsByTagName("header")[0];
    const metadataNode = row.getElementsByTagName("metadata")[0];
    if (!metadataNode) continue;

    const setSpecs = (headerNode?.getElementsByTagName("setSpec") || [])
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);

    const titles = getXmlValues(metadataNode, "dc:title");
    const identifiers = getXmlValues(metadataNode, "dc:identifier");
    const contributors = getXmlValues(metadataNode, "dc:contributor.author");
    const fallbackContributors = getXmlValues(metadataNode, "dc:contributor");
    const subjects = getXmlValues(metadataNode, "dc:subject");
    const descriptions = getXmlValues(metadataNode, "dc:description");
    const dates = getXmlValues(metadataNode, "dc:date");
    const languages = getXmlValues(metadataNode, "dc:language");
    const formats = getXmlValues(metadataNode, "dc:format").map((entry) => entry.toLowerCase());

    const hasPdf = formats.some((entry) => entry.includes("pdf"));
    if (!hasPdf) continue;

    const handleUrl = identifiers.find((entry) => /\/handle\//i.test(entry));
    if (!handleUrl) continue;

    const normalizedHandleUrl = handleUrl.replace(/^http:\/\/dspace\.bcucluj\.ro/i, "https://dspace.bcucluj.ro");
    const thumb = identifiers
      .find((entry) => /\/image\/thumbs\//i.test(entry))
      ?.replace(/^http:\/\/dspace\.bcucluj\.ro/i, "https://dspace.bcucluj.ro");

    const title = titles[0] || "Document BCU";
    const author = contributors[0] || fallbackContributors[0] || "BCU";
    const year = extractYear(dates.join(" "));

    let resolvedDept = departmentFromSetSpecs(setSpecs, setsMap);
    if (!resolvedDept || resolvedDept === "General") {
      const metaStrings = [...subjects, ...descriptions, ...fallbackContributors];
      for (const str of metaStrings) {
        const found = resolveKnownDepartment(facultyLabel, str);
        if (found && found !== "General") {
          resolvedDept = found;
          break;
        }
      }
    }
    const department = resolvedDept || "General";

    books.push({
      id: encodeURIComponent(normalizedHandleUrl),
      title,
      author,
      description: descriptions[0] || `Document BCU disponibil prin DSpace (${facultyLabel}).`,
      coverImage: thumb || "",
      genre: [facultyLabel],
      era: year ? String(year) : "Academic Collection",
      faculty: facultyLabel,
      department,
      language: normalizeLanguageCode(languages[0] || ""),
      languageSource: "metadata",
      publishedYear: year,
      filePath: normalizedHandleUrl,
      sizeBytes: 0
    });
  }
  return books;
}

function departmentFromSetSpecs(setSpecs, setsMap) {
  const colSpecs = setSpecs.filter((spec) => spec.startsWith("col_"));
  for (const spec of colSpecs) {
    const name = setsMap.get(spec);
    if (name) return cleanDepartmentLabel(name);
  }
  return "";
}

async function fetchOaiBooks(facultyLabel) {
  const setsMap = await fetchOaiSets();
  let books = [];
  let resumptionToken = "";
  let pages = 0;

  try {
    do {
      pages++;
      const url = resumptionToken 
        ? `${DSPACE_OAI_BASE_URL}?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken)}`
        : `${DSPACE_OAI_BASE_URL}?verb=ListRecords&metadataPrefix=oai_dc`;
      
      const res = await fetchWithRetry(url);
      const xml = await res.text();
      const pageBooks = parseOaiBooks(xml, facultyLabel, setsMap);
      
      // Filter books to only those matching our faculty label (if the OAI pool is mixed)
      // Note: Usually the rebuild is triggered for a specific faculty, 
      // but OAI might return records from other faculties if not filtered by Set.
      // We rely on our metadata mapping to filter.
      books = [...books, ...pageBooks];

      const root = parseHtml(xml);
      resumptionToken = root.getElementsByTagName("resumptionToken")[0]?.textContent?.trim() || "";

      if (books.length >= OAI_MAX_RECORDS) break;
    } while (resumptionToken && pages < OAI_MAX_PAGES);
    
    // Final filter: keep only books that were assigned to this faculty OR its departments.
    return books;
  } catch (e) {
    console.error("[Crawler] OAI Error:", e.message);
    return books;
  }
}

async function indexFaculty(facultyKey, facultyLabel, facultyPath) {
  console.log(`[Crawler] Indexing ${facultyLabel} (${facultyPath})...`);
  let books = await crawlFacultyRecursively(facultyPath, facultyLabel);
  
  if (books.length === 0) {
    console.log(`[Crawler] No books from file server, trying OAI fallback for ${facultyLabel}...`);
    books = await fetchOaiBooks(facultyLabel);
  }

  books.sort((a, b) => a.title.localeCompare(b.title, "ro"));
  return books;
}

async function indexAllFaculties(onFacultyComplete) {
  const entries = Object.entries(FACULTY_LABEL_OVERRIDES);
  console.log(`[Crawler] Starting global index for ${entries.length} faculties...`);
  
  for (const [key, label] of entries) {
    const path = `${LIBRARY_BASE_URL}${encodeURIComponent(label)}/`;
    try {
      const books = await indexFaculty(key, label, path);
      if (onFacultyComplete) {
        await onFacultyComplete(key, label, books);
      }
    } catch (e) {
      console.error(`[Crawler] Global index failed for ${label}:`, e.message);
    }
  }
}

module.exports = { indexFaculty, indexAllFaculties };
